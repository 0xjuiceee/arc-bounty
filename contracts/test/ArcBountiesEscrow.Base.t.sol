// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {ArcBountiesEscrow} from "../ArcBountiesEscrow.sol";

/// @dev Simple 6-decimals ERC-20 mock with open mint.
contract MockERC20 {
    string public name = "Mock USDC";
    string public symbol = "mUSDC";
    uint8 public constant decimals = 6;
    uint256 public totalSupply;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    function mint(address to, uint256 amount) public {
        totalSupply += amount;
        balanceOf[to] += amount;
        emit Transfer(address(0), to, amount);
    }

    function approve(address spender, uint256 amount) public returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function transfer(address to, uint256 amount) public virtual returns (bool) {
        _move(msg.sender, to, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) public virtual returns (bool) {
        uint256 a = allowance[from][msg.sender];
        require(a >= amount, "allowance");
        if (a != type(uint256).max) allowance[from][msg.sender] = a - amount;
        _move(from, to, amount);
        return true;
    }

    function _move(address from, address to, uint256 amount) internal virtual {
        require(balanceOf[from] >= amount, "balance");
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        emit Transfer(from, to, amount);
    }
}

/// @dev Token that re-enters the escrow with a preset payload during transfer/transferFrom.
contract ReentrantToken is MockERC20 {
    address public target;
    bytes public payload;
    bool public armed;
    bool public bubble; // true: revert if reentry fails; false: swallow and record
    bool public lastOk;
    bytes public lastRet;
    uint256 public attempts;

    function arm(address target_, bytes calldata payload_, bool bubble_) external {
        target = target_;
        payload = payload_;
        bubble = bubble_;
        armed = true;
    }

    function _attack() internal {
        if (!armed) return;
        armed = false; // single attempt
        attempts++;
        (bool ok, bytes memory ret) = target.call(payload);
        lastOk = ok;
        lastRet = ret;
        if (!ok && bubble) {
            assembly { revert(add(ret, 32), mload(ret)) }
        }
    }

    function transfer(address to, uint256 amount) public override returns (bool) {
        _attack();
        return super.transfer(to, amount);
    }

    function transferFrom(address from, address to, uint256 amount) public override returns (bool) {
        _attack();
        return super.transferFrom(from, to, amount);
    }
}

/// @dev Token that skims a fee on transferFrom (escrow receives less than requested).
contract FeeToken is MockERC20 {
    function _move(address from, address to, uint256 amount) internal override {
        require(balanceOf[from] >= amount, "balance");
        uint256 fee = amount / 100;
        balanceOf[from] -= amount;
        balanceOf[to] += amount - fee;
        totalSupply -= fee;
    }
}

abstract contract ArcBountiesEscrowTestBase is Test {
    ArcBountiesEscrow internal escrow;
    MockERC20 internal usdc;

    address internal sponsor = makeAddr("sponsor");
    address internal worker = makeAddr("worker");
    address internal worker2 = makeAddr("worker2");
    address internal other = makeAddr("other");

    string internal constant META = "ipfs://meta";
    string internal constant PROOF = "ipfs://proof";
    uint128 internal constant REWARD = 100e6;

    function setUp() public virtual {
        usdc = new MockERC20();
        escrow = new ArcBountiesEscrow(address(usdc));
        usdc.mint(sponsor, 1_000_000e6);
        vm.prank(sponsor);
        usdc.approve(address(escrow), type(uint256).max);
    }

    function _create(uint128 amount) internal returns (uint256 id) {
        vm.prank(sponsor);
        id = escrow.createBounty(amount, META);
    }

    function _submit(uint256 id, address who) internal {
        vm.prank(who);
        escrow.submitProof(id, PROOF);
    }

    function _toReview() internal returns (uint256 id) {
        id = _create(REWARD);
        _submit(id, worker);
    }

    function _toPaid() internal returns (uint256 id) {
        id = _toReview();
        vm.prank(sponsor);
        escrow.release(id);
    }

    function _toCancelled() internal returns (uint256 id) {
        id = _create(REWARD);
        vm.prank(sponsor);
        escrow.cancel(id);
    }

    function _longString(uint256 n) internal pure returns (string memory) {
        return string(new bytes(n)); // zero bytes, length n
    }
}
