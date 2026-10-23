// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test, console} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {TinyVault} from "../src/TinyVault.sol";
import {IBorrowerOperations, ITroveManager, IPriceFeed} from "../src/interfaces/IMezo.sol";

/// Runs against Mezo's real MUSD contracts on testnet:
///   FOUNDRY_PROFILE=fork MEZO_RPC=https://rpc.test.mezo.org forge test --match-contract Fork -vv
contract TinyVaultForkTest is Test {
    IBorrowerOperations constant BO = IBorrowerOperations(0xCdF7028ceAB81fA0C6971208e83fa7872994beE5);

    TinyVault vault;
    ITroveManager tm;
    IPriceFeed feed;
    IERC20 musd;
    bool forked;
    uint256 livePrice;

    address owner = makeAddr("owner");
    address amaka = makeAddr("amaka"); // a small holder
    address tunde = makeAddr("tunde"); // another one
    address closer = makeAddr("closer");

    function setUp() public {
        string memory rpc = vm.envOr("MEZO_RPC", string(""));
        if (bytes(rpc).length == 0) return;
        vm.createSelectFork(rpc);
        forked = true;
        tm = ITroveManager(BO.troveManager());
        feed = IPriceFeed(BO.priceFeed());
        musd = IERC20(BO.musd());
        // Mezo's price feed reads a chain precompile that a forked EVM cannot run, so read today's
        // price from the live network and serve it to the fork.
        bytes memory res = vm.rpc(
            "eth_call",
            string.concat('[{"to":"', vm.toString(address(feed)), '","data":"0x0fdb11cf"},"latest"]')
        );
        livePrice = abi.decode(res, (uint256));
        _setPrice(livePrice);
        vault = new TinyVault(BO, owner, 1.5e18, 1.25e18, 0.05e18, 10e18, 50);
        vm.deal(owner, 1 ether);
        vm.deal(amaka, 1 ether);
        vm.deal(tunde, 1 ether);
        vm.prank(owner);
        vault.openAnchor{value: 0.06 ether}(1800e18, address(0), address(0));
    }

    function _price() internal view returns (uint256) {
        return feed.fetchPrice();
    }

    function _setPrice(uint256 p) internal {
        vm.mockCall(address(feed), abi.encodeWithSelector(IPriceFeed.fetchPrice.selector), abi.encode(p));
    }

    /// BTC worth `usd` dollars at today's price.
    function _btc(uint256 usd) internal view returns (uint256) {
        return usd * 1e36 / _price();
    }

    function test_fork_anchorOpensRealTrove() public view {
        if (!forked) return;
        assertEq(uint8(tm.getTroveStatus(address(vault))), uint8(ITroveManager.Status.active));
        assertEq(musd.balanceOf(owner), 1800e18);
        TinyVault.AccountView memory a = vault.accountOf(owner);
        assertGt(a.debt, 2000e18); // 1,800 + Mezo fee + 200 gas deposit
        console.log("anchor debt", a.debt / 1e18, "ratio %", a.ratio * 100 / 1e18);
    }

    function test_fork_smallLoanEndToEnd() public {
        if (!forked) return;
        // $300 of BTC, $100 loan: far below Mezo's 1,800 MUSD minimum.
        uint256 coll = _btc(300);
        vm.startPrank(amaka);
        vault.deposit{value: coll}(address(0), address(0));
        vault.borrow(100e18, address(0), address(0));
        vm.stopPrank();
        assertEq(musd.balanceOf(amaka), 100e18);

        TinyVault.AccountView memory a = vault.accountOf(amaka);
        console.log("debt (milli-MUSD)", a.debt / 1e15);
        console.log("ratio %", a.ratio * 100 / 1e18);
        // 100 + 0.5% reserve fee + Mezo's 0.1% fee on what was drawn
        assertApproxEqAbs(a.debt, 100.6e18, 0.1e18);
        assertEq(vault.reserve(), 0.5e18);

        // Repay everything (top up the fees first) and take the BTC back.
        deal(address(musd), amaka, a.debt + 1e18);
        vm.startPrank(amaka);
        musd.approve(address(vault), type(uint256).max);
        vault.repay(type(uint256).max, address(0), address(0));
        assertEq(vault.accountOf(amaka).debt, 0);
        uint256 before = amaka.balance;
        vault.withdraw(vault.accountOf(amaka).coll, address(0), address(0));
        vm.stopPrank();
        assertApproxEqAbs(amaka.balance - before, coll, 2);
    }

    function test_fork_cannotBorrowPastOwnLimit() public {
        if (!forked) return;
        uint256 coll = _btc(300);
        vm.startPrank(amaka);
        vault.deposit{value: coll}(address(0), address(0));
        vm.expectRevert(TinyVault.Unhealthy.selector);
        vault.borrow(210e18, address(0), address(0)); // $300 / 1.5 = $200 limit
        vm.stopPrank();
    }

    function test_fork_closeOneAccountLeavesOthersWhole() public {
        if (!forked) return;
        vm.startPrank(amaka);
        vault.deposit{value: _btc(300)}(address(0), address(0));
        vault.borrow(195e18, address(0), address(0)); // close to the 150% limit
        vm.stopPrank();
        vm.startPrank(tunde);
        vault.deposit{value: _btc(500)}(address(0), address(0));
        vault.borrow(100e18, address(0), address(0)); // a cautious 500%
        vm.stopPrank();
        TinyVault.AccountView memory tundeBefore = vault.accountOf(tunde);

        // BTC falls 20%. Amaka drops under 125%; Tunde is still far above.
        uint256 newPrice = _price() * 80 / 100;
        _setPrice(newPrice);
        TinyVault.AccountView memory am = vault.accountOf(amaka);
        console.log("amaka ratio after drop %", am.ratio * 100 / 1e18);
        assertLt(am.ratio, 1.25e18);

        vm.expectRevert(TinyVault.Healthy.selector);
        vault.closeAccount(tunde, address(0), address(0));

        deal(address(musd), closer, 1000e18);
        vm.startPrank(closer);
        musd.approve(address(vault), type(uint256).max);
        uint256 btcBefore = closer.balance;
        vault.closeAccount(amaka, address(0), address(0));
        vm.stopPrank();

        uint256 seized = closer.balance - btcBefore;
        uint256 paid = 1000e18 - musd.balanceOf(closer);
        console.log("closer paid (MUSD)", paid / 1e18);
        console.log("closer got BTC worth $", seized * newPrice / 1e36);
        assertApproxEqRel(seized * newPrice / 1e18, paid * 105 / 100, 0.001e18);

        // Amaka keeps what was left, owes nothing.
        TinyVault.AccountView memory amAfter = vault.accountOf(amaka);
        assertEq(amAfter.debt, 0);
        assertGt(amAfter.coll, 0);
        // Tunde is untouched.
        TinyVault.AccountView memory tundeAfter = vault.accountOf(tunde);
        assertEq(tundeAfter.coll, tundeBefore.coll);
        assertApproxEqAbs(tundeAfter.debt, tundeBefore.debt, 1e15);
    }

    function test_fork_growsPastOpeningCapacityByRefinancing() public {
        if (!forked) return;
        uint256 cap = tm.getTroveMaxBorrowingCapacity(address(vault));
        uint256 debt = tm.getTroveDebt(address(vault));
        console.log("room before (MUSD)", (cap - debt) / 1e18);
        // Tunde brings enough BTC to borrow more than the trove's original room.
        uint256 want = (cap - debt) + 500e18;
        vm.startPrank(tunde);
        vault.deposit{value: _btc(want * 2 / 1e18)}(address(0), address(0));
        vault.borrow(want, address(0), address(0));
        vm.stopPrank();
        assertEq(musd.balanceOf(tunde), want);
        assertGt(tm.getTroveMaxBorrowingCapacity(address(vault)), cap);
    }
}

