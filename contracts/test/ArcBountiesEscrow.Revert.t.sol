// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ArcBountiesEscrow} from "../ArcBountiesEscrow.sol";
import {ArcBountiesEscrowTestBase, FeeToken} from "./ArcBountiesEscrow.Base.t.sol";

contract ArcBountiesEscrowRevertTest is ArcBountiesEscrowTestBase {
    ArcBountiesEscrow.Status internal constant OPEN = ArcBountiesEscrow.Status.Open;
    ArcBountiesEscrow.Status internal constant REVIEW = ArcBountiesEscrow.Status.Review;
    ArcBountiesEscrow.Status internal constant PAID = ArcBountiesEscrow.Status.Paid;
    ArcBountiesEscrow.Status internal constant CANCELLED = ArcBountiesEscrow.Status.Cancelled;

    function _invalidStatus(ArcBountiesEscrow.Status expected, ArcBountiesEscrow.Status actual)
        internal
        pure
        returns (bytes memory)
    {
        return abi.encodeWithSelector(ArcBountiesEscrow.InvalidStatus.selector, expected, actual);
    }

    // ---------- createBounty ----------
    function test_Revert_Create_ZeroAmount() public {
        vm.prank(sponsor);
        vm.expectRevert(ArcBountiesEscrow.ZeroAmount.selector);
        escrow.createBounty(0, META);
    }

    function test_Revert_Create_EmptyURI() public {
        vm.prank(sponsor);
        vm.expectRevert(abi.encodeWithSelector(ArcBountiesEscrow.InvalidURI.selector, 0));
        escrow.createBounty(REWARD, "");
    }

    function test_Revert_Create_TooLongURI() public {
        vm.prank(sponsor);
        vm.expectRevert(abi.encodeWithSelector(ArcBountiesEscrow.InvalidURI.selector, 8193));
        escrow.createBounty(REWARD, _longString(8193));
    }

    function test_Revert_Create_MissingAllowance() public {
        usdc.mint(other, REWARD);
        vm.prank(other);
        vm.expectRevert(bytes("allowance"));
        escrow.createBounty(REWARD, META);
        // nothing persisted
        assertEq(escrow.nextBountyId(), 0);
        assertEq(escrow.totalEscrowed(), 0);
    }

    function test_Revert_Create_InsufficientAllowance() public {
        usdc.mint(other, REWARD);
        vm.prank(other);
        usdc.approve(address(escrow), REWARD - 1);
        vm.prank(other);
        vm.expectRevert(bytes("allowance"));
        escrow.createBounty(REWARD, META);
    }

    function test_Revert_Create_InsufficientBalance() public {
        vm.prank(other);
        usdc.approve(address(escrow), type(uint256).max);
        vm.prank(other);
        vm.expectRevert(bytes("balance"));
        escrow.createBounty(REWARD, META);
    }

    function test_Revert_Create_FeeOnTransferToken() public {
        FeeToken ft = new FeeToken();
        ArcBountiesEscrow e = new ArcBountiesEscrow(address(ft));
        ft.mint(sponsor, 1_000e6);
        vm.prank(sponsor);
        ft.approve(address(e), type(uint256).max);
        vm.prank(sponsor);
        vm.expectRevert(
            abi.encodeWithSelector(ArcBountiesEscrow.UnexpectedBalanceDelta.selector, uint128(100e6), 0, 99e6)
        );
        e.createBounty(100e6, META);
        assertEq(e.nextBountyId(), 0);
    }

    // ---------- invalid ids ----------
    function test_Revert_InvalidId_AllFunctions_EmptyEscrow() public {
        bytes memory err = abi.encodeWithSelector(ArcBountiesEscrow.InvalidBountyId.selector, 0);
        vm.expectRevert(err);
        escrow.getBounty(0);
        vm.prank(worker);
        vm.expectRevert(err);
        escrow.submitProof(0, PROOF);
        vm.prank(sponsor);
        vm.expectRevert(err);
        escrow.release(0);
        vm.prank(sponsor);
        vm.expectRevert(err);
        escrow.cancel(0);
        vm.prank(sponsor);
        vm.expectRevert(err);
        escrow.rejectProof(0);
    }

    function test_Revert_InvalidId_EqualToNextId() public {
        _create(REWARD);
        bytes memory err = abi.encodeWithSelector(ArcBountiesEscrow.InvalidBountyId.selector, 1);
        vm.expectRevert(err);
        escrow.getBounty(1);
        vm.prank(sponsor);
        vm.expectRevert(err);
        escrow.release(1);
    }

    function testFuzz_Revert_InvalidId(uint256 id) public {
        _create(REWARD);
        id = bound(id, 1, type(uint256).max);
        vm.expectRevert(abi.encodeWithSelector(ArcBountiesEscrow.InvalidBountyId.selector, id));
        escrow.getBounty(id);
    }

    // ---------- submitProof ----------
    function test_Revert_Submit_SponsorCannotSubmitOwn() public {
        uint256 id = _create(REWARD);
        vm.prank(sponsor);
        vm.expectRevert(ArcBountiesEscrow.SponsorCannotSubmit.selector);
        escrow.submitProof(id, PROOF);
    }

    function test_Revert_Submit_EmptyProofURI() public {
        uint256 id = _create(REWARD);
        vm.prank(worker);
        vm.expectRevert(abi.encodeWithSelector(ArcBountiesEscrow.InvalidURI.selector, 0));
        escrow.submitProof(id, "");
    }

    function test_Revert_Submit_TooLongProofURI() public {
        uint256 id = _create(REWARD);
        vm.prank(worker);
        vm.expectRevert(abi.encodeWithSelector(ArcBountiesEscrow.InvalidURI.selector, 8193));
        escrow.submitProof(id, _longString(8193));
    }

    function test_Revert_Submit_WhenInReview_FirstComeOnly() public {
        uint256 id = _toReview();
        vm.prank(worker2);
        vm.expectRevert(_invalidStatus(OPEN, REVIEW));
        escrow.submitProof(id, PROOF);
        assertEq(escrow.getBounty(id).worker, worker);
    }

    function test_Revert_Submit_WhenPaid() public {
        uint256 id = _toPaid();
        vm.prank(worker2);
        vm.expectRevert(_invalidStatus(OPEN, PAID));
        escrow.submitProof(id, PROOF);
    }

    function test_Revert_Submit_WhenCancelled() public {
        uint256 id = _toCancelled();
        vm.prank(worker);
        vm.expectRevert(_invalidStatus(OPEN, CANCELLED));
        escrow.submitProof(id, PROOF);
    }

    // ---------- release ----------
    function test_Revert_Release_NonSponsor() public {
        uint256 id = _toReview();
        vm.prank(worker);
        vm.expectRevert(ArcBountiesEscrow.NotSponsor.selector);
        escrow.release(id);
        vm.prank(other);
        vm.expectRevert(ArcBountiesEscrow.NotSponsor.selector);
        escrow.release(id);
    }

    function test_Revert_Release_WhenOpen() public {
        uint256 id = _create(REWARD);
        vm.prank(sponsor);
        vm.expectRevert(_invalidStatus(REVIEW, OPEN));
        escrow.release(id);
    }

    function test_Revert_Release_WhenPaid_NoDoublePay() public {
        uint256 id = _toPaid();
        vm.prank(sponsor);
        vm.expectRevert(_invalidStatus(REVIEW, PAID));
        escrow.release(id);
    }

    function test_Revert_Release_WhenCancelled() public {
        uint256 id = _toCancelled();
        vm.prank(sponsor);
        vm.expectRevert(_invalidStatus(REVIEW, CANCELLED));
        escrow.release(id);
    }

    // ---------- cancel ----------
    function test_Revert_Cancel_NonSponsor() public {
        uint256 id = _create(REWARD);
        vm.prank(other);
        vm.expectRevert(ArcBountiesEscrow.NotSponsor.selector);
        escrow.cancel(id);
        uint256 id2 = _toReview();
        vm.prank(worker);
        vm.expectRevert(ArcBountiesEscrow.NotSponsor.selector);
        escrow.cancel(id2);
    }

    function test_Revert_Cancel_WhenPaid() public {
        uint256 id = _toPaid();
        vm.prank(sponsor);
        vm.expectRevert(_invalidStatus(OPEN, PAID));
        escrow.cancel(id);
    }

    function test_Revert_Cancel_WhenAlreadyCancelled_NoDoubleRefund() public {
        uint256 id = _toCancelled();
        vm.prank(sponsor);
        vm.expectRevert(_invalidStatus(OPEN, CANCELLED));
        escrow.cancel(id);
    }

    // ---------- rejectProof ----------
    function test_Revert_Reject_NonSponsor() public {
        uint256 id = _toReview();
        vm.prank(worker);
        vm.expectRevert(ArcBountiesEscrow.NotSponsor.selector);
        escrow.rejectProof(id);
        vm.prank(other);
        vm.expectRevert(ArcBountiesEscrow.NotSponsor.selector);
        escrow.rejectProof(id);
    }

    function test_Revert_Reject_WhenOpen() public {
        uint256 id = _create(REWARD);
        vm.prank(sponsor);
        vm.expectRevert(_invalidStatus(REVIEW, OPEN));
        escrow.rejectProof(id);
    }

    function test_Revert_Reject_WhenPaid() public {
        uint256 id = _toPaid();
        vm.prank(sponsor);
        vm.expectRevert(_invalidStatus(REVIEW, PAID));
        escrow.rejectProof(id);
    }

    function test_Revert_Reject_WhenCancelled() public {
        uint256 id = _toCancelled();
        vm.prank(sponsor);
        vm.expectRevert(_invalidStatus(REVIEW, CANCELLED));
        escrow.rejectProof(id);
    }

    // Another sponsor cannot touch someone else's bounty
    function test_Revert_OtherSponsorCannotManageForeignBounty() public {
        uint256 id = _toReview();
        usdc.mint(other, REWARD);
        vm.startPrank(other);
        usdc.approve(address(escrow), type(uint256).max);
        escrow.createBounty(REWARD, META);
        vm.expectRevert(ArcBountiesEscrow.NotSponsor.selector);
        escrow.release(id);
        vm.expectRevert(ArcBountiesEscrow.NotSponsor.selector);
        escrow.cancel(id);
        vm.stopPrank();
    }
}
