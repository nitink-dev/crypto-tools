// scripts/deployRouter.cjs
require("dotenv").config();
const TronWeb = require("tronweb");
const fs = require("fs");
const solc = require("solc");
const path = require("path");

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

  const deployerAddress = tronWeb.address.fromPrivateKey(privateKey);
  console.log("✅ Connected to Shasta Testnet");
  console.log("Deployer address:", deployerAddress);

  // Read contract source
  const contractPath = path.join(__dirname, "..", "contracts", "TestRouter.sol");
  const source = fs.readFileSync(contractPath, "utf8");

  // Compile contract with optimizer enabled
  const input = {
    language: "Solidity",
    sources: { "TestRouter.sol": { content: source } },
    settings: {
      optimizer: { enabled: true, runs: 200 },
      outputSelection: {
        "*": {
          "*": ["abi", "evm.bytecode"]
        }
      }
    }
  };

  const output = JSON.parse(solc.compile(JSON.stringify(input)));

  if (output.errors) {
    output.errors.forEach(e => console.error(e.formattedMessage || e));
    const hasError = output.errors.some(e => e.severity === "error");
    if (hasError) process.exit(1);
  }

  const contractName = Object.keys(output.contracts["TestRouter.sol"])[0];
  const abi = output.contracts["TestRouter.sol"][contractName].abi;
  const bytecode = output.contracts["TestRouter.sol"][contractName].evm.bytecode.object;

  if (!bytecode || bytecode.length === 0) {
    console.error("❌ Compilation produced empty bytecode. Check Solidity version or contract syntax.");
    process.exit(1);
  }

  console.log("🚀 Deploying Router contract to Shasta...");

  try {
    // Create deployment transaction
    const tx = await tronWeb.transactionBuilder.createSmartContract(
      {
        abi,
        bytecode,
        feeLimit: 1_000_000_000, // max 1000 TRX energy
      },
      deployerAddress
    );

    // Sign transaction
    const signedTx = await tronWeb.trx.sign(tx, privateKey);

    // Broadcast transaction
    const receipt = await tronWeb.trx.sendRawTransaction(signedTx);

    if (!receipt.result) {
      console.error("❌ Deployment failed:", receipt);
      process.exit(1);
    }

    console.log("✅ Deployment broadcasted!");
    console.log("📄 Transaction ID:", receipt.txid);

    // Wait and fetch contract address
    console.log("⏳ Waiting for contract confirmation...");
    await new Promise(r => setTimeout(r, 10000));

    const txInfo = await tronWeb.trx.getTransactionInfo(receipt.txid);
    const contractAddress = txInfo?.contract_address;

    if (!contractAddress) {
      console.error("⚠️ Contract address not found yet. Try again after a few seconds.");
      console.error("Check TX:", `https://shasta.tronscan.org/#/transaction/${receipt.txid}`);
      process.exit(1);
    }

    console.log("✅ Router contract deployed successfully!");
    console.log("📜 Contract Address:", contractAddress);
    console.log("🔗 View on Shasta Explorer:");
    console.log(`   https://shasta.tronscan.org/#/contract/${contractAddress}`);

    // Save ABI
    const buildDir = path.join(__dirname, "..", "build");
    fs.mkdirSync(buildDir, { recursive: true });
    fs.writeFileSync(path.join(buildDir, "TestRouter.abi.json"), JSON.stringify(abi, null, 2));
    console.log("💾 ABI saved to ./build/TestRouter.abi.json");

  } catch (err) {
    console.error("❌ Deployment failed:", err.message || err);
    process.exit(1);
  }
}

main().catch(err => {
  console.error("❌ Fatal error:", err.message || err);
  process.exit(1);
});
