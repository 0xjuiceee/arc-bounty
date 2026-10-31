// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {ArcBountiesEscrow} from "../ArcBountiesEscrow.sol";
import {MockERC20} from "./ArcBountiesEscrow.Base.t.sol";

/// @dev Drives bounded random lifecycles. The handler is the sponsor.
contract EscrowHandler is Test {
    ArcBountiesEscrow public escrow;
    MockERC20 public usdc;
    address public constant WORKER = address(0xBEEF01);
    address public constant WORKER2 = address(0xBEEF02);
    uint256 public ghostCreated;

    constructor(ArcBountiesEscrow e, MockERC20 t) {
        escrow = e;
        usdc = t;
        usdc.approve(address(e), type(uint256).max);
    }

    function create(uint128 amount) external {
        amount = uint128(bound(amount, 1, 1e12));
        usdc.mint(address(this), amount);
        escrow.createBounty(amount, "ipfs://m");
        ghostCreated += amount;
    }

    function submit(uint256 seed, bool second) external {
        uint256 n = escrow.nextBountyId();
        if (n == 0) return;
        vm.prank(second ? WORKER2 : WORKER);
        try escrow.submitProof(seed % n, "ipfs://p") {} catch {}
    }

    function reject(uint256 seed) external {
        uint256 n = escrow.nextBountyId();
        if (n == 0) return;
        try escrow.rejectProof(seed % n) {} catch {}
    }

    function release(uint256 seed) external {
        uint256 n = escrow.nextBountyId();
        if (n == 0) return;
        try escrow.release(seed % n) {} catch {}
    }

    function cancel(uint256 seed) external {
        uint256 n = escrow.nextBountyId();
        if (n == 0) return;
        try escrow.cancel(seed % n) {} catch {}
    }
}

contract ArcBountiesEscrowInvariantTest is Test {
    ArcBountiesEscrow internal escrow;
    MockERC20 internal usdc;
    EscrowHandler internal handler;

    function setUp() public {
        usdc = new MockERC20();
        escrow = new ArcBountiesEscrow(address(usdc));
        handler = new EscrowHandler(escrow, usdc);
        targetContract(address(handler));
    }

    /// Sums rewards by status across every bounty.
    function _sums() internal view returns (uint256 live, uint256 paid, uint256 cancelled) {
        uint256 n = escrow.nextBountyId();
        for (uint256 i = 0; i < n; i++) {
            ArcBountiesEscrow.Bounty memory b = escrow.getBounty(i);
            if (b.status == ArcBountiesEscrow.Status.Open || b.status == ArcBountiesEscrow.Status.Review) {
                live += b.reward;
            } else if (b.status == ArcBountiesEscrow.Status.Paid) {
                paid += b.reward;
            } else {
                cancelled += b.reward;
            }
        }
    }

    // totalEscrowed == sum of Open+Review rewards == token held by escrow
    function invariant_TotalEscrowedMatchesLiveBountiesAndBalance() public view {
        (uint256 live,,) = _sums();
        assertEq(escrow.totalEscrowed(), live);
        assertEq(usdc.balanceOf(address(escrow)), live);
    }

    // conservation: every token ever deposited is escrowed, paid out, or refunded
    function invariant_FundsConserved() public view {
        (uint256 live, uint256 paid, uint256 cancelled) = _sums();
        assertEq(handler.ghostCreated(), live + paid + cancelled);
        assertEq(usdc.balanceOf(handler.WORKER()) + usdc.balanceOf(handler.WORKER2()), paid);
        assertEq(usdc.balanceOf(address(handler)), cancelled);
    }
}
