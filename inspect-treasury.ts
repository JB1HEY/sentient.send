import * as anchor from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";

const PROGRAM_ID = new PublicKey("2Z7sJer7qW1DJcoZQHJ5i96Gw4LxQqRSpPfd33yVhRVZ");

async function inspectTreasury() {
  const connection = new anchor.web3.Connection(
    "https://api.devnet.solana.com",
    "confirmed"
  );

  // Derive treasury PDA
  const [treasuryPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("treasury")],
    PROGRAM_ID
  );

  console.log("Treasury PDA:", treasuryPda.toString());
  console.log("");

  const accountInfo = await connection.getAccountInfo(treasuryPda);

  if (!accountInfo) {
    console.log("❌ Treasury account does NOT exist!");
    console.log("Run: anchor run init-treasury");
    return;
  }

  console.log("✅ Treasury account exists");
  console.log("Owner:", accountInfo.owner.toString());
  console.log("Data length:", accountInfo.data.length);
  console.log("Lamports:", accountInfo.lamports);
  console.log("");

  // Check if owner matches program
  if (!accountInfo.owner.equals(PROGRAM_ID)) {
    console.log("❌ PROBLEM: Treasury owner doesn't match program ID!");
    console.log("   Expected:", PROGRAM_ID.toString());
    console.log("   Got:", accountInfo.owner.toString());
    console.log("");
    console.log("SOLUTION: Close old treasury and recreate it");
    console.log("Run:");
    console.log("  solana program close " + treasuryPda.toString() + " --url devnet");
    console.log("  anchor run init-treasury");
    return;
  }

  // Check data length (should be 8 + 32 + 8 + 8 + 4 + 8 + 1 = 69 bytes)
  const expectedLength = 69;
  if (accountInfo.data.length !== expectedLength) {
    console.log("❌ PROBLEM: Treasury has wrong data length!");
    console.log("   Expected:", expectedLength, "bytes");
    console.log("   Got:", accountInfo.data.length, "bytes");
    console.log("");
    console.log("This means treasury was created with old program version.");
    console.log("");
    console.log("SOLUTION: Close old treasury and recreate it");
    console.log("Run:");
    console.log("  solana program close " + treasuryPda.toString() + " --url devnet --bypass-warning");
    console.log("  anchor run init-treasury");
    return;
  }

  console.log("✅ Treasury looks correct!");
  console.log("");
  console.log("If you're still getting errors, the problem is elsewhere.");
  console.log("Check:");
  console.log("  1. Program ID matches in frontend/src/lib/constants.ts");
  console.log("  2. IDL is up to date in frontend/src/lib/idl.ts");
  console.log("  3. You rebuilt and redeployed: anchor build && anchor deploy");
}

inspectTreasury().catch(console.error);