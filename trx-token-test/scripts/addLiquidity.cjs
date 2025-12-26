// scripts/addLiquidity.cjs
require("dotenv").config();
const TronWeb = require("tronweb");

async function main() {
  const fullNode = process.env.TRON_FULL_NODE || "https://api.shasta.trongrid.io";
  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) {
    console.error("❌ Set PRIVATE_KEY in .env");
    process.exit(1);
  }

  const tronWeb = new TronWeb({
    fullHost: fullNode,
    privateKey: privateKey,
  });

  // === Config: Change these ===
  const tokenAddress = "TUfyZXzChXDFYAm4GzL3TLZjyrqM933xgJ"; // Your deployed TRC-20 token
  // const tokenAddress = "TLa2f6VPqDgRE67v1736s7bJ8Ray5wYjU7".trim(); // Your deployed TRC-20 token
  const trxAmount = 10; // Amount of TRX to add to liquidity
  const tokenAmount = 1000; // Amount of your token
  const routerAddress = "TJtN6qEhrvwfFsyXHjTxQkhmH1sCrqj1A4".trim(); // JustSwap Router Shasta testnet
  const tokenDecimals = 6; // Adjust according to your token decimals
  // ==========================
  // console.log("Wallet valid?", TronWeb.isAddress(myWallet));
  console.log("Token valid?", TronWeb.isAddress(tokenAddress));
  console.log("Router valid?", TronWeb.isAddress(routerAddress));
  const fromAddress = tronWeb.address.fromPrivateKey(privateKey);
  console.log("✅ Wallet:", fromAddress);

  // Convert amounts to SUN (1 TRX = 1e6 SUN) and token units
  const trxSun = tronWeb.toSun(trxAmount);
  const tokenUnits = tokenAmount * Math.pow(10, tokenDecimals);

  // Convert addresses to hex for function parameters
  const tokenHex = tronWeb.address.toHex(tokenAddress);
  const routerHex = tronWeb.address.toHex(routerAddress);

  // === Token contract (TRC-20) ===
  const tokenAbi = [
    {
      "constant": false,
      "inputs": [
        { "name": "_spender", "type": "address" },
        { "name": "_value", "type": "uint256" }
      ],
      "name": "approve",
      "outputs": [{ "name": "", "type": "bool" }],
      "type": "function"
    }
  ];

  // Instantiate contract using base58 address
  const tokenContract = await tronWeb.contract(tokenAbi, tokenAddress);

  // === Approve router to spend tokens ===
  console.log("⏳ Approving router to spend tokens...");
  const approveTxn = await tokenContract.approve(routerHex, tokenUnits).send({ from: fromAddress });
  console.log("✅ Approved! Transaction ID:", approveTxn);

  // Optional: wait a few seconds to ensure confirmation
  await new Promise(r => setTimeout(r, 5000));

  // === Router contract ===
  const routerAbi = [
    {
      "constant": false,
      "inputs": [
        { "name": "token", "type": "address" },
        { "name": "tokenAmount", "type": "uint256" },
        { "name": "minToken", "type": "uint256" },
        { "name": "minTRX", "type": "uint256" }
      ],
      "name": "addLiquidity",
      "outputs": [],
      "payable": true,
      "stateMutability": "payable",
      "type": "function"
    }
  ];

  // Instantiate router contract with base58 address
  const router = await tronWeb.contract(routerAbi, routerAddress);

  // === Add liquidity ===
  console.log(`⏳ Adding liquidity: ${trxAmount} TRX + ${tokenAmount} tokens...`);
  const addLiquidityTxn = await router.addLiquidity(
    tokenHex,   // token in hex
    tokenUnits, // token amount
    0,          // min tokens
    0           // min TRX
  ).send({
    from: fromAddress,
    callValue: trxSun
  });

  console.log("✅ Liquidity added!");
  console.log("📄 Transaction ID:", addLiquidityTxn);
}

main().catch(err => {
  console.error("❌ Error:", err);
});
