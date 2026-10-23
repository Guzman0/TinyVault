// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockMUSD is ERC20 {
    address public immutable minter;

    constructor() ERC20("Mezo USD", "MUSD") {
        minter = msg.sender;
    }

    function mint(address to, uint256 amount) external {
        require(msg.sender == minter, "only minter");
        _mint(to, amount);
    }

    function burn(address from, uint256 amount) external {
        require(msg.sender == minter, "only minter");
        _burn(from, amount);
    }
}

contract MockPriceFeed {
    uint256 public price;

    function set(uint256 p) external {
        price = p;
    }

    function fetchPrice() external view returns (uint256) {
        return price;
    }
}

/// A small stand-in for Mezo's BorrowerOperations + TroveManager, following the same rules that
/// matter to TinyVault: 1,800 MUSD minimum, 200 MUSD gas deposit, 0.1% borrowing fee, 110% MCR,
/// borrowing capacity fixed at open and reset by refinance, redemptions, redistributions,
/// liquidation and surplus claims.
contract MockMezo {
    enum Status {
        nonExistent,
        active,
        closedByOwner,
        closedByLiquidation,
        closedByRedemption
    }

    struct Trove {
        uint256 coll;
        uint256 principal;
        uint256 interest;
        uint256 cap;
        Status status;
    }

    uint256 public constant MUSD_GAS_COMPENSATION = 200e18;
    uint256 public minNetDebt = 1800e18;
    uint256 public borrowingRate = 0.001e18;
    uint8 public refinancingFeePercentage = 20;

    MockMUSD public immutable token;
    MockPriceFeed public immutable feed;
    mapping(address => Trove) public troves;
    mapping(address => uint256) public surplus;

    constructor() {
        token = new MockMUSD();
        feed = new MockPriceFeed();
    }

    // -------- BorrowerOperations surface

    function troveManager() external view returns (address) {
        return address(this);
    }

    function priceFeed() external view returns (address) {
        return address(feed);
    }

    function musd() external view returns (address) {
        return address(token);
    }

    function sortedTroves() external pure returns (address) {
        return address(0);
    }

    function getBorrowingFee(uint256 debt) public view returns (uint256) {
        return debt * borrowingRate / 1e18;
    }

    function openTrove(uint256 debt, address, address) external payable {
        Trove storage t = troves[msg.sender];
        require(t.status != Status.active, "open");
        require(debt >= minNetDebt, "min");
        uint256 fee = getBorrowingFee(debt);
        t.coll = msg.value;
        t.principal = debt + fee + MUSD_GAS_COMPENSATION;
        t.interest = 0;
        t.status = Status.active;
        t.cap = msg.value * feed.price() / 1.1e18;
        _requireMcr(t);
        token.mint(msg.sender, debt);
    }

    function addColl(address, address) external payable {
        Trove storage t = _active(msg.sender);
        t.coll += msg.value;
    }

    function withdrawColl(uint256 amount, address, address) external {
        Trove storage t = _active(msg.sender);
        t.coll -= amount;
        _requireMcr(t);
        uint256 newCap = t.coll * feed.price() / 1.1e18;
        if (newCap < t.cap) t.cap = newCap;
        (bool ok,) = msg.sender.call{value: amount}("");
        require(ok, "send");
    }

    function withdrawMUSD(uint256 amount, address, address) external {
        Trove storage t = _active(msg.sender);
        uint256 change = amount + getBorrowingFee(amount);
        require(t.cap >= t.principal + t.interest + change, "BorrowerOps: An operation that exceeds maxBorrowingCapacity is not permitted");
        t.principal += change;
        _requireMcr(t);
        token.mint(msg.sender, amount);
    }

    function repayMUSD(uint256 amount, address, address) external {
        Trove storage t = _active(msg.sender);
        uint256 debt = t.principal + t.interest;
        require(debt - MUSD_GAS_COMPENSATION - amount >= minNetDebt, "BorrowerOps: Trove's net debt must be greater than minimum");
        token.burn(msg.sender, amount);
        uint256 fromInterest = amount < t.interest ? amount : t.interest;
        t.interest -= fromInterest;
        t.principal -= amount - fromInterest;
    }

    function refinance(address, address) external {
        Trove storage t = _active(msg.sender);
        uint256 net = t.principal + t.interest - MUSD_GAS_COMPENSATION;
        t.principal += getBorrowingFee(refinancingFeePercentage * net / 100);
        t.cap = t.coll * feed.price() / 1.1e18;
        _requireMcr(t);
    }

    function claimCollateral() external {
        uint256 s = surplus[msg.sender];
        require(s > 0, "no surplus");
        surplus[msg.sender] = 0;
        (bool ok,) = msg.sender.call{value: s}("");
        require(ok, "send");
    }

    // -------- TroveManager surface

    function getEntireDebtAndColl(address b)
        external
        view
        returns (uint256, uint256, uint256, uint256, uint256, uint256)
    {
        Trove storage t = troves[b];
        return (t.coll, t.principal, t.interest, 0, 0, 0);
    }

    function getTroveStatus(address b) external view returns (Status) {
        return troves[b].status;
    }

    function getTroveDebt(address b) external view returns (uint256) {
        return troves[b].principal + troves[b].interest;
    }

    function getTroveColl(address b) external view returns (uint256) {
        return troves[b].coll;
    }

    function getTroveMaxBorrowingCapacity(address b) external view returns (uint256) {
        return troves[b].cap;
    }

    // -------- test controls

    function accrue(address b, uint256 interest) external {
        troves[b].interest += interest;
    }

    /// Someone redeems `amount` MUSD against this trove: debt falls by `amount`, BTC worth
    /// `amount` leaves.
    function redeem(address b, uint256 amount) external {
        Trove storage t = _active(b);
        t.coll -= amount * 1e18 / feed.price();
        uint256 fromInterest = amount < t.interest ? amount : t.interest;
        t.interest -= fromInterest;
        t.principal -= amount - fromInterest;
    }

    /// The whole net debt is redeemed; the rest of the BTC becomes a claimable surplus.
    function redeemFully(address b) external {
        Trove storage t = _active(b);
        uint256 net = t.principal + t.interest - MUSD_GAS_COMPENSATION;
        uint256 taken = net * 1e18 / feed.price();
        surplus[b] = t.coll - taken;
        t.coll = 0;
        t.principal = 0;
        t.interest = 0;
        t.status = Status.closedByRedemption;
    }

    /// Debt and BTC of a liquidated trove are shared out to this one.
    function redistribute(address b, uint256 coll, uint256 debt) external payable {
        require(msg.value == coll, "fund it");
        Trove storage t = _active(b);
        t.coll += coll;
        t.principal += debt;
    }

    function liquidate(address b) external {
        Trove storage t = _active(b);
        t.coll = 0;
        t.principal = 0;
        t.interest = 0;
        t.status = Status.closedByLiquidation;
    }

    function setMinNetDebt(uint256 v) external {
        minNetDebt = v;
    }

    function _active(address b) internal view returns (Trove storage t) {
        t = troves[b];
        require(t.status == Status.active, "not active");
    }

    function _requireMcr(Trove storage t) internal view {
        require(t.coll * feed.price() >= (t.principal + t.interest) * 1.1e18, "MCR");
    }

    receive() external payable {}
}
