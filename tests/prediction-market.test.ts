import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PredictionMarket } from "../target/types/prediction_market";
import { PublicKey, SystemProgram, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { assert } from "chai";
import { sha256 } from "@noble/hashes/sha2";

describe("prediction-market", () => {

  function qSeed(question: string): Buffer {
    // 32-byte digest as Buffer
    return Buffer.from(sha256(new TextEncoder().encode(question)));
  }

  // Configure the client to use the local cluster
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.PredictionMarket as Program<PredictionMarket>;
  
  // Test accounts
  const creator = provider.wallet;
  let marketPda: PublicKey;
  let treasuryPda: PublicKey;
  let userPositionPda: PublicKey;
  
  const question = "Will Bitcoin reach $100k by end of 2025?";
  const questionSeed = qSeed(question); // Buffer of 32 bytes
  const description = "Resolves YES if BTC hits $100k before Dec 31, 2025";
  
  // End date: 30 days from now
  const endTimestamp = new anchor.BN(Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60);
  
  // Initial liquidity: 2 SOL
  const initialLiquidity = new anchor.BN(2 * LAMPORTS_PER_SOL);

  before(async () => {
    // Derive PDAs - use the same questionSeed
    [marketPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("market"),
        creator.publicKey.toBuffer(),
        questionSeed,
      ],
      program.programId
    );

    [treasuryPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("treasury")],
      program.programId
    );

    [userPositionPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("position"),
        marketPda.toBuffer(),
        creator.publicKey.toBuffer(),
      ],
      program.programId
    );

    console.log("Market PDA:", marketPda.toString());
    console.log("Treasury PDA:", treasuryPda.toString());
    console.log("Question seed (hex):", questionSeed.toString('hex'));
  });

  it("Creates a prediction market", async () => {
    const tx = await program.methods
      .createMarket(
        question, 
        description, 
        endTimestamp, 
        initialLiquidity, 
        Array.from(questionSeed) // Convert Buffer to number array
      )
      .accounts({
        market: marketPda,
        treasury: treasuryPda,
        creator: creator.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    console.log("Create market transaction:", tx);

    // Fetch the market account
    const market = await program.account.market.fetch(marketPda);

    assert.equal(market.question, question);
    assert.equal(market.description, description);
    assert.equal(market.creator.toString(), creator.publicKey.toString());
    assert.equal(market.resolved, false);
    assert.ok(market.yesPool.eq(new anchor.BN(1 * LAMPORTS_PER_SOL)));
    assert.ok(market.noPool.eq(new anchor.BN(1 * LAMPORTS_PER_SOL)));
    
    console.log("Market created successfully!");
    console.log("YES pool:", market.yesPool.toString());
    console.log("NO pool:", market.noPool.toString());
  });

  it("Places a YES bet", async () => {
    const betAmount = new anchor.BN(0.5 * LAMPORTS_PER_SOL);

    const marketBefore = await program.account.market.fetch(marketPda);
    console.log("\nBefore bet:");
    console.log("YES pool:", marketBefore.yesPool.toString());
    console.log("NO pool:", marketBefore.noPool.toString());

    const tx = await program.methods
      .placeBet(betAmount, true) // true = YES
      .accounts({
        market: marketPda,
        position: userPositionPda,
        user: creator.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    console.log("\nPlace bet transaction:", tx);

    // Fetch updated accounts
    const market = await program.account.market.fetch(marketPda);
    const position = await program.account.userPosition.fetch(userPositionPda);

    console.log("\nAfter bet:");
    console.log("YES pool:", market.yesPool.toString());
    console.log("NO pool:", market.noPool.toString());
    console.log("User YES shares:", position.yesShares.toString());
    console.log("Amount invested:", position.amountInvested.toString());

    assert.ok(position.yesShares.gt(new anchor.BN(0)));
    assert.ok(market.totalVolume.eq(betAmount));
  });

  it("Places a NO bet", async () => {
    // Create a new user for this test
    const newUser = anchor.web3.Keypair.generate();
    
    // Airdrop SOL to new user
    const signature = await provider.connection.requestAirdrop(
      newUser.publicKey,
      2 * LAMPORTS_PER_SOL
    );
    await provider.connection.confirmTransaction(signature);

    const betAmount = new anchor.BN(0.3 * LAMPORTS_PER_SOL);

    const [newUserPositionPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("position"),
        marketPda.toBuffer(),
        newUser.publicKey.toBuffer(),
      ],
      program.programId
    );

    const tx = await program.methods
      .placeBet(betAmount, false) // false = NO
      .accounts({
        market: marketPda,
        position: newUserPositionPda,
        user: newUser.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([newUser])
      .rpc();

    console.log("\nNO bet transaction:", tx);

    const market = await program.account.market.fetch(marketPda);
    const position = await program.account.userPosition.fetch(newUserPositionPda);

    console.log("User NO shares:", position.noShares.toString());
    assert.ok(position.noShares.gt(new anchor.BN(0)));
  });

  it("Fails to resolve market before end time", async () => {
    try {
      await program.methods
        .resolveMarket(true)
        .accounts({
          market: marketPda,
          treasury: treasuryPda,
          resolver: creator.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
      
      assert.fail("Should have thrown error");
    } catch (err) {
      // Check for any market-related error (the exact error code might vary)
      const errorStr = err.toString();
      const hasError = errorStr.includes("MarketNotEnded") || 
                       errorStr.includes("ConstraintRaw") ||
                       errorStr.includes("6000"); // Custom error code for MarketNotEnded
      
      assert.isTrue(hasError, `Expected market-not-ended error, got: ${errorStr}`);
      console.log("\nCorrectly prevented early resolution");
      console.log("Error:", errorStr.substring(0, 200));
    }
  });

  it("Adds liquidity to market", async () => {
    const liquidityAmount = new anchor.BN(1 * LAMPORTS_PER_SOL);

    const marketBefore = await program.account.market.fetch(marketPda);

    const tx = await program.methods
      .addLiquidity(liquidityAmount)
      .accounts({
        market: marketPda,
        liquidityProvider: creator.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    console.log("\nAdd liquidity transaction:", tx);

    const market = await program.account.market.fetch(marketPda);
    
    assert.ok(market.yesPool.gt(marketBefore.yesPool));
    assert.ok(market.noPool.gt(marketBefore.noPool));
    
    console.log("New YES pool:", market.yesPool.toString());
    console.log("New NO pool:", market.noPool.toString());
  });

  // Note: To test resolve and claim, you'd need to wait for end_timestamp
  // or modify the market's end_timestamp in tests
  it("Shows market statistics", async () => {
    const market = await program.account.market.fetch(marketPda);
    const treasury = await program.account.treasury.fetch(treasuryPda);

    console.log("\n=== Market Statistics ===");
    console.log("Question:", market.question);
    console.log("Total Volume:", market.totalVolume.toString(), "lamports");
    console.log("Number of Bettors:", market.numBettors);
    console.log("Treasury Fee:", market.treasuryFee.toString(), "lamports");
    console.log("\n=== Treasury Statistics ===");
    console.log("Total Markets:", treasury.totalMarkets);
    console.log("Total Fees:", treasury.totalFees.toString(), "lamports");
  });
});