interface ISortedTrovesLike {
    function getLast() external view returns (address);
    function getPrev(address id) external view returns (address);
    function findInsertPosition(uint256 nicr, address prev, address next) external view returns (address, address);
}

interface IHintHelpersLike {
    function getRedemptionHints(uint256 amount, uint256 price, uint256 maxIterations)
        external
        view
        returns (address firstHint, uint256 partialNICR, uint256 truncatedAmount);
}

interface ITroveManagerRedeem {
    function redeemCollateral(
        uint256 amount,
        address firstHint,
        address upperPartialHint,
        address lowerPartialHint,
        uint256 partialNICR,
        uint256 maxIterations
    ) external;
}

/// A real Mezo redemption reaching the shared trove.
contract TinyVaultForkRedemptionTest is TinyVaultForkTest {
    IHintHelpersLike constant HINTS = IHintHelpersLike(0x4e4cBA3779d56386ED43631b4dCD6d8EacEcBCF6);

    function test_fork_redemptionIsSplitByDebt() public {
        if (!forked) return;
        // Amaka borrows little against a lot; Tunde borrows a lot against little.
        vm.startPrank(amaka);
        vault.deposit{value: _btc(600)}(address(0), address(0));
        vault.borrow(100e18, address(0), address(0));
        vm.stopPrank();
        vm.startPrank(tunde);
        vault.deposit{value: _btc(450)}(address(0), address(0));
        vault.borrow(295e18, address(0), address(0));
        vm.stopPrank();

        a0 = vault.accountOf(amaka);
        t0 = vault.accountOf(tunde);
        o0 = vault.accountOf(owner);

        uint256 price = _redeemIntoVault(200e18);
        vault.sync();

        _assertFair(a0, vault.accountOf(amaka), price, "amaka");
        _assertFair(t0, vault.accountOf(tunde), price, "tunde");
        _assertFair(o0, vault.accountOf(owner), price, "anchor");
        // Tunde owed about 3x Amaka, so lost about 3x the BTC.
        TinyVault.AccountView memory a1 = vault.accountOf(amaka);
        TinyVault.AccountView memory t1 = vault.accountOf(tunde);
        assertApproxEqRel((t0.coll - t1.coll) * 1e18 / (a0.coll - a1.coll), (t0.debt * 1e18) / a0.debt, 0.01e18);
    }

    TinyVault.AccountView a0;
    TinyVault.AccountView t0;
    TinyVault.AccountView o0;

    /// Redeems through every riskier trove on testnet and `extra` MUSD into the vault's trove.
    function _redeemIntoVault(uint256 extra) internal returns (uint256 price) {
        ISortedTrovesLike st = ISortedTrovesLike(BO.sortedTroves());
        uint256 amount;
        uint256 n;
        for (address t = st.getLast(); t != address(vault) && t != address(0); t = st.getPrev(t)) {
            (, uint256 p, uint256 i,,,) = tm.getEntireDebtAndColl(t);
            amount += p + i - 200e18;
            n++;
        }
        amount += extra;
        console.log("troves ahead of ours", n);
        console.log("redeeming (MUSD)", amount / 1e18);

        price = _price();
        (address first, uint256 partialNicr,) = HINTS.getRedemptionHints(amount, price, 0);
        (address up, address down) = st.findInsertPosition(partialNicr, address(0), address(0));
        address redeemer = makeAddr("redeemer");
        deal(address(musd), redeemer, amount);
        (uint256 collBefore,,,,,) = tm.getEntireDebtAndColl(address(vault));
        vm.prank(redeemer);
        ITroveManagerRedeem(address(tm)).redeemCollateral(amount, first, up, down, partialNicr, 0);
        (uint256 collAfter,,,,,) = tm.getEntireDebtAndColl(address(vault));
        assertLt(collAfter, collBefore, "redemption did not reach the vault");
        console.log("BTC taken from vault ($)", (collBefore - collAfter) * price / 1e36);
    }

    function _assertFair(TinyVault.AccountView memory b, TinyVault.AccountView memory a, uint256 price, string memory who)
        internal
        pure
    {
        uint256 collLost = (b.coll - a.coll) * price / 1e18;
        uint256 debtCut = b.debt - a.debt;
        assertApproxEqRel(collLost, debtCut, 0.002e18, who);
    }

}
