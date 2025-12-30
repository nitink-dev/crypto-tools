// scripts/deploy.cjs (corrected)
require("dotenv").config();
const TronWeb = require("tronweb");
const fs = require("fs");
const path = require("path");

async function main() {
  const fullNode = process.env.TRON_FULL_NODE || "https://api.shasta.trongrid.io";
  const solidityNode = process.env.TRON_SOLIDITY_NODE || fullNode;
  const eventServer = process.env.TRON_EVENT_SERVER || fullNode;
  const privateKey = process.env.PRIVATE_KEY;

  if (!privateKey) {
    console.error("❌ Set PRIVATE_KEY in .env");
    process.exit(1);
  }

  const tronWeb = new TronWeb({
    fullHost: fullNode,
    solidityNode,
    eventServer,
    privateKey,
  });

  // ✅ Connection check
  const address = tronWeb.address.fromPrivateKey(privateKey);
  console.log("✅ Connected to Shasta Testnet");
  console.log("Deployer address:", address);

  // ✅ Load compiled artifact (from Hardhat)
  console.log("🛠️ Loading compiled contract...");
  const artifactPath = path.join(__dirname, "..", "artifacts", "contracts", "TestToken.sol", "TestToken.json");
  const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
  const abi = artifact.abi;
  const bytecode = artifact.bytecode;

  // Constructor parameters (customize as needed)
  const parameters = [
    "Test Token",  // _name
    "TTK",         // _symbol
    18,            // _decimals
    "TBcCSYgSTMQccxgoR7Ct6hTsCm5qdErRyf"  // _priceFeed (Tron mainnet ETH/USD; won't update on Shasta)
  ];

  console.log("🚀 Deploying contract to Shasta...");

  try {
    // ✅ Create transaction with parameters
    const tx = await tronWeb.transactionBuilder.createSmartContract(
      {
        abi,
        bytecode,
        parameters,  // ABI-encodes args automatically
        feeLimit: 1_000_000_000,  // 1000 TRX max
      },
      address
    );

    // ✅ Sign and broadcast
    const signedTxn = await tronWeb.trx.sign(tx);
    const receipt = await tronWeb.trx.sendRawTransaction(signedTxn);

    if (!receipt.result) {
      console.error("❌ Deployment failed:", receipt);
      process.exit(1);
    }

    console.log("✅ Deployment broadcasted!");
    console.log("📄 Transaction ID:", receipt.transaction.txID);  // Tron uses txID

    // ✅ Wait for confirmation (Tron blocks ~3s)
    console.log("⏳ Waiting for contract confirmation...");
    let contractAddress;
    for (let i = 0; i < 10; i++) {  // Retry up to 30s
      await new Promise(r => setTimeout(r, 3000));
      const txInfo = await tronWeb.trx.getTransactionInfo(receipt.transaction.txID);
      contractAddress = txInfo?.contract_address;
      if (contractAddress) break;
    }

    if (!contractAddress) {
      console.error("⚠️ Contract address not found. Check TX:");
      console.error(`https://shasta.tronscan.org/#/transaction/${receipt.transaction.txID}`);
      process.exit(1);
    }

    console.log("✅ Contract deployed successfully!");
    console.log("📜 Contract Address:", tronWeb.address.fromHex(contractAddress));  // Convert to base58
    console.log("🔗 View on Shasta Explorer:");
    console.log(`https://shasta.tronscan.org/#/contract/${tronWeb.address.fromHex(contractAddress)}`);

    // ✅ Save ABI
    const buildDir = path.join(__dirname, "..", "build");
    fs.mkdirSync(buildDir, { recursive: true });
    fs.writeFileSync(path.join(buildDir, "TestToken.abi.json"), JSON.stringify(abi, null, 2));
    console.log("💾 ABI saved to ./build/TestToken.abi.json");

  } catch (error) {
    console.error("❌ Deployment failed:", error.message || error);
    process.exit(1);
  }
}

main().catch(err => {
  console.error("❌ Fatal error:", err.message || err);
  process.exit(1);
});