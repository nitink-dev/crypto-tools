// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

interface ITRC20 {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

contract TestRouter {
    struct Liquidity {
        address token;
        uint256 tokenAmount;
        uint256 trxAmount;
    }

    Liquidity[] public liquidityRecords;

    // Ensure non-empty bytecode
    uint256 private dummy;

    constructor() {
        dummy = 1;
    }

    function addLiquidity(address token, uint256 tokenAmount) external payable {
        require(msg.value > 0, "Send TRX");
        require(ITRC20(token).transferFrom(msg.sender, address(this), tokenAmount), "Token transfer failed");

        liquidityRecords.push(Liquidity({
            token: token,
            tokenAmount: tokenAmount,
            trxAmount: msg.value
        }));
    }

    function getLiquidityCount() external view returns (uint256) {
        return liquidityRecords.length;
    }
}
