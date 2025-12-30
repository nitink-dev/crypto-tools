// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {AggregatorV3Interface} from "@chainlink/contracts/src/v0.8/shared/interfaces/AggregatorV3Interface.sol";

contract TestToken {
    string public name;
    string public symbol;
    uint8 public decimals;
    uint256 public totalSupply;

    // Changed: no longer immutable → can be updated
    address public owner;

    AggregatorV3Interface internal priceFeed;

    uint256 public constant MAX_PRICE_AGE = 3600 + 300; // 5 min grace period

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    // New event for ownership changes (good practice)
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    constructor(
        string memory _name,
        string memory _symbol,
        uint8 _decimals,
        address _priceFeed
    ) {
        name = _name;
        symbol = _symbol;
        decimals = _decimals;
        owner = msg.sender;                    // Deployer is initial owner
        priceFeed = AggregatorV3Interface(_priceFeed);

        emit OwnershipTransferred(address(0), msg.sender); // Optional: log initial owner
    }

    // ------------------------------------------------------------------------
    // Ownership transfer functions
    // ------------------------------------------------------------------------

    modifier onlyOwner() {
        require(msg.sender == owner, "Caller is not the owner");
        _;
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "New owner cannot be zero address");
        address oldOwner = owner;
        owner = newOwner;
        emit OwnershipTransferred(oldOwner, newOwner);
    }

    // Optional: renounce ownership (set to zero address) – irreversible!
    function renounceOwnership() external onlyOwner {
        address oldOwner = owner;
        owner = address(0);
        emit OwnershipTransferred(oldOwner, address(0));
    }

    // ------------------------------------------------------------------------
    // Rest of your contract remains unchanged
    // (getLatestPrice, unsafePrice, deposit, withdraw, transfer, approve, transferFrom, emergencyWithdraw, receive)
    // ------------------------------------------------------------------------

    function getLatestPrice() public view returns (int256 price, uint8 priceDecimals) {
        (
            uint80 roundId,
            int256 answer,
            /* uint256 startedAt */,
            uint256 updatedAt,
            uint80 answeredInRound
        ) = priceFeed.latestRoundData();
        require(answer > 0, "Price feed returned non-positive value");
        require(updatedAt != 0, "Round incomplete / not updated");
        require(updatedAt >= block.timestamp - MAX_PRICE_AGE, "Price is stale");
        require(answeredInRound >= roundId, "Answer is from stale round");
        return (answer, priceFeed.decimals());
    }

    function unsafePrice() external view returns (int256) {
        (, int256 answer, , , ) = priceFeed.latestRoundData();
        return answer;
    }

    function deposit() external payable returns (bool) {
        require(msg.value > 0, "Must send TRX");
        balanceOf[msg.sender] += msg.value;
        totalSupply += msg.value;
        emit Transfer(address(0), msg.sender, msg.value);
        return true;
    }

    function withdraw(uint256 amount) external returns (bool) {
        require(balanceOf[msg.sender] >= amount, "Insufficient balance");
        balanceOf[msg.sender] -= amount;
        totalSupply -= amount;
        payable(msg.sender).transfer(amount);
        emit Transfer(msg.sender, address(0), amount);
        return true;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        require(to != address(0), "Invalid recipient");
        require(balanceOf[msg.sender] >= amount, "Insufficient balance");
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        emit Transfer(msg.sender, to, amount);
        return true;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        require(from != address(0), "Invalid sender");
        require(to != address(0), "Invalid recipient");
        require(balanceOf[from] >= amount, "Insufficient balance");
        require(allowance[from][msg.sender] >= amount, "Insufficient allowance");
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        allowance[from][msg.sender] -= amount;
        emit Transfer(from, to, amount);
        return true;
    }

    function emergencyWithdraw() external onlyOwner {
        uint256 bal = address(this).balance;
        if (bal > 0) {
            payable(owner).transfer(bal);
        }
    }

    receive() external payable {}
}