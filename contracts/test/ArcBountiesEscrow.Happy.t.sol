// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ArcBountiesEscrow} from "../ArcBountiesEscrow.sol";
import {ArcBountiesEscrowTestBase} from "./ArcBountiesEscrow.Base.t.sol";

contract ArcBountiesEscrowHappyTest is ArcBountiesEscrowTestBase {
    // ---------- constructor ----------
    function test_Constructor_StoresTokenAndStartsEmpty() public view {
        assertEq(address(escrow.usdc()), address(usdc));
        assertEq(escrow.nextBountyId(), 0);
        assertEq(escrow.totalEscrowed(), 0);
        assertEq(escrow.MAX_URI_LENGTH(), 8192);
        assertEq(escrow.MAX_PAGE_SIZE(), 50);
    }

    function test_Constructor_RevertsOnZeroAddress() public {
        vm.expectRevert(ArcBountiesEscrow.ZeroAddress.selector);
        new ArcBountiesEscrow(address(0));
    }

    // ---------- createBounty ----------
    function test_CreateBounty_StoresBountyAndEscrowsFunds() public {
        uint256 before = usdc.balanceOf(sponsor);
        uint256 id = _create(REWARD);
        assertEq(id, 0);
        assertEq(escrow.nextBountyId(), 1);
        assertEq(escrow.totalEscrowed(), REWARD);
        assertEq(usdc.balanceOf(address(escrow)), REWARD);
        assertEq(usdc.balanceOf(sponsor), before - REWARD);

        ArcBountiesEscrow.Bounty memory b = escrow.getBounty(id);
        assertEq(b.sponsor, sponsor);
        assertEq(b.worker, address(0));
        assertEq(b.reward, REWARD);
        assertEq(uint8(b.status), uint8(ArcBountiesEscrow.Status.Open));
        assertEq(b.metadataURI, META);
        assertEq(b.proofURI, "");
    }

    function test_CreateBounty_IdsIncrement() public {
        assertEq(_create(1), 0);
        assertEq(_create(2), 1);
        assertEq(_create(3), 2);
        assertEq(escrow.nextBountyId(), 3);
    }

    function test_CreateBounty_AcceptsMaxLengthURI() public {
        vm.prank(sponsor);
        uint256 id = escrow.createBounty(REWARD, _longString(8192));
        assertEq(bytes(escrow.getBounty(id).metadataURI).length, 8192);
    }

    function test_CreateBounty_EmitsEvent() public {
        vm.expectEmit(true, true, false, true, address(escrow));
        emit ArcBountiesEscrow.BountyCreated(0, sponsor, REWARD, META);
        _create(REWARD);
    }

    // ---------- submitProof ----------
    function test_SubmitProof_MovesToReviewAndRecordsWorker() public {
        uint256 id = _create(REWARD);
        _submit(id, worker);
        ArcBountiesEscrow.Bounty memory b = escrow.getBounty(id);
        assertEq(b.worker, worker);
        assertEq(b.proofURI, PROOF);
        assertEq(uint8(b.status), uint8(ArcBountiesEscrow.Status.Review));
        assertEq(escrow.totalEscrowed(), REWARD);
    }

    function test_SubmitProof_EmitsEvent() public {
        uint256 id = _create(REWARD);
        vm.expectEmit(true, true, false, true, address(escrow));
        emit ArcBountiesEscrow.ProofSubmitted(id, worker, PROOF);
        _submit(id, worker);
    }

    function test_SubmitProof_AcceptsMaxLengthURI() public {
        uint256 id = _create(REWARD);
        vm.prank(worker);
        escrow.submitProof(id, _longString(8192));
        assertEq(bytes(escrow.getBounty(id).proofURI).length, 8192);
    }

    // ---------- release ----------
    function test_Release_PaysWorkerAndMarksPaid() public {
        uint256 id = _toReview();
        vm.prank(sponsor);
        escrow.release(id);
        assertEq(usdc.balanceOf(worker), REWARD);
        assertEq(usdc.balanceOf(address(escrow)), 0);
        assertEq(escrow.totalEscrowed(), 0);
        assertEq(uint8(escrow.getBounty(id).status), uint8(ArcBountiesEscrow.Status.Paid));
    }

    function test_Release_EmitsEvent() public {
        uint256 id = _toReview();
        vm.expectEmit(true, true, false, true, address(escrow));
        emit ArcBountiesEscrow.BountyReleased(id, worker, REWARD);
        vm.prank(sponsor);
        escrow.release(id);
    }

    // ---------- cancel ----------
    function test_Cancel_FromOpen_RefundsSponsor() public {
        uint256 before = usdc.balanceOf(sponsor);
        uint256 id = _create(REWARD);
        vm.prank(sponsor);
        escrow.cancel(id);
        assertEq(usdc.balanceOf(sponsor), before);
        assertEq(usdc.balanceOf(address(escrow)), 0);
        assertEq(escrow.totalEscrowed(), 0);
        assertEq(uint8(escrow.getBounty(id).status), uint8(ArcBountiesEscrow.Status.Cancelled));
    }

    function test_Cancel_FromReview_RefundsSponsorAndWorkerGetsNothing() public {
        uint256 before = usdc.balanceOf(sponsor);
        uint256 id = _toReview();
        vm.prank(sponsor);
        escrow.cancel(id);
        assertEq(usdc.balanceOf(sponsor), before);
        assertEq(usdc.balanceOf(worker), 0);
        assertEq(escrow.totalEscrowed(), 0);
        assertEq(uint8(escrow.getBounty(id).status), uint8(ArcBountiesEscrow.Status.Cancelled));
    }

    function test_Cancel_EmitsEvent() public {
        uint256 id = _create(REWARD);
        vm.expectEmit(true, true, false, true, address(escrow));
        emit ArcBountiesEscrow.BountyCancelled(id, sponsor, REWARD);
        vm.prank(sponsor);
        escrow.cancel(id);
    }

    // ---------- rejectProof ----------
    function test_RejectProof_ReopensAndClearsWorkerAndProof() public {
        uint256 id = _toReview();
        vm.prank(sponsor);
        escrow.rejectProof(id);
        ArcBountiesEscrow.Bounty memory b = escrow.getBounty(id);
        assertEq(b.worker, address(0));
        assertEq(b.proofURI, "");
        assertEq(uint8(b.status), uint8(ArcBountiesEscrow.Status.Open));
        assertEq(escrow.totalEscrowed(), REWARD);
        assertEq(usdc.balanceOf(address(escrow)), REWARD);
    }

    function test_RejectProof_EmitsEvent() public {
        uint256 id = _toReview();
        vm.expectEmit(true, true, false, false, address(escrow));
        emit ArcBountiesEscrow.ProofRejected(id, worker);
        vm.prank(sponsor);
        escrow.rejectProof(id);
    }

    function test_RejectThenResubmit_NewWorkerCanBePaid() public {
        uint256 id = _toReview();
        vm.prank(sponsor);
        escrow.rejectProof(id);

        vm.prank(worker2);
        escrow.submitProof(id, "ipfs://proof2");
        ArcBountiesEscrow.Bounty memory b = escrow.getBounty(id);
        assertEq(b.worker, worker2);
        assertEq(b.proofURI, "ipfs://proof2");

        vm.prank(sponsor);
        escrow.release(id);
        assertEq(usdc.balanceOf(worker2), REWARD);
        assertEq(usdc.balanceOf(worker), 0);
    }

    function test_RejectThenResubmit_SameWorkerAllowed() public {
        uint256 id = _toReview();
        vm.prank(sponsor);
        escrow.rejectProof(id);
        _submit(id, worker);
        assertEq(escrow.getBounty(id).worker, worker);
    }

    function test_RejectThenCancel_Refunds() public {
        uint256 before = usdc.balanceOf(sponsor);
        uint256 id = _toReview();
        vm.startPrank(sponsor);
        escrow.rejectProof(id);
        escrow.cancel(id);
        vm.stopPrank();
        assertEq(usdc.balanceOf(sponsor), before);
    }

    // ---------- getBounty ----------
    function test_GetBounty_ReturnsCancelledAndPaidStates() public {
        uint256 p = _toPaid();
        uint256 c = _toCancelled();
        assertEq(uint8(escrow.getBounty(p).status), uint8(ArcBountiesEscrow.Status.Paid));
        assertEq(uint8(escrow.getBounty(c).status), uint8(ArcBountiesEscrow.Status.Cancelled));
        // Paid bounty keeps worker + proof for the record
        assertEq(escrow.getBounty(p).worker, worker);
        assertEq(escrow.getBounty(p).proofURI, PROOF);
    }
}
