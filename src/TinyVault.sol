// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Ownable, Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {IBorrowerOperations, ITroveManager, IPriceFeed} from "./interfaces/IMezo.sol";

/// @title TinyVault
/// @notice Small MUSD loans against small amounts of BTC on Mezo.
///
/// Mezo's minimum loan is 1,800 MUSD (2,000 with the gas deposit). TinyVault opens one Mezo loan
/// (a "trove") for many people and keeps a ledger of who put in which BTC and who owes what, so
/// each person can borrow as little as `minBorrow`.
///
/// How the shared loan stays fair:
/// - Debt is tracked in shares of the trove's debt, so interest and Mezo's fees are split by what
///   each person borrowed.
/// - Each account has its own health. Borrowing and withdrawing must keep it at `openRatio`.
/// - Below `closeRatio` anyone can close that one account: they pay its debt in MUSD and receive
///   its BTC worth the debt plus `closeBonus`. The rest of the BTC stays with the owner. No sale
///   on a market is needed, and other accounts are untouched.
/// - If an account's BTC is worth less than its debt by the time it is closed, the vault's reserve
///   (funded by a small fee on each loan) pays the gap first. Only what the reserve cannot cover
///   is shared across the remaining debt.
/// - A Mezo redemption takes BTC from the trove and cancels the same value of debt. TinyVault
///   detects it and takes the BTC from each account in proportion to its debt, which is the same
///   proportion in which the debt was cancelled, so nobody loses value to anyone else.
///
/// The trove is opened by an "anchor" who borrows Mezo's minimum. The anchor is an ordinary
/// account in the ledger that also carries the trove's 200 MUSD gas deposit.
contract TinyVault is ReentrancyGuard, Ownable2Step {
    using SafeERC20 for IERC20;

    uint256 private constant ONE = 1e18;
    uint256 private constant BPS = 10_000;
    uint256 private constant ACC = 1e36;
    uint16 public constant MAX_RESERVE_FEE_BPS = 200; // 2%
    /// Shares held by nobody, so the share supply never reaches zero while debt remains.
    uint256 private constant DEAD_SHARES = 1e3;

    IBorrowerOperations public immutable borrowerOps;
    ITroveManager public immutable troveManager;
    IPriceFeed public immutable priceFeed;
    IERC20 public immutable musd;

    uint256 public immutable openRatio; // e.g. 1.5e18: borrowing and withdrawing keep at least this
    uint256 public immutable closeRatio; // e.g. 1.25e18: below this an account can be closed
    uint256 public immutable closeBonus; // e.g. 0.05e18: closer receives debt value * (1 + bonus)
    uint256 public immutable minBorrow; // smallest loan, e.g. 10 MUSD

    uint16 public reserveFeeBps;

    struct Account {
        uint256 coll; // BTC, as of the last settle
        uint256 shares; // share of the vault's debt
        uint256 lossSnap; // lossPerShare at the last settle
        uint256 gainSnap; // gainPerShare at the last settle
    }

    mapping(address => Account) private _accounts;

    uint256 public totalShares;
    uint256 public lossPerShare; // BTC removed per debt share by Mezo redemptions (x1e36)
    uint256 public gainPerShare; // BTC added per debt share by Mezo redistributions (x1e36)
    uint256 public trackedColl; // the trove's BTC after our last action
    uint256 public idle; // MUSD held against debt that could not be repaid to the trove yet
    uint256 public reserve; // MUSD held to cover shortfalls
    address public anchor;
    bool public closed; // the trove was closed by Mezo (full redemption or liquidation)

    event AnchorOpened(address indexed anchor, uint256 coll, uint256 debt);
    event Deposited(address indexed account, uint256 amount);
    event Withdrawn(address indexed account, uint256 amount);
    event Borrowed(address indexed account, uint256 amount, uint256 debtAdded, uint256 reserveFee);
    event Repaid(address indexed account, uint256 amount);
    event AccountClosed(
        address indexed account,
        address indexed closer,
        uint256 debt,
        uint256 paid,
        uint256 collSeized,
        uint256 reserveUsed,
        uint256 shared
    );
    event Redeemed(uint256 collRemoved, uint256 debtShares);
    event Redistributed(uint256 collAdded, uint256 debtShares);
    event VaultClosed(uint256 surplus);
    event ReserveFeeUpdated(uint16 bps);

    error NotOpen();
    error AlreadyOpen();
    error IsClosed();
    error ZeroAmount();
    error BelowMinBorrow();
    error Unhealthy();
    error Healthy();
    error NoDebt();
    error InsufficientCollateral();
    error FeeTooHigh();
    error TransferFailed();
    error BadParams();

    constructor(
        IBorrowerOperations borrowerOps_,
        address owner_,
        uint256 openRatio_,
        uint256 closeRatio_,
        uint256 closeBonus_,
        uint256 minBorrow_,
        uint16 reserveFeeBps_
    ) Ownable(owner_) {
        // Accounts must be closable while their BTC still covers debt plus bonus, and long before
        // Mezo's own 110% line for the whole trove.
        if (closeRatio_ <= ONE + closeBonus_ || openRatio_ <= closeRatio_ || closeRatio_ < 1.15e18) {
            revert BadParams();
        }
        if (reserveFeeBps_ > MAX_RESERVE_FEE_BPS) revert FeeTooHigh();
        borrowerOps = borrowerOps_;
        troveManager = ITroveManager(borrowerOps_.troveManager());
        priceFeed = IPriceFeed(borrowerOps_.priceFeed());
        musd = IERC20(borrowerOps_.musd());
        openRatio = openRatio_;
        closeRatio = closeRatio_;
        closeBonus = closeBonus_;
        minBorrow = minBorrow_;
        reserveFeeBps = reserveFeeBps_;
    }

    /// Mezo sends BTC back to the vault on withdrawals and surplus claims.
    receive() external payable {}

    // ---------------------------------------------------------------- anchor

    /// Opens the shared trove with Mezo's minimum loan. The caller becomes the anchor account and
    /// receives the borrowed MUSD.
    function openAnchor(uint256 debt, address upperHint, address lowerHint)
        external
        payable
        onlyOwner
        nonReentrant
    {
        if (anchor != address(0)) revert AlreadyOpen();
        uint256 before = musd.balanceOf(address(this));
        borrowerOps.openTrove{value: msg.value}(debt, upperHint, lowerHint);
        uint256 received = musd.balanceOf(address(this)) - before;

        (uint256 coll, uint256 netDebt) = _trove();
        anchor = msg.sender;
        trackedColl = coll;
        totalShares = netDebt + DEAD_SHARES;
        Account storage a = _accounts[msg.sender];
        a.coll = msg.value;
        a.shares = netDebt;

        musd.safeTransfer(msg.sender, received);
        emit AnchorOpened(msg.sender, msg.value, netDebt);
    }

    // ---------------------------------------------------------------- accounts

    function deposit(address upperHint, address lowerHint) external payable nonReentrant {
        if (msg.value == 0) revert ZeroAmount();
        _sync();
        if (anchor == address(0)) revert NotOpen();
        if (closed) revert IsClosed();
        _settle(msg.sender);
        borrowerOps.addColl{value: msg.value}(upperHint, lowerHint);
        _accounts[msg.sender].coll += msg.value;
        trackedColl += msg.value;
        emit Deposited(msg.sender, msg.value);
    }

    function borrow(uint256 amount, address upperHint, address lowerHint) external nonReentrant {
        _sync();
        if (anchor == address(0)) revert NotOpen();
        if (closed) revert IsClosed();
        if (amount < minBorrow) revert BelowMinBorrow();
        _settle(msg.sender);

        uint256 fee = (amount * reserveFeeBps) / BPS;
        uint256 need = amount + fee;
        uint256 debtBefore = vaultDebt();

        // Lend out MUSD already held against the debt first; it costs nothing.
        uint256 fromIdle = Math.min(idle, need);
        idle -= fromIdle;
        uint256 fromTrove = need - fromIdle;
        if (fromTrove > 0) {
            _ensureCapacity(fromTrove, upperHint, lowerHint);
            borrowerOps.withdrawMUSD(fromTrove, upperHint, lowerHint);
        }

        // Whatever the vault's debt grew by (amount, reserve fee, Mezo's fee, any refinance fee)
        // belongs to this borrower.
        uint256 added = vaultDebt() - debtBefore;
        // If every loan was repaid, the remaining shares owe nothing and new shares start fresh.
        uint256 newShares =
            debtBefore == 0 ? added : Math.mulDiv(added, totalShares, debtBefore, Math.Rounding.Ceil);
        _accounts[msg.sender].shares += newShares;
        totalShares += newShares;
        reserve += fee;

        _requireHealthy(msg.sender, openRatio, priceFeed.fetchPrice());
        musd.safeTransfer(msg.sender, amount);
        emit Borrowed(msg.sender, amount, added, fee);
    }

    function repay(uint256 amount, address upperHint, address lowerHint) external nonReentrant {
        _sync();
        if (closed) revert IsClosed();
        _settle(msg.sender);
        Account storage a = _accounts[msg.sender];
        uint256 debt = _debtOfShares(a.shares);
        if (debt == 0) revert NoDebt();
        if (amount > debt) amount = debt;
        if (amount == 0) revert ZeroAmount();

        uint256 burn = amount == debt ? a.shares : Math.mulDiv(amount, totalShares, vaultDebt());
        musd.safeTransferFrom(msg.sender, address(this), amount);
        a.shares -= burn;
        totalShares -= burn;
        _payDown(amount, upperHint, lowerHint);
        emit Repaid(msg.sender, amount);
    }

    function withdraw(uint256 amount, address upperHint, address lowerHint) external nonReentrant {
        if (amount == 0) revert ZeroAmount();
        _sync();
        _settle(msg.sender);
        Account storage a = _accounts[msg.sender];
        if (amount > a.coll) revert InsufficientCollateral();
        a.coll -= amount;

        if (!closed) {
            _requireHealthy(msg.sender, openRatio, priceFeed.fetchPrice());
            borrowerOps.withdrawColl(amount, upperHint, lowerHint);
            trackedColl -= amount;
        }
        _sendBtc(msg.sender, amount);
        emit Withdrawn(msg.sender, amount);
    }

    /// Closes one unhealthy account. The caller pays its debt in MUSD (or the part its BTC can
    /// cover) and receives its BTC worth that payment plus `closeBonus`.
    function closeAccount(address account, address upperHint, address lowerHint)
        external
        nonReentrant
    {
        _sync();
        if (closed) revert IsClosed();
        _settle(account);
        Account storage a = _accounts[account];
        uint256 debt = _accountDebt(account, a.shares);
        if (debt == 0) revert NoDebt();
        uint256 price = priceFeed.fetchPrice();
        if (a.coll * price >= debt * closeRatio) revert Healthy();

        uint256 sharesDebt = _debtOfShares(a.shares); // the anchor's gas deposit stays with the trove
        uint256 seize = Math.mulDiv(sharesDebt, ONE + closeBonus, price);
        uint256 pay = sharesDebt;
        if (seize > a.coll) {
            seize = a.coll;
            pay = Math.mulDiv(a.coll, price, ONE + closeBonus);
        }
        uint256 shortfall = sharesDebt - pay;
        uint256 fromReserve = Math.min(shortfall, reserve);
        reserve -= fromReserve;

        musd.safeTransferFrom(msg.sender, address(this), pay);
        totalShares -= a.shares;
        a.shares = 0;
        // Pay down what was collected; anything the reserve could not cover stays in the vault's
        // debt and is carried by the remaining shares.
        _payDown(pay + fromReserve, upperHint, lowerHint);

        a.coll -= seize;
        borrowerOps.withdrawColl(seize, upperHint, lowerHint);
        trackedColl -= seize;
        _sendBtc(msg.sender, seize);
        emit AccountClosed(account, msg.sender, sharesDebt, pay, seize, fromReserve, shortfall - fromReserve);
    }

    /// Applies any redemption, redistribution or closure that Mezo made since the last action.
    function sync() external nonReentrant {
        _sync();
    }

    // ---------------------------------------------------------------- owner

    function setReserveFee(uint16 bps) external onlyOwner {
        if (bps > MAX_RESERVE_FEE_BPS) revert FeeTooHigh();
        reserveFeeBps = bps;
        emit ReserveFeeUpdated(bps);
    }

    // ---------------------------------------------------------------- views

    /// The vault's debt shared by all accounts: the trove's debt minus the gas deposit and minus
    /// MUSD held against it.
    function vaultDebt() public view returns (uint256) {
        if (closed || anchor == address(0)) return 0;
        (, uint256 netDebt) = _trove();
        return netDebt > idle ? netDebt - idle : 0;
    }

    struct AccountView {
        uint256 coll;
        uint256 debt;
        uint256 ratio; // collateral value / debt, 1e18 = 100%; max uint if no debt
        uint256 maxBorrow; // more MUSD this account could borrow now, before fees
        uint256 closePrice; // BTC price at which it can be closed (0 if no debt)
    }

    function accountOf(address account) external view returns (AccountView memory v) {
        Account storage a = _accounts[account];
        (uint256 lossAcc, uint256 gainAcc) = _pendingAccumulators();
        v.coll = _effectiveColl(a, lossAcc, gainAcc);
        v.debt = closed ? 0 : _accountDebt(account, a.shares);
        uint256 price = priceFeed.fetchPrice();
        uint256 value = v.coll * price / ONE;
        v.ratio = v.debt == 0 ? type(uint256).max : value * ONE / v.debt;
        uint256 cap = value * ONE / openRatio;
        v.maxBorrow = cap > v.debt ? cap - v.debt : 0;
        v.closePrice = v.debt == 0 || v.coll == 0 ? 0 : Math.mulDiv(v.debt, closeRatio, v.coll);
    }

    struct VaultView {
        uint256 troveColl;
        uint256 troveDebt; // including the gas deposit
        uint256 vaultDebt;
        uint256 ratio; // the trove's own ratio as Mezo sees it
        uint256 price;
        uint256 idle;
        uint256 reserve;
        uint256 minNetDebt;
        bool closed;
        address anchor;
    }

    function vaultState() external view returns (VaultView memory v) {
        v.price = priceFeed.fetchPrice();
        v.idle = idle;
        v.reserve = reserve;
        v.minNetDebt = borrowerOps.minNetDebt();
        v.closed = closed;
        v.anchor = anchor;
        if (anchor == address(0) || closed) return v;
        (uint256 coll, uint256 principal, uint256 interest,,,) = troveManager.getEntireDebtAndColl(address(this));
        v.troveColl = coll;
        v.troveDebt = principal + interest;
        v.vaultDebt = vaultDebt();
        v.ratio = v.troveDebt == 0 ? type(uint256).max : coll * v.price / v.troveDebt;
    }

    // ---------------------------------------------------------------- internals

    function _trove() internal view returns (uint256 coll, uint256 netDebt) {
        (uint256 c, uint256 principal, uint256 interest,,,) = troveManager.getEntireDebtAndColl(address(this));
        uint256 gas = borrowerOps.MUSD_GAS_COMPENSATION();
        uint256 debt = principal + interest;
        return (c, debt > gas ? debt - gas : 0);
    }

    function _debtOfShares(uint256 shares) internal view returns (uint256) {
        if (shares == 0) return 0;
        return Math.mulDiv(shares, vaultDebt(), totalShares, Math.Rounding.Ceil);
    }

    /// Debt of an account for health checks: its share of the vault's debt, plus the trove's gas
    /// deposit for the anchor.
    function _accountDebt(address account, uint256 shares) internal view returns (uint256) {
        uint256 debt = _debtOfShares(shares);
        if (account == anchor && anchor != address(0) && !closed) {
            debt += borrowerOps.MUSD_GAS_COMPENSATION();
        }
        return debt;
    }

    function _requireHealthy(address account, uint256 ratio, uint256 price) internal view {
        Account storage a = _accounts[account];
        uint256 debt = _accountDebt(account, a.shares);
        if (debt == 0) return;
        if (a.coll * price < debt * ratio) revert Unhealthy();
    }

    function _effectiveColl(Account storage a, uint256 lossAcc, uint256 gainAcc)
        internal
        view
        returns (uint256)
    {
        uint256 c = a.coll + Math.mulDiv(a.shares, gainAcc - a.gainSnap, ACC);
        uint256 loss = Math.mulDiv(a.shares, lossAcc - a.lossSnap, ACC, Math.Rounding.Ceil);
        return c > loss ? c - loss : 0;
    }

    function _settle(address account) internal {
        Account storage a = _accounts[account];
        a.coll = _effectiveColl(a, lossPerShare, gainPerShare);
        a.lossSnap = lossPerShare;
        a.gainSnap = gainPerShare;
    }

    /// Accumulators including a change Mezo made that `_sync` has not recorded yet (for views).
    function _pendingAccumulators() internal view returns (uint256 lossAcc, uint256 gainAcc) {
        lossAcc = lossPerShare;
        gainAcc = gainPerShare;
        if (anchor == address(0) || closed || totalShares == 0) return (lossAcc, gainAcc);
        if (troveManager.getTroveStatus(address(this)) != ITroveManager.Status.active) {
            return (lossAcc, gainAcc);
        }
        (uint256 coll,) = _trove();
        if (coll < trackedColl) lossAcc += Math.mulDiv(trackedColl - coll, ACC, totalShares);
        else if (coll > trackedColl) gainAcc += Math.mulDiv(coll - trackedColl, ACC, totalShares);
    }

    function _sync() internal {
        if (anchor == address(0) || closed) return;
        if (troveManager.getTroveStatus(address(this)) != ITroveManager.Status.active) {
            _onTroveClosed();
            return;
        }
        (uint256 coll,) = _trove();
        if (coll < trackedColl) {
            // A redemption: Mezo took BTC and cancelled the same value of debt. The debt fell for
            // every share equally, so the BTC comes out per share too.
            uint256 removed = trackedColl - coll;
            lossPerShare += Math.mulDiv(removed, ACC, totalShares);
            emit Redeemed(removed, totalShares);
        } else if (coll > trackedColl) {
            // A redistribution from another liquidated trove added BTC and debt; same split.
            uint256 added = coll - trackedColl;
            gainPerShare += Math.mulDiv(added, ACC, totalShares);
            emit Redistributed(added, totalShares);
        }
        trackedColl = coll;
    }

    function _onTroveClosed() internal {
        uint256 before = address(this).balance;
        try borrowerOps.claimCollateral() {} catch {}
        uint256 surplus = address(this).balance - before;
        if (trackedColl > surplus && totalShares > 0) {
            lossPerShare += Math.mulDiv(trackedColl - surplus, ACC, totalShares);
        }
        trackedColl = 0;
        closed = true;
        emit VaultClosed(surplus);
    }

    /// Mezo refuses a loan above the trove's borrowing capacity, which is fixed when the trove
    /// opens and only reset by a refinance. Refinance when this loan needs room.
    function _ensureCapacity(uint256 amount, address upperHint, address lowerHint) internal {
        uint256 change = amount + borrowerOps.getBorrowingFee(amount);
        uint256 cap = troveManager.getTroveMaxBorrowingCapacity(address(this));
        if (cap < troveManager.getTroveDebt(address(this)) + change) {
            borrowerOps.refinance(upperHint, lowerHint);
        }
    }

    /// Repays the trove as far as Mezo's minimum loan allows and holds the rest against the debt.
    function _payDown(uint256 amount, address upperHint, address lowerHint) internal {
        if (amount == 0) return;
        (, uint256 netDebt) = _trove();
        uint256 min = borrowerOps.minNetDebt();
        uint256 room = netDebt > min ? netDebt - min : 0;
        uint256 toTrove = Math.min(amount, room);
        if (toTrove > 0) borrowerOps.repayMUSD(toTrove, upperHint, lowerHint);
        idle += amount - toTrove;
    }

    function _sendBtc(address to, uint256 amount) internal {
        (bool ok,) = to.call{value: amount}("");
        if (!ok) revert TransferFailed();
    }
}
