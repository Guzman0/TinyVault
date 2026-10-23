// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {TinyVault} from "../src/TinyVault.sol";
import {IBorrowerOperations} from "../src/interfaces/IMezo.sol";
import {MockMezo, MockMUSD, MockPriceFeed} from "./mocks/MockMezo.sol";

contract TinyVaultTest is Test {
    MockMezo mezo;
    MockMUSD musd;
    MockPriceFeed feed;
    TinyVault vault;

    address owner = makeAddr("owner");
    address amaka = makeAddr("amaka");
    address tunde = makeAddr("tunde");
    address ngozi = makeAddr("ngozi");
    address closer = makeAddr("closer");

    uint256 constant PRICE = 80_000e18;

    function setUp() public {
        mezo = new MockMezo();
        musd = mezo.token();
        feed = mezo.feed();
        feed.set(PRICE);
        vm.deal(address(mezo), 100 ether);
        vault = new TinyVault(IBorrowerOperations(address(mezo)), owner, 1.5e18, 1.25e18, 0.05e18, 10e18, 50);
        vm.deal(owner, 10 ether);
        vm.deal(amaka, 10 ether);
        vm.deal(tunde, 10 ether);
        vm.deal(ngozi, 10 ether);
        vm.prank(owner);
        vault.openAnchor{value: 0.05 ether}(1800e18, address(0), address(0)); // $4,000 against 2,001.8
    }

    // ---- helpers

    function _btc(uint256 usd) internal pure returns (uint256) {
        return usd * 1e36 / PRICE;
    }

    function _open(address who, uint256 usdColl, uint256 musdOut) internal {
        vm.startPrank(who);
        vault.deposit{value: _btc(usdColl)}(address(0), address(0));
        if (musdOut > 0) vault.borrow(musdOut, address(0), address(0));
        vm.stopPrank();
    }

    function _debt(address who) internal view returns (uint256) {
        return vault.accountOf(who).debt;
    }

    function _coll(address who) internal view returns (uint256) {
        return vault.accountOf(who).coll;
    }

    function _repayAll(address who) internal {
        uint256 d = _debt(who);
        deal(address(musd), who, musd.balanceOf(who) + d);
        vm.startPrank(who);
        musd.approve(address(vault), type(uint256).max);
        vault.repay(type(uint256).max, address(0), address(0));
        vm.stopPrank();
    }

    function _fundCloser(uint256 amount) internal {
        vm.prank(address(mezo));
        musd.mint(closer, amount);
        vm.prank(closer);
        musd.approve(address(vault), type(uint256).max);
    }

    function _sumDebts() internal view returns (uint256) {
        return _debt(amaka) + _debt(tunde) + _debt(ngozi) + _debt(owner) - 200e18;
    }

    // ---- setup and params

    function test_anchorOpensTheTrove() public view {
        assertEq(vault.anchor(), owner);
        assertEq(musd.balanceOf(owner), 1800e18);
        // 1,800 + 0.1% fee + 200 gas deposit (less ~1e3 wei carried by the vault's dead shares)
        assertApproxEqAbs(_debt(owner), 2001.8e18, DUST);
        assertEq(_coll(owner), 0.05 ether);
        assertEq(vault.vaultDebt(), 1801.8e18);
    }

    /// Debt carried by the 1e3 dead shares; far below a millionth of a cent.
    uint256 constant DUST = 1e4;

    function test_anchorOnlyOnceAndOnlyOwner() public {
        vm.prank(owner);
        vm.expectRevert(TinyVault.AlreadyOpen.selector);
        vault.openAnchor{value: 1 ether}(1800e18, address(0), address(0));
        TinyVault v2 = new TinyVault(IBorrowerOperations(address(mezo)), owner, 1.5e18, 1.25e18, 0.05e18, 10e18, 50);
        vm.prank(amaka);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, amaka));
        v2.openAnchor{value: 1 ether}(1800e18, address(0), address(0));
    }

    function test_nothingWorksBeforeTheAnchor() public {
        TinyVault v2 = new TinyVault(IBorrowerOperations(address(mezo)), owner, 1.5e18, 1.25e18, 0.05e18, 10e18, 50);
        vm.prank(amaka);
        vm.expectRevert(TinyVault.NotOpen.selector);
        v2.deposit{value: 1 ether}(address(0), address(0));
        vm.prank(amaka);
        vm.expectRevert(TinyVault.NotOpen.selector);
        v2.borrow(10e18, address(0), address(0));
        assertEq(v2.vaultDebt(), 0);
    }

    function test_constructorRejectsUnsafeParams() public {
        IBorrowerOperations bo = IBorrowerOperations(address(mezo));
        vm.expectRevert(TinyVault.BadParams.selector);
        new TinyVault(bo, owner, 1.2e18, 1.25e18, 0.05e18, 10e18, 50); // open below close
        vm.expectRevert(TinyVault.BadParams.selector);
        new TinyVault(bo, owner, 1.5e18, 1.12e18, 0.05e18, 10e18, 50); // close too near Mezo's 110%
        vm.expectRevert(TinyVault.BadParams.selector);
        new TinyVault(bo, owner, 1.5e18, 1.2e18, 0.2e18, 10e18, 50); // bonus eats the margin
        vm.expectRevert(TinyVault.FeeTooHigh.selector);
        new TinyVault(bo, owner, 1.5e18, 1.25e18, 0.05e18, 10e18, 201);
    }

    function test_reserveFeeOwnerOnlyAndCapped() public {
        vm.prank(amaka);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, amaka));
        vault.setReserveFee(10);
        vm.prank(owner);
        vm.expectRevert(TinyVault.FeeTooHigh.selector);
        vault.setReserveFee(201);
        vm.prank(owner);
        vault.setReserveFee(100);
        assertEq(vault.reserveFeeBps(), 100);
    }

    // ---- borrowing

    function test_smallLoan() public {
        _open(amaka, 300, 100e18);
        assertEq(musd.balanceOf(amaka), 100e18);
        // 100 + 0.5 reserve fee + 0.1% Mezo fee on 100.5
        assertApproxEqAbs(_debt(amaka), 100.6005e18, 1e6);
        assertEq(vault.reserve(), 0.5e18);
        assertApproxEqAbs(vault.accountOf(amaka).ratio, 2.982e18, 0.001e18);
    }

    function test_borrowLimitIsPerAccount() public {
        _open(amaka, 300, 0);
        vm.prank(amaka);
        vm.expectRevert(TinyVault.Unhealthy.selector);
        vault.borrow(199e18, address(0), address(0)); // 199 + fees > $300 / 1.5
        vm.prank(amaka);
        vault.borrow(198e18, address(0), address(0));
    }

    function test_minimumLoan() public {
        _open(amaka, 300, 0);
        vm.prank(amaka);
        vm.expectRevert(TinyVault.BelowMinBorrow.selector);
        vault.borrow(9e18, address(0), address(0));
    }

    function test_cannotBorrowWithoutCollateral() public {
        vm.prank(amaka);
        vm.expectRevert(TinyVault.Unhealthy.selector);
        vault.borrow(10e18, address(0), address(0));
    }

    function test_zeroDepositRejected() public {
        vm.prank(amaka);
        vm.expectRevert(TinyVault.ZeroAmount.selector);
        vault.deposit(address(0), address(0));
    }

    function test_refinancesWhenTheTroveRunsOutOfRoom() public {
        uint256 capBefore = mezo.getTroveMaxBorrowingCapacity(address(vault));
        // The anchor's room at open was 4000/1.1 - 2001.8 ≈ 1,634 MUSD.
        _open(tunde, 6000, 3000e18);
        assertEq(musd.balanceOf(tunde), 3000e18);
        assertGt(mezo.getTroveMaxBorrowingCapacity(address(vault)), capBefore);
        // Tunde pays the refinance fee, not the anchor.
        assertApproxEqAbs(_debt(owner), 2001.8e18, DUST);
    }

    // ---- interest and fees are split by debt

    function test_interestSplitByDebt() public {
        _open(amaka, 3000, 1000e18);
        uint256 a0 = _debt(amaka);
        uint256 o0 = _debt(owner) - 200e18;
        mezo.accrue(address(vault), 100e18);
        uint256 a1 = _debt(amaka);
        uint256 o1 = _debt(owner) - 200e18;
        assertApproxEqAbs((a1 - a0) + (o1 - o0), 100e18, DUST);
        assertApproxEqRel((a1 - a0) * 1e18 / (o1 - o0), a0 * 1e18 / o0, 1e12);
    }

    // ---- repaying

    function test_repayAndWithdrawEverything() public {
        uint256 coll = _btc(300);
        _open(amaka, 300, 100e18);
        _repayAll(amaka);
        assertEq(_debt(amaka), 0);
        uint256 before = amaka.balance;
        vm.prank(amaka);
        vault.withdraw(coll, address(0), address(0));
        assertEq(amaka.balance - before, coll);
        assertEq(vault.trackedColl(), 0.05 ether);
    }

    function test_partialRepay() public {
        _open(amaka, 300, 100e18);
        uint256 d = _debt(amaka);
        vm.startPrank(amaka);
        musd.approve(address(vault), type(uint256).max);
        vault.repay(40e18, address(0), address(0));
        vm.stopPrank();
        assertApproxEqAbs(_debt(amaka), d - 40e18, 2);
    }

    function test_repayWithNoDebtReverts() public {
        vm.prank(amaka);
        vm.expectRevert(TinyVault.NoDebt.selector);
        vault.repay(1e18, address(0), address(0));
    }

    function test_repaymentBeyondMezoMinimumIsHeldAndLentOutAgain() public {
        // The anchor repays everything: Mezo will not let the trove go below 1,800, so the
        // MUSD is held against the debt instead.
        _repayAll(owner);
        // 1.8 MUSD fits above Mezo's minimum and goes to the trove; the rest is held.
        assertApproxEqAbs(vault.idle(), 1800e18, DUST);
        assertLe(vault.vaultDebt(), DUST);
        assertEq(_debt(owner), 200e18); // only the gas deposit remains with the anchor

        // The next borrower is lent that MUSD with no Mezo fee.
        uint256 troveDebt = mezo.getTroveDebt(address(vault));
        _open(amaka, 300, 100e18);
        assertEq(mezo.getTroveDebt(address(vault)), troveDebt);
        assertApproxEqAbs(_debt(amaka), 100.5e18, DUST);
        assertApproxEqAbs(vault.idle(), 1800e18 - 100.5e18, DUST);
    }

    function test_withdrawKeepsTheAccountHealthy() public {
        _open(amaka, 300, 150e18);
        vm.prank(amaka);
        vm.expectRevert(TinyVault.Unhealthy.selector);
        vault.withdraw(_btc(100), address(0), address(0));
        vm.prank(amaka);
        vm.expectRevert(TinyVault.InsufficientCollateral.selector);
        vault.withdraw(_btc(400), address(0), address(0));
        vm.prank(amaka);
        vm.expectRevert(TinyVault.ZeroAmount.selector);
        vault.withdraw(0, address(0), address(0));
    }

    function test_anchorCarriesTheGasDeposit() public {
        // $4,000 of BTC against 2,001.8: the anchor can only draw down to 150% of that.
        vm.prank(owner);
        vm.expectRevert(TinyVault.Unhealthy.selector);
        vault.withdraw(0.0126 ether, address(0), address(0));
        vm.prank(owner);
        vault.withdraw(0.012 ether, address(0), address(0));
    }

    // ---- closing one account

    function test_closeOneAccountOnly() public {
        _open(amaka, 300, 195e18);
        _open(tunde, 500, 100e18);
        TinyVault.AccountView memory t0 = vault.accountOf(tunde);
        feed.set(PRICE * 80 / 100);

        vm.expectRevert(TinyVault.Healthy.selector);
        vault.closeAccount(tunde, address(0), address(0));

        uint256 d = _debt(amaka);
        _fundCloser(1000e18);
        vm.prank(closer);
        vault.closeAccount(amaka, address(0), address(0));

        assertEq(1000e18 - musd.balanceOf(closer), d);
        assertApproxEqRel(closer.balance * (PRICE * 80 / 100) / 1e18, d * 105 / 100, 1e12);
        assertEq(_debt(amaka), 0);
        assertApproxEqAbs(_coll(amaka) + closer.balance, _btc(300), 1);
        TinyVault.AccountView memory t1 = vault.accountOf(tunde);
        assertEq(t1.coll, t0.coll);
        assertApproxEqAbs(t1.debt, t0.debt, 2);
        assertEq(vault.reserve(), 0.975e18 + 0.5e18);
    }

    function test_shortfallPaidByReserveFirst() public {
        _open(amaka, 300, 195e18); // reserve 0.975
        _open(tunde, 2000, 1000e18); // reserve +5
        uint256 t0 = _debt(tunde);
        // A crash so fast that Amaka's BTC no longer covers debt plus the closer's bonus.
        feed.set(PRICE * 68 / 100);
        uint256 d = _debt(amaka);
        uint256 collValue = _coll(amaka) * (PRICE * 68 / 100) / 1e18;
        uint256 expectedPay = collValue * 1e18 / 1.05e18;
        uint256 shortfall = d - expectedPay;
        assertLt(shortfall, vault.reserve());

        _fundCloser(1000e18);
        vm.prank(closer);
        vault.closeAccount(amaka, address(0), address(0));
        assertApproxEqAbs(1000e18 - musd.balanceOf(closer), expectedPay, 2);
        assertApproxEqAbs(vault.reserve(), 5.975e18 - shortfall, 2);
        assertEq(_coll(amaka), 0);
        // Nobody else paid for it.
        assertApproxEqAbs(_debt(tunde), t0, 2);
    }

    function test_shortfallBeyondReserveIsShared() public {
        vm.prank(owner);
        vault.setReserveFee(0);
        _open(amaka, 300, 195e18);
        _open(tunde, 2000, 1000e18);
        uint256 t0 = _debt(tunde);
        uint256 o0 = _debt(owner) - 200e18;
        feed.set(PRICE * 60 / 100);
        uint256 d = _debt(amaka);
        uint256 pay = (_coll(amaka) * (PRICE * 60 / 100) / 1e18) * 1e18 / 1.05e18;
        _fundCloser(1000e18);
        vm.prank(closer);
        vault.closeAccount(amaka, address(0), address(0));
        uint256 shared = d - pay;
        uint256 t1 = _debt(tunde);
        uint256 o1 = _debt(owner) - 200e18;
        assertApproxEqAbs((t1 - t0) + (o1 - o0), shared, DUST);
        assertApproxEqRel((t1 - t0) * 1e18 / (o1 - o0), t0 * 1e18 / o0, 1e12);
    }

    function test_closeAccountWithoutDebtReverts() public {
        _open(amaka, 300, 0);
        vm.expectRevert(TinyVault.NoDebt.selector);
        vault.closeAccount(amaka, address(0), address(0));
    }

    // ---- Mezo redemptions and redistributions

    function test_redemptionSplitByDebt() public {
        _open(amaka, 900, 100e18); // little debt, lots of BTC
        _open(tunde, 450, 295e18); // more debt, less BTC
        TinyVault.AccountView memory a0 = vault.accountOf(amaka);
        TinyVault.AccountView memory t0 = vault.accountOf(tunde);
        TinyVault.AccountView memory o0 = vault.accountOf(owner);

        mezo.redeem(address(vault), 300e18);
        vault.sync();

        _assertNoValueMoved(a0, vault.accountOf(amaka));
        _assertNoValueMoved(t0, vault.accountOf(tunde));
        _assertNoValueMoved(o0, vault.accountOf(owner));
        assertApproxEqAbs(_coll(amaka) + _coll(tunde) + _coll(owner), vault.trackedColl(), 3);
    }

    function test_redemptionShowsBeforeSync() public {
        _open(amaka, 900, 100e18);
        uint256 c0 = _coll(amaka);
        mezo.redeem(address(vault), 300e18);
        assertLt(_coll(amaka), c0); // views already apply it
        uint256 shown = _coll(amaka);
        vault.sync();
        assertEq(_coll(amaka), shown);
    }

    function test_redistributionSplitByDebt() public {
        _open(amaka, 900, 100e18);
        uint256 a0 = _coll(amaka);
        uint256 d0 = _debt(amaka);
        uint256 total = vault.vaultDebt();
        vm.deal(address(this), 1 ether);
        mezo.redistribute{value: 0.01 ether}(address(vault), 0.01 ether, 500e18);
        vault.sync();
        assertApproxEqRel(_coll(amaka) - a0, uint256(0.01 ether) * d0 / total, 1e12);
        assertApproxEqRel(_debt(amaka) - d0, uint256(500e18) * d0 / total, 1e12);
    }

    function test_fullRedemptionClosesTheVaultAndEveryoneWithdraws() public {
        _open(amaka, 900, 100e18);
        _open(tunde, 450, 295e18);
        uint256 price = PRICE;
        uint256 aEquity = _coll(amaka) - _debt(amaka) * 1e18 / price;
        uint256 tEquity = _coll(tunde) - _debt(tunde) * 1e18 / price;

        mezo.redeemFully(address(vault));
        vault.sync();
        assertTrue(vault.closed());
        assertEq(vault.vaultDebt(), 0);
        assertEq(_debt(amaka), 0);

        // Each keeps the BTC left after their own debt was cancelled.
        assertApproxEqRel(_coll(amaka), aEquity, 1e14);
        assertApproxEqRel(_coll(tunde), tEquity, 1e14);
        uint256 before = amaka.balance;
        uint256 c = _coll(amaka);
        vm.prank(amaka);
        vault.withdraw(c, address(0), address(0));
        assertEq(amaka.balance - before, c);
        c = _coll(tunde);
        vm.prank(tunde);
        vault.withdraw(c, address(0), address(0));
        c = _coll(owner);
        vm.prank(owner);
        vault.withdraw(c, address(0), address(0));
        assertLt(address(vault).balance, 10);

        vm.prank(amaka);
        vm.expectRevert(TinyVault.IsClosed.selector);
        vault.deposit{value: 1}(address(0), address(0));
    }

    function test_liquidatedTroveClosesTheVault() public {
        _open(amaka, 900, 100e18);
        mezo.liquidate(address(vault));
        vault.sync();
        assertTrue(vault.closed());
        vm.prank(amaka);
        vm.expectRevert(TinyVault.IsClosed.selector);
        vault.borrow(10e18, address(0), address(0));
    }

    function _assertNoValueMoved(TinyVault.AccountView memory b, TinyVault.AccountView memory a) internal pure {
        // BTC lost (in dollars) equals debt cancelled.
        uint256 collLost = (b.coll - a.coll) * PRICE / 1e18;
        assertApproxEqRel(collLost, b.debt - a.debt, 1e12);
    }

    // ---- fuzz: the ledger always adds up

    function testFuzz_ledgerAddsUp(uint96 c1, uint96 c2, uint64 b1, uint64 b2, uint64 interest, uint64 redeemed)
        public
    {
        uint256 coll1 = bound(c1, 50, 50_000);
        uint256 coll2 = bound(c2, 50, 50_000);
        uint256 max1 = coll1 * 1e18 * 100 / 151;
        uint256 max2 = coll2 * 1e18 * 100 / 151;
        uint256 borrow1 = max1 < 10e18 ? 0 : bound(b1, 10e18, max1);
        uint256 borrow2 = max2 < 10e18 ? 0 : bound(b2, 10e18, max2);
        _open(amaka, coll1, borrow1);
        _open(tunde, coll2, borrow2);

        mezo.accrue(address(vault), bound(interest, 0, 500e18));
        uint256 r = bound(redeemed, 0, 300e18);
        if (r > 0) mezo.redeem(address(vault), r);
        vault.sync();

        (, uint256 principal, uint256 owed,,,) = mezo.getEntireDebtAndColl(address(vault));
        uint256 netDebt = principal + owed - 200e18;
        // Account debts add up to the trove's debt (rounding up per account).
        assertApproxEqAbs(_sumDebts(), netDebt - vault.idle(), DUST);
        // Account BTC adds up to the trove's BTC.
        assertApproxEqAbs(_coll(amaka) + _coll(tunde) + _coll(owner), mezo.getTroveColl(address(vault)), 4);
    }

    function testFuzz_repayNeverStrandsDebt(uint256 b1, uint256 part) public {
        uint256 borrow1 = bound(b1, 10e18, 190e18);
        _open(amaka, 300, borrow1);
        uint256 d = _debt(amaka);
        deal(address(musd), amaka, d); // enough to cover the fees too
        uint256 p = bound(part, 1, d);
        vm.startPrank(amaka);
        musd.approve(address(vault), type(uint256).max);
        vault.repay(p, address(0), address(0));
        vm.stopPrank();
        assertApproxEqAbs(_debt(amaka), d - p, 2);
        if (_debt(amaka) > 0) _repayAll(amaka);
        assertEq(_debt(amaka), 0);
        assertApproxEqAbs(_sumDebts() + vault.idle(), mezo.getTroveDebt(address(vault)) - 200e18, DUST);
    }
}
