// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ArcBountiesEscrow} from "../ArcBountiesEscrow.sol";
import {ArcBountiesEscrowTestBase, ReentrantToken} from "./ArcBountiesEscrow.Base.t.sol";

contract ArcBountiesEscrowAccountingTest is ArcBountiesEscrowTestBase {
    // ---------- getBounties paging ----------
    function _seed(uint256 n) internal {
        for (uint256 i = 0; i < n; i++) {
            _create(uint128(i + 1)); // reward = id + 1 identifies the record
        }
    }

    function test_GetBounties_EmptyWhenNoBounties() public view {
        assertEq(escrow.getBounties(0, 10).length, 0);
    }

    function test_GetBounties_FirstPage() public {
        _seed(60);
        ArcBountiesEscrow.Bounty[] memory page = escrow.getBounties(0, 10);
        assertEq(page.length, 10);
        for (uint256 i = 0; i < 10; i++) {
            assertEq(page[i].reward, i + 1);
        }
    }

    function test_GetBounties_MiddlePage() public {
        _seed(60);
        ArcBountiesEscrow.Bounty[] memory page = escrow.getBounties(20, 5);
        assertEq(page.length, 5);
        for (uint256 i = 0; i < 5; i++) {
            assertEq(page[i].reward, 21 + i);
        }
    }

    function test_GetBounties_ClampsToMaxPageSize() public {
        _seed(60);
        ArcBountiesEscrow.Bounty[] memory page = escrow.getBounties(0, 1000);
        assertEq(page.length, 50);
        assertEq(page[49].reward, 50);
    }

    function test_GetBounties_ClampsToRemaining() public {
        _seed(60);
        ArcBountiesEscrow.Bounty[] memory page = escrow.getBounties(55, 50);
        assertEq(page.length, 5);
        assertEq(page[4].reward, 60);
    }

    function test_GetBounties_StartOutOfRangeOrZeroCountReturnsEmpty() public {
        _seed(3);
        assertEq(escrow.getBounties(3, 5).length, 0);
        assertEq(escrow.getBounties(type(uint256).max, 5).length, 0);
        assertEq(escrow.getBounties(0, 0).length, 0);
        assertEq(escrow.getBounties(1, type(uint256).max).length, 2);
    }

    function test_GetBounties_ReflectsStatusChanges() public {
        uint256 a = _toPaid();
        uint256 b = _toCancelled();
        uint256 c = _toReview();
        ArcBountiesEscrow.Bounty[] memory page = escrow.getBounties(0, 10);
        assertEq(page.length, 3);
        assertEq(uint8(page[a].status), uint8(ArcBountiesEscrow.Status.Paid));
        assertEq(uint8(page[b].status), uint8(ArcBountiesEscrow.Status.Cancelled));
        assertEq(uint8(page[c].status), uint8(ArcBountiesEscrow.Status.Review));
    }

    // ---------- totalEscrowed accounting ----------
    function test_TotalEscrowed_TracksLifecycle() public {
        uint256 a = _create(10e6);
        uint256 b = _create(20e6);
        uint256 c = _create(30e6);
        assertEq(escrow.totalEscrowed(), 60e6);

        _submit(b, worker);
        assertEq(escrow.totalEscrowed(), 60e6); // Review still escrowed

        vm.prank(sponsor);
        escrow.release(b);
        assertEq(escrow.totalEscrowed(), 40e6);

        vm.prank(sponsor);
        escrow.cancel(a);
        assertEq(escrow.totalEscrowed(), 30e6);

        _submit(c, worker2);
        vm.prank(sponsor);
        escrow.rejectProof(c);
        assertEq(escrow.totalEscrowed(), 30e6); // reject does not move funds
        vm.prank(sponsor);
        escrow.cancel(c);
        assertEq(escrow.totalEscrowed(), 0);
        assertEq(usdc.balanceOf(address(escrow)), 0);
    }

    function test_TotalEscrowed_ExcludesUnsolicitedTransfers() public {
        _create(REWARD);
        usdc.mint(address(escrow), 5e6); // donation
        assertEq(escrow.totalEscrowed(), REWARD);
        assertEq(usdc.balanceOf(address(escrow)), uint256(REWARD) + 5e6);
        // a donation must not break create's balance-delta check or payouts
        uint256 id = _create(7e6);
        _submit(id, worker);
        vm.prank(sponsor);
        escrow.release(id);
        assertEq(usdc.balanceOf(worker), 7e6);
        assertEq(escrow.totalEscrowed(), REWARD);
    }

    // ---------- reentrancy via malicious token ----------
    function _reentrantSetup() internal returns (ReentrantToken t, ArcBountiesEscrow e) {
        t = new ReentrantToken();
        e = new ArcBountiesEscrow(address(t));
        t.mint(sponsor, 1_000e6);
        vm.prank(sponsor);
        t.approve(address(e), type(uint256).max);
    }

    function test_Reentrancy_CreateBounty_ReenterCreate_Blocked() public {
        (ReentrantToken t, ArcBountiesEscrow e) = _reentrantSetup();
        t.arm(address(e), abi.encodeCall(ArcBountiesEscrow.createBounty, (uint128(1), "x")), true);
        vm.prank(sponsor);
        vm.expectRevert(ArcBountiesEscrow.ReentrantCall.selector);
        e.createBounty(100e6, META);
        assertEq(e.nextBountyId(), 0);
        assertEq(e.totalEscrowed(), 0);
    }

    function test_Reentrancy_CreateBounty_SwallowedAttemptDoesNotCorruptState() public {
        (ReentrantToken t, ArcBountiesEscrow e) = _reentrantSetup();
        t.arm(address(e), abi.encodeCall(ArcBountiesEscrow.createBounty, (uint128(1), "x")), false);
        vm.prank(sponsor);
        uint256 id = e.createBounty(100e6, META);
        assertEq(t.attempts(), 1);
        assertFalse(t.lastOk());
        assertEq(bytes4(t.lastRet()), ArcBountiesEscrow.ReentrantCall.selector);
        assertEq(id, 0);
        assertEq(e.nextBountyId(), 1);
        assertEq(e.totalEscrowed(), 100e6);
        assertEq(t.balanceOf(address(e)), 100e6);
    }

    function test_Reentrancy_Release_ReenterRelease_Blocked() public {
        (ReentrantToken t, ArcBountiesEscrow e) = _reentrantSetup();
        vm.prank(sponsor);
        uint256 id = e.createBounty(100e6, META);
        vm.prank(worker);
        e.submitProof(id, PROOF);

        t.arm(address(e), abi.encodeCall(ArcBountiesEscrow.release, (id)), true);
        vm.prank(sponsor);
        vm.expectRevert(ArcBountiesEscrow.ReentrantCall.selector);
        e.release(id);
        // whole call reverted -> still in Review, funds intact
        assertEq(uint8(e.getBounty(id).status), uint8(ArcBountiesEscrow.Status.Review));
        assertEq(e.totalEscrowed(), 100e6);
        assertEq(t.balanceOf(worker), 0);
    }

    function test_Reentrancy_Release_SwallowedAttempt_PaysExactlyOnce() public {
        (ReentrantToken t, ArcBountiesEscrow e) = _reentrantSetup();
        vm.startPrank(sponsor);
        uint256 id = e.createBounty(100e6, META);
        e.createBounty(50e6, META); // second bounty's funds must stay safe
        vm.stopPrank();
        vm.prank(worker);
        e.submitProof(id, PROOF);

        t.arm(address(e), abi.encodeCall(ArcBountiesEscrow.cancel, (id)), false);
        vm.prank(sponsor);
        e.release(id);
        assertFalse(t.lastOk());
        assertEq(bytes4(t.lastRet()), ArcBountiesEscrow.ReentrantCall.selector);
        assertEq(t.balanceOf(worker), 100e6);
        assertEq(t.balanceOf(address(e)), 50e6);
        assertEq(e.totalEscrowed(), 50e6);
        assertEq(uint8(e.getBounty(id).status), uint8(ArcBountiesEscrow.Status.Paid));
    }

    function test_Reentrancy_Cancel_ReenterCancel_Blocked() public {
        (ReentrantToken t, ArcBountiesEscrow e) = _reentrantSetup();
        vm.startPrank(sponsor);
        uint256 id = e.createBounty(100e6, META);
        e.createBounty(50e6, META);
        vm.stopPrank();

        t.arm(address(e), abi.encodeCall(ArcBountiesEscrow.cancel, (id)), true);
        vm.prank(sponsor);
        vm.expectRevert(ArcBountiesEscrow.ReentrantCall.selector);
        e.cancel(id);
        assertEq(e.totalEscrowed(), 150e6);
        assertEq(t.balanceOf(address(e)), 150e6);
    }

    function test_Reentrancy_Cancel_SwallowedAttempt_RefundsOnce() public {
        (ReentrantToken t, ArcBountiesEscrow e) = _reentrantSetup();
        vm.startPrank(sponsor);
        uint256 id = e.createBounty(100e6, META);
        e.createBounty(50e6, META);
        vm.stopPrank();
        uint256 before = t.balanceOf(sponsor);

        t.arm(address(e), abi.encodeCall(ArcBountiesEscrow.cancel, (id)), false);
        vm.prank(sponsor);
        e.cancel(id);
        assertEq(t.balanceOf(sponsor), before + 100e6);
        assertEq(t.balanceOf(address(e)), 50e6);
        assertEq(e.totalEscrowed(), 50e6);
    }

    function test_Reentrancy_LockReleasedAfterCall() public {
        (ReentrantToken t, ArcBountiesEscrow e) = _reentrantSetup();
        t.arm(address(e), abi.encodeCall(ArcBountiesEscrow.createBounty, (uint128(1), "x")), false);
        vm.startPrank(sponsor);
        e.createBounty(10e6, META);
        // a normal follow-up call must work (lock reset to unlocked)
        e.createBounty(10e6, META);
        e.cancel(0);
        vm.stopPrank();
        assertEq(e.totalEscrowed(), 10e6);
    }

    // ---------- fuzz ----------
    function testFuzz_CreateRelease_MovesExactAmount(uint128 amount) public {
        amount = uint128(bound(amount, 1, type(uint128).max));
        usdc.mint(sponsor, amount);
        uint256 sponsorBefore = usdc.balanceOf(sponsor);
        vm.prank(sponsor);
        uint256 id = escrow.createBounty(amount, META);
        assertEq(escrow.totalEscrowed(), amount);
        assertEq(usdc.balanceOf(address(escrow)), amount);
        assertEq(usdc.balanceOf(sponsor), sponsorBefore - amount);

        _submit(id, worker);
        vm.prank(sponsor);
        escrow.release(id);
        assertEq(usdc.balanceOf(worker), amount);
        assertEq(usdc.balanceOf(address(escrow)), 0);
        assertEq(escrow.totalEscrowed(), 0);
    }

    function testFuzz_CreateCancel_RefundsExactAmount(uint128 amount, bool viaReview) public {
        amount = uint128(bound(amount, 1, type(uint128).max));
        usdc.mint(sponsor, amount);
        uint256 sponsorBefore = usdc.balanceOf(sponsor);
        uint256 id = _create(amount);
        if (viaReview) _submit(id, worker);
        vm.prank(sponsor);
        escrow.cancel(id);
        assertEq(usdc.balanceOf(sponsor), sponsorBefore);
        assertEq(usdc.balanceOf(worker), 0);
        assertEq(escrow.totalEscrowed(), 0);
    }

    function testFuzz_TotalEscrowed_SumOfTwoAndPartialExit(uint128 a, uint128 b) public {
        a = uint128(bound(a, 1, type(uint128).max));
        b = uint128(bound(b, 1, type(uint128).max));
        usdc.mint(sponsor, uint256(a) + b);
        uint256 ida = _create(a);
        _create(b);
        assertEq(escrow.totalEscrowed(), uint256(a) + b);
        vm.prank(sponsor);
        escrow.cancel(ida);
        assertEq(escrow.totalEscrowed(), b);
        assertEq(usdc.balanceOf(address(escrow)), b);
    }

    function testFuzz_UriLengthBoundary(uint256 len) public {
        len = bound(len, 0, 9000);
        vm.prank(sponsor);
        if (len == 0 || len > 8192) {
            vm.expectRevert(abi.encodeWithSelector(ArcBountiesEscrow.InvalidURI.selector, len));
            escrow.createBounty(REWARD, _longString(len));
        } else {
            escrow.createBounty(REWARD, _longString(len));
            assertEq(escrow.nextBountyId(), 1);
        }
    }
}
