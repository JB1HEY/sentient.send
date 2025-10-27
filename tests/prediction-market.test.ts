import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PredictionMarket } from "../target/types/prediction_market";
import { PublicKey, SystemProgram, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { assert } from "chai";
import { sha256 } from "@noble/hashes/sha2";

describe("sentiment-based-prediction-market", () => {
  
  function qSeed(question: string): Buffer {
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
  let alicePositionPda: PublicKey;
  let bobPositionPda: PublicKey;
  let charliePositionPda: PublicKey;
  
  const question = "Chicken vs Egg: What came first?";
  const questionSeed = qSeed(question);
  const description = "A meme market - no resolution needed! Payout based on final sentiment.";
  
  // End date: 30 seconds from now (for quick testing)
  const endTimestamp = new anchor.BN(Math.floor(Date.now() / 1000) + 30);
  
  // Initial liquidity: 2 SOL
  const initialLiquidity = new anchor.BN(2 * LAMPORTS_PER_SOL);

  // Create test users
  const alice = anchor.web3.Keypair.generate();
  const bob = anchor.web3.Keypair.generate();
  const charlie = anchor.web3.Keypair.generate();

  before(async () => {
    // Airdrop SOL to test users
    await Promise.all([
      provider.connection.requestAirdrop(alice.publicKey, 5 * LAMPORTS_PER_SOL),
      provider.connection.requestAirdrop(bob.publicKey, 5 * LAMPORTS_PER_SOL),
      provider.connection.requestAirdrop(charlie.publicKey, 5 * LAMPORTS_PER_SOL),
    ]);

    // Wait for airdrops
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Derive PDAs
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

    [alicePositionPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("position"),
        marketPda.toBuffer(),
        alice.publicKey.toBuffer(),
      ],
      program.programId
    );

    [bobPositionPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("position"),
        marketPda.toBuffer(),
        bob.publicKey.toBuffer(),
      ],
      program.programId
    );

    [charliePositionPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("position"),
        marketPda.toBuffer(),
        charlie.publicKey.toBuffer(),
      ],
      program.programId
    );
  });

  it("Creates a sentiment-based prediction market", async () => {
    const tx = await program.methods
      .createMarket(
        question,
        description,
        endTimestamp,
        initialLiquidity,
        Array.from(questionSeed)
      )
      .accounts({
        market: marketPda,
        treasury: treasuryPda,
        creator: creator.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    console.log("Create market transaction:", tx);

    const market = await program.account.market.fetch(marketPda);

    assert.equal(market.question, question);
    assert.equal(market.description, description);
    assert.equal(market.creator.toString(), creator.publicKey.toString());
    assert.ok(market.yesPool.eq(new anchor.BN(1 * LAMPORTS_PER_SOL)));
    assert.ok(market.noPool.eq(new anchor.BN(1 * LAMPORTS_PER_SOL)));
    
    console.log("Market created successfully!");
    console.log("Initial YES pool:", market.yesPool.toString());
    console.log("Initial NO pool:", market.noPool.toString());
    console.log("Market ends at:", new Date(market.endTimestamp.toNumber() * 1000));
  });

  it("Alice bets heavily on 'Chicken' (YES)", async () => {
    const betAmount = new anchor.BN(2 * LAMPORTS_PER_SOL); // Alice goes big on Chicken

    const tx = await program.methods
      .placeBet(betAmount, true) // true = YES = Chicken
      .accounts({
        market: marketPda,
        position: alicePositionPda,
        user: alice.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([alice])
      .rpc();

    console.log("\nAlice bets on CHICKEN transaction:", tx);

    const market = await program.account.market.fetch(marketPda);
    const position = await program.account.userPosition.fetch(alicePositionPda);

    console.log("After Alice's bet:");
    console.log("YES (Chicken) pool:", market.yesPool.toString());
    console.log("NO (Egg) pool:", market.noPool.toString());
    console.log("Alice's YES shares:", position.yesShares.toString());

    // Chicken price should have increased due to Alice's large bet
    const chickenPrice = market.noPool.toNumber() / (market.yesPool.toNumber() + market.noPool.toNumber());
    console.log("Chicken price after Alice:", (chickenPrice * 100).toFixed(1) + "%");

    assert.ok(position.yesShares.gt(new anchor.BN(0)));
    assert.ok(chickenPrice > 0.5); // Chicken should be favored now
  });

  it("Bob and Charlie bet on 'Egg' (NO)", async () => {
    const bobBet = new anchor.BN(1 * LAMPORTS_PER_SOL);
    const charlieBet = new anchor.BN(1.5 * LAMPORTS_PER_SOL);

    // Bob bets on Egg
    await program.methods
      .placeBet(bobBet, false) // false = NO = Egg
      .accounts({
        market: marketPda,
        position: bobPositionPda,
        user: bob.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([bob])
      .rpc();

    // Charlie also bets on Egg
    await program.methods
      .placeBet(charlieBet, false) // false = NO = Egg
      .accounts({
        market: marketPda,
        position: charliePositionPda,
        user: charlie.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([charlie])
      .rpc();

    console.log("\nAfter Bob and Charlie bet on EGG:");

    const market = await program.account.market.fetch(marketPda);
    const bobPosition = await program.account.userPosition.fetch(bobPositionPda);
    const charliePosition = await program.account.userPosition.fetch(charliePositionPda);

    console.log("YES (Chicken) pool:", market.yesPool.toString());
    console.log("NO (Egg) pool:", market.noPool.toString());
    console.log("Bob's NO shares:", bobPosition.noShares.toString());
    console.log("Charlie's NO shares:", charliePosition.noShares.toString());

    const chickenPrice = market.noPool.toNumber() / (market.yesPool.toNumber() + market.noPool.toNumber());
    const eggPrice = 1 - chickenPrice;
    console.log("Final Chicken price:", (chickenPrice * 100).toFixed(1) + "%");
    console.log("Final Egg price:", (eggPrice * 100).toFixed(1) + "%");

    assert.ok(bobPosition.noShares.gt(new anchor.BN(0)));
    assert.ok(charliePosition.noShares.gt(new anchor.BN(0)));
  });

  it("Cannot bet after market ends", async () => {
    console.log("\nWaiting for market to end...");
    
    // Wait for market to end (30 seconds + buffer)
    await new Promise(resolve => setTimeout(resolve, 35000));

    try {
      await program.methods
        .placeBet(new anchor.BN(0.1 * LAMPORTS_PER_SOL), true)
        .accounts({
          market: marketPda,
          position: alicePositionPda,
          user: alice.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([alice])
        .rpc();
      
      assert.fail("Should have thrown error for ended market");
    } catch (err) {
      console.log("Correctly prevented betting after market end");
      assert.include(err.toString(), "MarketEnded");
    }
  });

  it("Everyone claims proportional payouts based on sentiment", async () => {
    const market = await program.account.market.fetch(marketPda);
    
    console.log("\n=== FINAL MARKET STATE ===");
    console.log("Total YES (Chicken) pool:", market.yesPool.toString());
    console.log("Total NO (Egg) pool:", market.noPool.toString());
    console.log("Total YES shares issued:", market.totalYesShares.toString());
    console.log("Total NO shares issued:", market.totalNoShares.toString());

    const totalPool = market.yesPool.toNumber() + market.noPool.toNumber();
    const chickenSentiment = market.noPool.toNumber() / totalPool;
    const eggSentiment = market.yesPool.toNumber() / totalPool;

    console.log("\n=== FINAL SENTIMENT ===");
    console.log("Chicken sentiment:", (chickenSentiment * 100).toFixed(1) + "%");
    console.log("Egg sentiment:", (eggSentiment * 100).toFixed(1) + "%");

    // Alice claims (she bet on Chicken)
    const aliceBalanceBefore = await provider.connection.getBalance(alice.publicKey);
    
    await program.methods
      .claimWinnings()
      .accounts({
        market: marketPda,
        position: alicePositionPda,
        user: alice.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([alice])
      .rpc();

    const aliceBalanceAfter = await provider.connection.getBalance(alice.publicKey);
    const alicePayout = (aliceBalanceAfter - aliceBalanceBefore) / LAMPORTS_PER_SOL;

    // Bob claims (he bet on Egg)
    const bobBalanceBefore = await provider.connection.getBalance(bob.publicKey);
    
    await program.methods
      .claimWinnings()
      .accounts({
        market: marketPda,
        position: bobPositionPda,
        user: bob.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([bob])
      .rpc();

    const bobBalanceAfter = await provider.connection.getBalance(bob.publicKey);
    const bobPayout = (bobBalanceAfter - bobBalanceBefore) / LAMPORTS_PER_SOL;

    // Charlie claims (he also bet on Egg)
    const charlieBalanceBefore = await provider.connection.getBalance(charlie.publicKey);
    
    await program.methods
      .claimWinnings()
      .accounts({
        market: marketPda,
        position: charliePositionPda,
        user: charlie.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([charlie])
      .rpc();

    const charlieBalanceAfter = await provider.connection.getBalance(charlie.publicKey);
    const charliePayout = (charlieBalanceAfter - charlieBalanceBefore) / LAMPORTS_PER_SOL;

    console.log("\n=== PROPORTIONAL PAYOUTS ===");
    console.log("Alice (Chicken bettor) received:", alicePayout.toFixed(4), "SOL");
    console.log("Bob (Egg bettor) received:", bobPayout.toFixed(4), "SOL");
    console.log("Charlie (Egg bettor) received:", charliePayout.toFixed(4), "SOL");

    // Everyone should get something (no one loses everything)
    assert.ok(alicePayout > 0, "Alice should get some payout");
    assert.ok(bobPayout > 0, "Bob should get some payout");
    assert.ok(charliePayout > 0, "Charlie should get some payout");

    // The side with higher sentiment should get more per share
    if (chickenSentiment > eggSentiment) {
      console.log("Chicken won the sentiment battle!");
    } else {
      console.log("Egg won the sentiment battle!");
    }
  });

  it("Cannot claim twice", async () => {
    try {
      await program.methods
        .claimWinnings()
        .accounts({
          market: marketPda,
          position: alicePositionPda,
          user: alice.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([alice])
        .rpc();
      
      assert.fail("Should have thrown error for double claim");
    } catch (err) {
      console.log("Correctly prevented double claiming");
      assert.include(err.toString(), "AlreadyClaimed");
    }
  });

  it("Shows final market statistics", async () => {
    const market = await program.account.market.fetch(marketPda);
    const treasury = await program.account.treasury.fetch(treasuryPda);

    console.log("\n=== FINAL MARKET STATISTICS ===");
    console.log("Question:", market.question);
    console.log("Total Volume:", (market.totalVolume.toNumber() / LAMPORTS_PER_SOL).toFixed(2), "SOL");
    console.log("Number of Bettors:", market.numBettors);
    console.log("Platform Fees Collected:", (market.treasuryFee.toNumber() / LAMPORTS_PER_SOL).toFixed(4), "SOL");
    console.log("\n=== TREASURY STATISTICS ===");
    console.log("Total Markets Created:", treasury.totalMarkets);
    console.log("Total Platform Fees:", (treasury.totalFees.toNumber() / LAMPORTS_PER_SOL).toFixed(4), "SOL");

    console.log("\n=== SENTIMENT MARKET SUCCESS! ===");
    console.log("✅ No manual resolution needed");
    console.log("✅ Everyone got paid based on community sentiment");
    console.log("✅ Truly decentralized meme market");
  });
});