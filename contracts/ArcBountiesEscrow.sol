// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @title Arc Bounties Escrow
/// @notice Sponsor-funded ERC-20 bounties with permissionless, first-come proof submission.
/// @dev Intended for Arc Testnet USDC (6 decimals); the token is constructor-configured.
///      Review has no timeout or dispute resolution: only the sponsor can release payment.
contract ArcBountiesEscrow {
    using SafeERC20 for IERC20;

    enum Status { Open, Review, Paid, Cancelled }

    struct Bounty {
        address sponsor;
        address worker;
        uint128 reward;
        Status status;
        string metadataURI;
        string proofURI;
    }

    error ZeroAddress();
    error ZeroAmount();
    error InvalidURI(uint256 length);
    error InvalidBountyId(uint256 bountyId);
    error NotSponsor();
    error SponsorCannotSubmit();
    error InvalidStatus(Status expected, Status actual);
    error UnexpectedBalanceDelta(uint256 expected, uint256 balanceBefore, uint256 balanceAfter);
    error ReentrantCall();

    event BountyCreated(uint256 indexed id, address indexed sponsor, uint128 amount, string metadataURI);
    event ProofSubmitted(uint256 indexed id, address indexed worker, string proofURI);
    event BountyReleased(uint256 indexed id, address indexed worker, uint128 amount);
    event BountyCancelled(uint256 indexed id, address indexed sponsor, uint128 amount);
    event ProofRejected(uint256 indexed id, address indexed worker);

    /// @notice Token used for all bounty deposits and payments.
    IERC20 public immutable usdc;
    /// @notice Next identifier; valid bounty IDs are strictly below this value.
    uint256 public nextBountyId;
    /// @notice Maximum byte length of either URI.
    uint256 public constant MAX_URI_LENGTH = 8192;
    /// @notice Maximum number of records returned by a single page request.
    uint256 public constant MAX_PAGE_SIZE = 50;

    mapping(uint256 => Bounty) private _bounties;
    uint256 private _totalEscrowed;
    uint256 private _lock = 1;

    modifier nonReentrant() {
        if (_lock != 1) revert ReentrantCall();
        _lock = 2;
        _;
        _lock = 1;
    }

    /// @notice Configure the escrow's immutable ERC-20 token.
    /// @param usdc_ Token address, supplied at construction rather than hardcoded.
    constructor(address usdc_) {
        if (usdc_ == address(0)) revert ZeroAddress();
        usdc = IERC20(usdc_);
    }

    /// @notice Deposit tokens and create an open bounty after approving this escrow.
    /// @param amount Reward in the token's smallest units (6 decimals for Arc USDC).
    /// @param metadataURI Nonempty metadata URI, at most 8192 bytes.
    /// @return id Newly created bounty ID, starting at zero.
    function createBounty(uint128 amount, string calldata metadataURI)
        external nonReentrant returns (uint256 id)
    {
        if (amount == 0) revert ZeroAmount();
        _validateURI(metadataURI);
        uint256 balanceBefore = usdc.balanceOf(address(this));

        id = nextBountyId;
        nextBountyId = id + 1;
        _bounties[id] = Bounty({
            sponsor: msg.sender,
            worker: address(0),
            reward: amount,
            status: Status.Open,
            metadataURI: metadataURI,
            proofURI: ""
        });
        _totalEscrowed += amount;

        usdc.safeTransferFrom(msg.sender, address(this), amount);
        uint256 balanceAfter = usdc.balanceOf(address(this));
        if (balanceAfter < balanceBefore || balanceAfter - balanceBefore != uint256(amount)) {
            revert UnexpectedBalanceDelta(amount, balanceBefore, balanceAfter);
        }
        emit BountyCreated(id, msg.sender, amount, metadataURI);
    }

    /// @notice Claim the review slot by submitting the first proof for an open bounty.
    /// @param bountyId Existing bounty identifier.
    /// @param proofURI Nonempty proof URI, at most 8192 bytes.
    function submitProof(uint256 bountyId, string calldata proofURI) external nonReentrant {
        Bounty storage bounty = _requireBounty(bountyId);
        if (bounty.status != Status.Open) revert InvalidStatus(Status.Open, bounty.status);
        if (msg.sender == bounty.sponsor) revert SponsorCannotSubmit();
        _validateURI(proofURI);

        bounty.worker = msg.sender;
        bounty.proofURI = proofURI;
        bounty.status = Status.Review;
        emit ProofSubmitted(bountyId, msg.sender, proofURI);
    }

    /// @notice Sponsor rejects the submitted proof and reopens the bounty, so a junk
    ///         submission can never lock the escrow in Review.
    /// @param bountyId Existing bounty in Review status.
    function rejectProof(uint256 bountyId) external nonReentrant {
        Bounty storage bounty = _requireBounty(bountyId);
        if (msg.sender != bounty.sponsor) revert NotSponsor();
        if (bounty.status != Status.Review) revert InvalidStatus(Status.Review, bounty.status);

        address worker = bounty.worker;
        bounty.worker = address(0);
        bounty.proofURI = "";
        bounty.status = Status.Open;
        emit ProofRejected(bountyId, worker);
    }

    /// @notice Sponsor approves the submitted proof and pays the recorded worker.
    /// @param bountyId Existing bounty in Review status.
    function release(uint256 bountyId) external nonReentrant {
        Bounty storage bounty = _requireBounty(bountyId);
        if (msg.sender != bounty.sponsor) revert NotSponsor();
        if (bounty.status != Status.Review) revert InvalidStatus(Status.Review, bounty.status);

        address worker = bounty.worker;
        uint128 reward = bounty.reward;
        bounty.status = Status.Paid;
        _totalEscrowed -= reward;

        usdc.safeTransfer(worker, reward);
        emit BountyReleased(bountyId, worker, reward);
    }

    /// @notice Sponsor cancels an unpaid bounty and recovers its reward.
    /// @param bountyId Existing bounty in Open or Review status.
    function cancel(uint256 bountyId) external nonReentrant {
        Bounty storage bounty = _requireBounty(bountyId);
        if (msg.sender != bounty.sponsor) revert NotSponsor();
        // Open or Review: a sponsor can always recover funds, so a junk proof can never lock escrow.
        if (bounty.status != Status.Open && bounty.status != Status.Review) {
            revert InvalidStatus(Status.Open, bounty.status);
        }

        address sponsor = bounty.sponsor;
        uint128 reward = bounty.reward;
        bounty.status = Status.Cancelled;
        _totalEscrowed -= reward;

        usdc.safeTransfer(sponsor, reward);
        emit BountyCancelled(bountyId, sponsor, reward);
    }

    /// @notice Read a complete bounty, reverting if its identifier does not exist.
    /// @param bountyId Existing bounty identifier.
    /// @return bounty Stored bounty including metadata and proof URIs.
    function getBounty(uint256 bountyId) external view returns (Bounty memory bounty) {
        bounty = _requireBounty(bountyId);
    }

    /// @notice Read an ascending page, clamped to existing records and 50 entries.
    /// @param start First bounty identifier to return.
    /// @param count Requested page length; zero or an out-of-range start returns an empty page.
    /// @return page Bounties whose IDs are start through start + page.length - 1.
    function getBounties(uint256 start, uint256 count) external view returns (Bounty[] memory page) {
        uint256 total = nextBountyId;
        if (start >= total || count == 0) return new Bounty[](0);
        uint256 length = count;
        if (length > MAX_PAGE_SIZE) length = MAX_PAGE_SIZE;
        uint256 remaining = total - start;
        if (length > remaining) length = remaining;

        page = new Bounty[](length);
        for (uint256 i = 0; i < length; ++i) {
            page[i] = _bounties[start + i];
        }
    }

    /// @notice Read the aggregate rewards owed for Open and Review bounties.
    /// @dev Unsolicited token transfers are excluded from this accounting.
    /// @return amount Outstanding rewards in the token's smallest units.
    function totalEscrowed() external view returns (uint256 amount) {
        return _totalEscrowed;
    }

    function _requireBounty(uint256 bountyId) internal view returns (Bounty storage bounty) {
        if (bountyId >= nextBountyId) revert InvalidBountyId(bountyId);
        return _bounties[bountyId];
    }

    function _validateURI(string calldata uri) internal pure {
        uint256 length = bytes(uri).length;
        if (length == 0 || length > MAX_URI_LENGTH) revert InvalidURI(length);
    }
}
