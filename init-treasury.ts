import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PublicKey, SystemProgram } from "@solana/web3.js";

// Your program ID
const PROGRAM_ID = new PublicKey("C3LRoEztvLPioY3ruddYGTT9qxzvqBivHzgmpGJuQ9CT");

async function initializeTreasury() {
  // Set up provider (devnet)
  const connection = new anchor.web3.Connection(
    "https://api.devnet.solana.com",
    "confirmed"
  );

  // Load your wallet
  const wallet = anchor.web3.Keypair.fromSecretKey(
    Buffer.from(
      JSON.parse(
        require("fs").readFileSync(
          process.env.HOME + "/.config/solana/id.json",
          "utf-8"
        )
      )
    )
  );

  const provider = new anchor.AnchorProvider(
    connection,
    new anchor.Wallet(wallet),
    { commitment: "confirmed" }
  );

  // Load IDL
  const idl = JSON.parse(
    require("fs").readFileSync("./target/idl/prediction_market.json", "utf8")
  );

  const program = new Program(idl, provider);

  // Derive treasury PDA
  const [treasuryPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("treasury")],
    PROGRAM_ID
  );

  console.log("Treasury PDA:", treasuryPda.toString());
  console.log("Authority:", wallet.publicKey.toString());

  try {
    // Check if treasury already exists
    const treasuryAccount = await connection.getAccountInfo(treasuryPda);
    
    if (treasuryAccount) {
      console.log("✅ Treasury already initialized!");
      return;
    }

    console.log("Initializing treasury...");

    const tx = await program.methods
      .initializeTreasury()
      .accounts({
        treasury: treasuryPda,
        authority: wallet.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    console.log("✅ Treasury initialized!");
    console.log("Transaction signature:", tx);
  } catch (err) {
    console.error("❌ Error:", err);
  }
}

initializeTreasury();