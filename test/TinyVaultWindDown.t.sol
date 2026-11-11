// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {TinyVault} from "../src/TinyVault.sol";
import {IBorrowerOperations} from "../src/interfaces/IMezo.sol";
import {MockMezo, MockMUSD, MockPriceFeed} from "./mocks/MockMezo.sol";

/// Wave 2: winding the vault down (judges' finding H-01), Mezo Recovery Mode, and the MUSD the
/// vault holds when Mezo closes the trove itself.
contract TinyVaultWindDownTest is Test {
    MockMezo mezo;
    MockMUSD musd;
    MockPriceFeed feed;
    TinyVault vault;

    address owner = makeAddr("owner");
    address amaka = makeAddr("amaka");
    address tunde = makeAddr("tunde");
    address closer = makeAddr("closer");

    uint256 constant PRICE = 80_000e18;
    uint256 constant DUST = 1e4;

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
        vm.prank(owner);
        vault.openAnchor{value: 0.05 ether}(1800e18, address(0), address(0));
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

    function _mint(address to, uint256 amount) internal {
        vm.prank(address(mezo));
        musd.mint(to, amount);
        vm.prank(to);
        musd.approve(address(vault), type(uint256).max);
    }

    function _repayAll(address who) internal {
        _mint(who, vault.accountOf(who).debt); // covers fees the borrower never received
        vm.prank(who);
        vault.repay(type(uint256).max, address(0), address(0));
    }

    function _withdrawAll(address who) internal {
        uint256 c = vault.accountOf(who).coll;
        vm.prank(who);
        vault.withdraw(c, address(0), address(0));
    }

    // ---- shutdown

    function test_shutdownIsOwnerOnlyAndOnce() public {
        vm.prank(amaka);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, amaka));
        vault.shutdown();
        vm.prank(owner);
        vault.shutdown();
        assertEq(vault.shutdownAt(), block.timestamp);
        vm.prank(owner);
        vm.expectRevert(TinyVault.IsShutdown.selector);
        vault.shutdown();
    }

    function test_shutdownStopsNewLoansButNotRepaying() public {
        _open(amaka, 300, 100e18);
        vm.prank(owner);
        vault.shutdown();

        vm.startPrank(tunde);
        vm.expectRevert(TinyVault.IsShutdown.selector);
        vault.deposit{value: 0.01 ether}(address(0), address(0));
        vm.expectRevert(TinyVault.IsShutdown.selector);
        vault.borrow(10e18, address(0), address(0));
        vm.stopPrank();

        _repayAll(amaka);
        assertEq(vault.accountOf(amaka).debt, 0);
        uint256 before = amaka.balance;
        _withdrawAll(amaka);
        assertEq(amaka.balance - before, _btc(300));
    }

    // ---- H-01: the full wind-down, nothing left frozen

    function test_windDownReturnsEveryBtcAndTheReserve() public {
        _open(amaka, 300, 100e18);
        _open(tunde, 900, 400e18);
        mezo.accrue(address(vault), 3e18); // interest builds up before the shutdown
        uint256 reserve = vault.reserve();
        assertEq(reserve, 2.5e18); // 0.5% of 500

        vm.prank(owner);
        vault.shutdown();
        _repayAll(amaka);
        _repayAll(tunde);
        _repayAll(owner); // the anchor repays its 1,800 too

        // Nobody owes; anyone can close the trove. The vault's MUSD covers it.
        vm.prank(closer);
        vault.closeTrove();
        assertTrue(vault.closed());
        assertTrue(vault.woundDown());
        assertEq(uint8(mezo.getTroveStatus(address(vault))), uint8(MockMezo.Status.closedByOwner));
        assertEq(vault.idle(), 0);

        // Every account takes all its BTC back.
        _withdrawAll(amaka);
        _withdrawAll(tunde);
        _withdrawAll(owner);
        assertEq(amaka.balance, 10 ether);
        assertEq(tunde.balance, 10 ether);
        assertEq(owner.balance, 10 ether);
        assertLe(address(vault).balance, DUST);

        // The reserve is released to the owner, and the vault holds no MUSD it cannot account for.
        assertApproxEqAbs(vault.reserve(), reserve, DUST); // less the dead shares' few wei of interest
        vm.prank(owner);
        vault.withdrawReserve(owner, type(uint256).max);
        assertEq(vault.reserve(), 0);
        assertEq(musd.balanceOf(address(vault)), 0);
    }

    function test_closeTroveNeedsShutdownAndNoDebt() public {
        _open(amaka, 300, 100e18);
        vm.expectRevert(TinyVault.NotShutdown.selector);
        vault.closeTrove();
        vm.prank(owner);
        vault.shutdown();
        _repayAll(owner);
        vm.expectRevert(TinyVault.DebtOutstanding.selector); // amaka still owes
        vault.closeTrove();
    }

    function test_reserveStaysLockedUntilWoundDown() public {
        _open(amaka, 300, 100e18);
        vm.prank(owner);
        vm.expectRevert(TinyVault.NotShutdown.selector);
        vault.withdrawReserve(owner, 1);
    }

    function test_callerTopsUpInterestIfTheReserveIsEmpty() public {
        vm.prank(owner);
        vault.setReserveFee(0);
        _open(amaka, 300, 100e18);
        vm.prank(owner);
        vault.shutdown();
        _repayAll(amaka);
        _repayAll(owner);
        mezo.accrue(address(vault), 1e15); // interest after the last repayment
        _mint(closer, 1e18);
        uint256 before = musd.balanceOf(closer);
        vm.prank(closer);
        vault.closeTrove();
        assertApproxEqAbs(before - musd.balanceOf(closer), 1e15, DUST);
        assertTrue(vault.woundDown());
    }

    // ---- forced closes after the grace period

    function test_afterGraceAnyAccountThatStillOwesCanBeClosed() public {
        _open(amaka, 300, 100e18); // healthy at 300%
        vm.prank(owner);
        vault.shutdown();
        _mint(closer, 1_000e18);

        vm.prank(closer);
        vm.expectRevert(TinyVault.Healthy.selector);
        vault.closeAccount(amaka, address(0), address(0));

        vm.warp(block.timestamp + 7 days);
        uint256 debt = vault.accountOf(amaka).debt;
        vm.prank(closer);
        vault.closeAccount(amaka, address(0), address(0));
        assertEq(vault.accountOf(amaka).debt, 0);
        // amaka keeps the BTC beyond debt + 5%
        assertApproxEqAbs(vault.accountOf(amaka).coll, _btc(300) - debt * 1.05e18 / PRICE, 1e6);

        _repayAll(owner);
        vault.closeTrove();
        _withdrawAll(amaka);
    }

    // ---- Mezo Recovery Mode

    function test_recoveryModeBlocksWithdrawalsWithAClearError() public {
        _open(amaka, 300, 50e18);
        mezo.setRecovery(true);
        assertTrue(vault.recoveryMode());
        vm.prank(amaka);
        vm.expectRevert(TinyVault.RecoveryMode.selector);
        vault.withdraw(1, address(0), address(0));
        vm.prank(amaka);
        vm.expectRevert(TinyVault.RecoveryMode.selector);
        vault.borrow(10e18, address(0), address(0));
    }

    function test_recoveryModeStillLendsOutHeldMusd() public {
        _open(amaka, 300, 100e18);
        _repayAll(owner); // 1,800 goes to idle: Mezo will not take the trove below its minimum
        assertGt(vault.idle(), 1_000e18);
        mezo.setRecovery(true);
        _open(tunde, 300, 50e18); // comes from idle, Mezo is never asked to lend more
        assertEq(musd.balanceOf(tunde), 50e18);
    }

    function test_closeAccountWorksInRecoveryMode() public {
        _open(amaka, 300, 190e18); // near the 150% limit
        feed.set(PRICE * 75 / 100); // BTC -25%: amaka falls below 125%
        mezo.setRecovery(true);
        _mint(closer, 1_000e18);

        uint256 debt = vault.accountOf(amaka).debt;
        uint256 coll0 = vault.trackedColl();
        vm.prank(closer);
        vault.closeAccount(amaka, address(0), address(0));

        // The debt is repaid; the BTC cannot leave Mezo, so the closer owns it in the vault.
        assertEq(vault.accountOf(amaka).debt, 0);
        uint256 credited = vault.accountOf(closer).coll;
        assertApproxEqAbs(credited, debt * 1.05e18 / (PRICE * 75 / 100), 1e6);
        assertEq(vault.trackedColl(), coll0);
        assertEq(closer.balance, 0);

        // When Recovery Mode ends the closer takes it out.
        mezo.setRecovery(false);
        _withdrawAll(closer);
        assertEq(closer.balance, credited);
    }

    function test_closeTroveWaitsForRecoveryModeToEnd() public {
        vm.prank(owner);
        vault.shutdown();
        _repayAll(owner);
        mezo.setRecovery(true);
        _mint(closer, 1e18); // the dead shares' few wei of debt
        vm.prank(closer);
        vm.expectRevert(TinyVault.RecoveryMode.selector);
        vault.closeTrove();
        mezo.setRecovery(false);
        vm.prank(closer);
        vault.closeTrove();
        assertTrue(vault.woundDown());
    }

    // ---- Mezo closes the trove itself: held MUSD goes back to the debt holders

    function test_heldMusdIsSharedWhenMezoLiquidates() public {
        _open(amaka, 300, 100e18);
        _repayAll(owner); // the anchor's 1,800 sits as idle MUSD
        uint256 held = vault.idle() + vault.reserve();
        uint256 sa = vault.claimableMusd(amaka);
        assertEq(sa, 0);

        mezo.liquidate(address(vault));
        vault.sync();
        assertTrue(vault.closed());
        assertEq(vault.idle(), 0);
        assertEq(vault.reserve(), 0);

        // Only amaka still has debt shares; the anchor repaid. She gets the held MUSD.
        uint256 claim = vault.claimableMusd(amaka);
        assertApproxEqAbs(claim, held, 1e6);
        vm.prank(amaka);
        vault.claimMusd();
        assertApproxEqAbs(musd.balanceOf(amaka), 100e18 + held, 1e6);
        vm.prank(amaka);
        vm.expectRevert(TinyVault.NothingToClaim.selector);
        vault.claimMusd();
        vm.prank(owner);
        vm.expectRevert(TinyVault.NothingToClaim.selector);
        vault.claimMusd();
    }
}
