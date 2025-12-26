// scripts/deploy.cjs
require("dotenv").config();
const TronWeb = require("tronweb");
const fs = require("fs");
const solc = require("solc");
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
    privateKey: privateKey,
  });

  // ✅ Connection check
  const address = tronWeb.address.fromPrivateKey(privateKey);
  console.log("✅ Connected to Shasta Testnet");
  console.log("Deployer address:", address);

  // ✅ Compile contract
  console.log("🛠️ Compiling contract...");
  const contractPath = path.join(__dirname, "..", "contracts", "FlashUSDT_tron.sol");
  const source = fs.readFileSync(contractPath, "utf8");

  const input = {
    language: "Solidity",
    sources: { "FlashUSDT_tron.sol": { content: source } },
    settings: { outputSelection: { "*": { "*": ["abi", "evm.bytecode"] } } }
  };

  const output = JSON.parse(solc.compile(JSON.stringify(input)));

  if (output.errors) {
    for (const e of output.errors) {
      console.error(e.formattedMessage || e);
    }
    const hasError = output.errors.some(e => e.severity === "error");
    if (hasError) process.exit(1);
  }

  const contractName = Object.keys(output.contracts["FlashUSDT_tron.sol"])[0];
  const abi = output.contracts["FlashUSDT_tron.sol"][contractName].abi;
  const bytecode = output.contracts["FlashUSDT_tron.sol"][contractName].evm.bytecode.object;

  console.log("🚀 Deploying contract to Shasta...");

  try {
    // ✅ Create transaction
    const tx = await tronWeb.transactionBuilder.createSmartContract(
      {
        abi,
        bytecode,
        feeLimit: 1_000_000_000, // 1000 TRX max energy fee
      },
      address
    );

    // ✅ Sign transaction
    const signedTxn = await tronWeb.trx.sign(tx, privateKey);

    // ✅ Broadcast transaction
    const receipt = await tronWeb.trx.sendRawTransaction(signedTxn);

    if (!receipt.result) {
      console.error("❌ Deployment failed:", receipt);
      process.exit(1);
    }

    console.log("✅ Deployment broadcasted!");
    console.log("📄 Transaction ID:", receipt.txid);

    // ✅ Wait for contract confirmation
    console.log("⏳ Waiting for contract confirmation...");
    await new Promise(r => setTimeout(r, 10000));

    const txInfo = await tronWeb.trx.getTransactionInfo(receipt.txid);
    const contractAddress = txInfo?.contract_address;

    if (!contractAddress) {
      console.error("⚠️ Contract address not found yet. Try again after a few seconds.");
      console.error("Check TX:", `https://shasta.tronscan.org/#/transaction/${receipt.txid}`);
      process.exit(1);
    }

    console.log("✅ Contract deployed successfully!");
    console.log("📜 Contract Address:", contractAddress);
    console.log("🔗 View on Shasta Explorer:");
    console.log(`   https://shasta.tronscan.org/#/contract/${contractAddress}`);

    // ✅ Save ABI
    const buildDir = path.join(__dirname, "..", "build");
    fs.mkdirSync(buildDir, { recursive: true });
    fs.writeFileSync(path.join(buildDir, "FlashUSDT_tron.abi.json"), JSON.stringify(abi, null, 2));
    console.log("💾 ABI saved to ./build/FlashUSDT_tron.abi.json");

  } catch (error) {
    console.error("❌ Deployment failed:", error.message || error);
    process.exit(1);
  }
}

main().catch(err => {
  console.error("❌ Fatal error:", err.message || err);
  process.exit(1);
});
