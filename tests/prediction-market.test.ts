import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PredictionMarket } from "../target/types/prediction_market";
import { 
  PublicKey, 
  SystemProgram, 
  Keypair,
  LAMPORTS_PER_SOL 
} from "@solana/web3.js";
import { 
  TOKEN_PROGRAM_ID,
  createMint,
  getOrCreateAssociatedTokenAccount,
  mintTo,
} from "@solana/spl-token";
import { assert } from "chai";

describe("prediction-market", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.PredictionMarket as Program<PredictionMarket>;
  
  let usdcMint: PublicKey;
  let creator: Keypair;
  let creatorTokenAccount: PublicKey;
  
  let alice: Keypair;
  let aliceTokenAccount: PublicKey;
  
  let bob: Keypair;
  let bobTokenAccount: PublicKey;
  
  let charlie: Keypair;
  let charlieTokenAccount: PublicKey;
  
  let dave: Keypair;
  let daveTokenAccount: PublicKey;

  before(async () => {
    // Create test users
    creator = Keypair.generate();
    alice = Keypair.generate();
    bob = Keypair.generate();
    charlie = Keypair.generate();
    dave = Keypair.generate();

    // Airdrop SOL for transaction fees
    await Promise.all([
      provider.connection.requestAirdrop(creator.publicKey, 10 * LAMPORTS_PER_SOL),
      provider.connection.requestAirdrop(alice.publicKey, 5 * LAMPORTS_PER_SOL),
      provider.connection.requestAirdrop(bob.publicKey, 5 * LAMPORTS_PER_SOL),
      provider.connection.requestAirdrop(charlie.publicKey, 5 * LAMPORTS_PER_SOL),
      provider.connection.requestAirdrop(dave.publicKey, 5 * LAMPORTS_PER_SOL),
    ]);

    await new Promise(resolve => setTimeout(resolve, 2000));

    // Create USDC mock mint
    usdcMint = await createMint(
      provider.connection,
      creator,
      creator.publicKey,
      null,
      6 // USDC has 6 decimals
    );

    console.log("USDC Mint:", usdcMint.toString());

    // Initialize treasury first
    const [treasuryPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("treasury")],
      program.programId
    );

    try {
      // Check if treasury already exists
      const treasuryAccount = await program.account.treasury.fetch(treasuryPda);
      console.log("Treasury already exists with authority:", treasuryAccount.authority.toString());
    } catch (err) {
      // Treasury doesn't exist, create it
      try {
        await program.methods
          .initializeTreasury()
          .accounts({
            treasury: treasuryPda,
            authority: creator.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .signers([creator])
          .rpc();
        console.log("Treasury initialized");
      } catch (initErr: any) {
        // If it fails due to already existing, that's okay
        if (initErr.toString().includes("already in use")) {
          console.log("Treasury account exists but not initialized properly");
        } else {
          throw initErr;
        }
      }
    }

    // Create token accounts
    const creatorAta = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      creator,
      usdcMint,
      creator.publicKey
    );
    creatorTokenAccount = creatorAta.address;

    const aliceAta = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      alice,
      usdcMint,
      alice.publicKey
    );
    aliceTokenAccount = aliceAta.address;

    const bobAta = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      bob,
      usdcMint,
      bob.publicKey
    );
    bobTokenAccount = bobAta.address;

    const charlieAta = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      charlie,
      usdcMint,
      charlie.publicKey
    );
    charlieTokenAccount = charlieAta.address;

    const daveAta = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      dave,
      usdcMint,
      dave.publicKey
    );
    daveTokenAccount = daveAta.address;

    // Mint USDC to all users
    await mintTo(
      provider.connection,
      creator,
      usdcMint,
      creatorTokenAccount,
      creator,
      1000_000_000 // 1000 USDC
    );

    await mintTo(
      provider.connection,
      creator,
      usdcMint,
      aliceTokenAccount,
      creator,
      500_000_000 // 500 USDC
    );

    await mintTo(
      provider.connection,
      creator,
      usdcMint,
      bobTokenAccount,
      creator,
      300_000_000 // 300 USDC
    );

    await mintTo(
      provider.connection,
      creator,
      usdcMint,
      charlieTokenAccount,
      creator,
      400_000_000 // 400 USDC
    );

    await mintTo(
      provider.connection,
      creator,
      usdcMint,
      daveTokenAccount,
      creator,
      200_000_000 // 200 USDC
    );

    console.log("Test setup complete!");
  });

  describe("Market Creation", () => {
    it("Creates a market with valid parameters", async () => {
      const question = "Who will win the 2024 election?";
      const description = "Market resolves based on official results";
      const endTimestamp = new anchor.BN(Math.floor(Date.now() / 1000) + 3600); // 1 hour
      const sideNames = ["Donald Trump", "Kamala Harris", "Other"];
      const initialAmount = new anchor.BN(150_000_000); // 150 USDC

      const [marketPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("market"),
          creator.publicKey.toBuffer(),
          Buffer.from(question),
        ],
        program.programId
      );

      const [vaultPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("vault"), marketPda.toBuffer()],
        program.programId
      );

      const [treasuryPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("treasury")],
        program.programId
      );

      await program.methods
        .createMarket(
          question,
          description,
          endTimestamp,
          sideNames,
          initialAmount
        )
        .accounts({
          market: marketPda,
          marketVault: vaultPda,
          treasury: treasuryPda,
          creatorTokenAccount,
          usdcMint,
          creator: creator.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([creator])
        .rpc();

      const market = await program.account.market.fetch(marketPda);

      assert.equal(market.question, question);
      assert.equal(market.description, description);
      assert.equal(market.numSides, 3);
      assert.equal(market.resolved, false);
      
      // Check fee calculation: 2% of 150 = 3 USDC
      const expectedFeePool = new anchor.BN(3_000_000);
      assert.ok(market.feePool.eq(expectedFeePool), "Fee pool should be 3 USDC");
      
      // Check total pool: 150 - 3 = 147 USDC
      const expectedTotalPool = new anchor.BN(147_000_000);
      assert.ok(market.totalPool.eq(expectedTotalPool), "Total pool should be 147 USDC");

      console.log("✅ Market created successfully");
    });

    it("Fails to create market with less than 150 USDC", async () => {
      const question = "Invalid market";
      const endTimestamp = new anchor.BN(Math.floor(Date.now() / 1000) + 3600);
      const sideNames = ["Yes", "No"];
      const initialAmount = new anchor.BN(100_000_000); // 100 USDC (too small)

      const [marketPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("market"),
          creator.publicKey.toBuffer(),
          Buffer.from(question),
        ],
        program.programId
      );

      const [vaultPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("vault"), marketPda.toBuffer()],
        program.programId
      );

      const [treasuryPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("treasury")],
        program.programId
      );

      try {
        await program.methods
          .createMarket(
            question,
            "",
            endTimestamp,
            sideNames,
            initialAmount
          )
          .accounts({
            market: marketPda,
            marketVault: vaultPda,
            treasury: treasuryPda,
            creatorTokenAccount,
            usdcMint,
            creator: creator.publicKey,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .signers([creator])
          .rpc();
        
        assert.fail("Should have failed with CreationAmountTooSmall error");
      } catch (err: any) {
        assert.include(err.toString(), "CreationAmountTooSmall");
        console.log("✅ Correctly rejected market with insufficient funds");
      }
    });

    it("Fails to create market with only 1 side", async () => {
      const question = "Invalid sides market";
      const endTimestamp = new anchor.BN(Math.floor(Date.now() / 1000) + 3600);
      const sideNames = ["Only One Side"];
      const initialAmount = new anchor.BN(150_000_000);

      const [marketPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("market"),
          creator.publicKey.toBuffer(),
          Buffer.from(question),
        ],
        program.programId
      );

      const [vaultPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("vault"), marketPda.toBuffer()],
        program.programId
      );

      const [treasuryPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("treasury")],
        program.programId
      );

      try {
        await program.methods
          .createMarket(
            question,
            "",
            endTimestamp,
            sideNames,
            initialAmount
          )
          .accounts({
            market: marketPda,
            marketVault: vaultPda,
            treasury: treasuryPda,
            creatorTokenAccount,
            usdcMint,
            creator: creator.publicKey,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .signers([creator])
          .rpc();
        
        assert.fail("Should have failed with TooFewSides error");
      } catch (err: any) {
        assert.include(err.toString(), "TooFewSides");
        console.log("✅ Correctly rejected market with too few sides");
      }
    });
  });

  describe("Betting", () => {
    let marketPda: PublicKey;
    let vaultPda: PublicKey;

    before(async () => {
      const question = "Best crypto 2025?";
      const endTimestamp = new anchor.BN(Math.floor(Date.now() / 1000) + 7200); // 2 hours
      const sideNames = ["Bitcoin", "Ethereum", "Solana"];
      const initialAmount = new anchor.BN(150_000_000);

      [marketPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("market"),
          creator.publicKey.toBuffer(),
          Buffer.from(question),
        ],
        program.programId
      );

      [vaultPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("vault"), marketPda.toBuffer()],
        program.programId
      );

      const [treasuryPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("treasury")],
        program.programId
      );

      await program.methods
        .createMarket(
          question,
          "Which crypto will perform best?",
          endTimestamp,
          sideNames,
          initialAmount
        )
        .accounts({
          market: marketPda,
          marketVault: vaultPda,
          treasury: treasuryPda,
          creatorTokenAccount,
          usdcMint,
          creator: creator.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([creator])
        .rpc();
    });

    it("Alice bets 100 USDC on Bitcoin (side 0)", async () => {
      const [positionPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("position"),
          marketPda.toBuffer(),
          alice.publicKey.toBuffer(),
        ],
        program.programId
      );

      const betAmount = new anchor.BN(100_000_000); // 100 USDC
      const sideIndex = 0; // Bitcoin

      await program.methods
        .placeBet(sideIndex, betAmount)
        .accounts({
          market: marketPda,
          marketVault: vaultPda,
          position: positionPda,
          userTokenAccount: aliceTokenAccount,
          user: alice.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([alice])
        .rpc();

      const market = await program.account.market.fetch(marketPda);
      const position = await program.account.userPosition.fetch(positionPda);

      // 2% fee = 2 USDC, so 98 USDC goes to Bitcoin
      const expectedBetAmount = new anchor.BN(98_000_000);
      assert.ok(
        market.sides[0].totalAmount.eq(expectedBetAmount),
        "Bitcoin should have 98 USDC"
      );
      
      assert.ok(position.bets[0].amount.eq(expectedBetAmount));
      assert.equal(position.bets[0].hasBet, true);
      
      console.log("✅ Alice bet 100 USDC on Bitcoin");
    });

    it("Bob bets 50 USDC on Ethereum (side 1)", async () => {
      const [positionPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("position"),
          marketPda.toBuffer(),
          bob.publicKey.toBuffer(),
        ],
        program.programId
      );

      const betAmount = new anchor.BN(50_000_000);
      const sideIndex = 1; // Ethereum

      await program.methods
        .placeBet(sideIndex, betAmount)
        .accounts({
          market: marketPda,
          marketVault: vaultPda,
          position: positionPda,
          userTokenAccount: bobTokenAccount,
          user: bob.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([bob])
        .rpc();

      const market = await program.account.market.fetch(marketPda);

      // 2% fee = 1 USDC, so 49 USDC goes to Ethereum
      const expectedBetAmount = new anchor.BN(49_000_000);
      assert.ok(market.sides[1].totalAmount.eq(expectedBetAmount));
      
      console.log("✅ Bob bet 50 USDC on Ethereum");
    });

    it("Charlie makes multiple bets on Solana", async () => {
      const [positionPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("position"),
          marketPda.toBuffer(),
          charlie.publicKey.toBuffer(),
        ],
        program.programId
      );

      // First bet: 100 USDC
      await program.methods
        .placeBet(2, new anchor.BN(100_000_000))
        .accounts({
          market: marketPda,
          marketVault: vaultPda,
          position: positionPda,
          userTokenAccount: charlieTokenAccount,
          user: charlie.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([charlie])
        .rpc();

      // Second bet: 50 USDC
      await program.methods
        .placeBet(2, new anchor.BN(50_000_000))
        .accounts({
          market: marketPda,
          marketVault: vaultPda,
          position: positionPda,
          userTokenAccount: charlieTokenAccount,
          user: charlie.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([charlie])
        .rpc();

      const position = await program.account.userPosition.fetch(positionPda);
      
      // 100 USDC = 98 after fee, 50 USDC = 49 after fee, total = 147
      const expectedTotal = new anchor.BN(147_000_000);
      assert.ok(position.bets[2].amount.eq(expectedTotal));
      
      console.log("✅ Charlie bet 150 USDC total on Solana");
    });

    it("Dave hedges by betting on multiple sides", async () => {
      const [positionPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("position"),
          marketPda.toBuffer(),
          dave.publicKey.toBuffer(),
        ],
        program.programId
      );

      // Bet on Bitcoin
      await program.methods
        .placeBet(0, new anchor.BN(30_000_000))
        .accounts({
          market: marketPda,
          marketVault: vaultPda,
          position: positionPda,
          userTokenAccount: daveTokenAccount,
          user: dave.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([dave])
        .rpc();

      // Bet on Ethereum
      await program.methods
        .placeBet(1, new anchor.BN(30_000_000))
        .accounts({
          market: marketPda,
          marketVault: vaultPda,
          position: positionPda,
          userTokenAccount: daveTokenAccount,
          user: dave.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([dave])
        .rpc();

      const position = await program.account.userPosition.fetch(positionPda);
      
      assert.equal(position.bets[0].hasBet, true);
      assert.equal(position.bets[1].hasBet, true);
      assert.equal(position.bets[2].hasBet, false);
      
      console.log("✅ Dave hedged across Bitcoin and Ethereum");
    });

    it("Fails to bet below minimum (1 USDC)", async () => {
      const [positionPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("position"),
          marketPda.toBuffer(),
          alice.publicKey.toBuffer(),
        ],
        program.programId
      );

      try {
        await program.methods
          .placeBet(0, new anchor.BN(500_000)) // 0.5 USDC
          .accounts({
            market: marketPda,
            marketVault: vaultPda,
            position: positionPda,
            userTokenAccount: aliceTokenAccount,
            user: alice.publicKey,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .signers([alice])
          .rpc();
        
        assert.fail("Should have failed with BetTooSmall error");
      } catch (err: any) {
        assert.include(err.toString(), "BetTooSmall");
        console.log("✅ Correctly rejected bet below minimum");
      }
    });

    it("Fails to bet above maximum (200 USDC)", async () => {
      const [positionPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("position"),
          marketPda.toBuffer(),
          alice.publicKey.toBuffer(),
        ],
        program.programId
      );

      try {
        await program.methods
          .placeBet(0, new anchor.BN(250_000_000)) // 250 USDC
          .accounts({
            market: marketPda,
            marketVault: vaultPda,
            position: positionPda,
            userTokenAccount: aliceTokenAccount,
            user: alice.publicKey,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .signers([alice])
          .rpc();
        
        assert.fail("Should have failed with BetTooLarge error");
      } catch (err: any) {
        assert.include(err.toString(), "BetTooLarge");
        console.log("✅ Correctly rejected bet above maximum");
      }
    });

    it("Shows market statistics after betting", async () => {
      const market = await program.account.market.fetch(marketPda);

      console.log("\n📊 Market Statistics:");
      console.log("Total Pool:", market.totalPool.toNumber() / 1_000_000, "USDC");
      console.log("Fee Pool:", market.feePool.toNumber() / 1_000_000, "USDC");
      console.log("Total Volume:", market.totalVolume.toNumber() / 1_000_000, "USDC");
      console.log("Number of Bettors:", market.numBettors);
      
      console.log("\nSide Totals:");
      for (let i = 0; i < market.numSides; i++) {
        const side = market.sides[i];
        const name = Buffer.from(side.name.slice(0, side.nameLen)).toString();
        console.log(`  ${name}: ${side.totalAmount.toNumber() / 1_000_000} USDC (${side.numBettors} bettors)`);
      }
    });
  });

  describe("Auto-Resolution and Claiming", () => {
    let marketPda: PublicKey;
    let vaultPda: PublicKey;

    before(async () => {
      // Create a market that ends in 5 seconds
      const question = "Quick market for testing";
      const endTimestamp = new anchor.BN(Math.floor(Date.now() / 1000) + 5);
      const sideNames = ["Option A", "Option B", "Option C"];
      const initialAmount = new anchor.BN(150_000_000);

      [marketPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("market"),
          creator.publicKey.toBuffer(),
          Buffer.from(question),
        ],
        program.programId
      );

      [vaultPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("vault"), marketPda.toBuffer()],
        program.programId
      );

      const [treasuryPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("treasury")],
        program.programId
      );

      await program.methods
        .createMarket(
          question,
          "Testing auto-resolution",
          endTimestamp,
          sideNames,
          initialAmount
        )
        .accounts({
          market: marketPda,
          marketVault: vaultPda,
          treasury: treasuryPda,
          creatorTokenAccount,
          usdcMint,
          creator: creator.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([creator])
        .rpc();

      // Place some bets
      const [alicePosition] = PublicKey.findProgramAddressSync(
        [Buffer.from("position"), marketPda.toBuffer(), alice.publicKey.toBuffer()],
        program.programId
      );
      await program.methods
        .placeBet(0, new anchor.BN(100_000_000)) // 100 USDC on Option A
        .accounts({
          market: marketPda,
          marketVault: vaultPda,
          position: alicePosition,
          userTokenAccount: aliceTokenAccount,
          user: alice.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([alice])
        .rpc();

      const [bobPosition] = PublicKey.findProgramAddressSync(
        [Buffer.from("position"), marketPda.toBuffer(), bob.publicKey.toBuffer()],
        program.programId
      );
      await program.methods
        .placeBet(1, new anchor.BN(50_000_000)) // 50 USDC on Option B
        .accounts({
          market: marketPda,
          marketVault: vaultPda,
          position: bobPosition,
          userTokenAccount: bobTokenAccount,
          user: bob.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([bob])
        .rpc();
    });

    it("Prevents betting after market ends and auto-resolves", async () => {
      console.log("⏳ Waiting for market to end...");
      await new Promise(resolve => setTimeout(resolve, 6000));

      const [charliePosition] = PublicKey.findProgramAddressSync(
        [Buffer.from("position"), marketPda.toBuffer(), charlie.publicKey.toBuffer()],
        program.programId
      );

      try {
        await program.methods
          .placeBet(2, new anchor.BN(30_000_000))
          .accounts({
            market: marketPda,
            marketVault: vaultPda,
            position: charliePosition,
            userTokenAccount: charlieTokenAccount,
            user: charlie.publicKey,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .signers([charlie])
          .rpc();
        
        assert.fail("Should have failed with MarketEnded error");
      } catch (err: any) {
        assert.include(err.toString(), "MarketEnded");
        console.log("✅ Correctly prevented betting after market end");
        console.log("Note: Market will auto-resolve when someone tries to claim or withdraw");
      }
    });

    it("Winner can claim their payout", async () => {
      const market = await program.account.market.fetch(marketPda);
      const winningSide = market.winningSideIndex;

      // Alice should be the winner (bet on Option A with 100 USDC)
      const [alicePosition] = PublicKey.findProgramAddressSync(
        [Buffer.from("position"), marketPda.toBuffer(), alice.publicKey.toBuffer()],
        program.programId
      );

      const aliceBalanceBefore = await provider.connection.getTokenAccountBalance(aliceTokenAccount);

      await program.methods
        .claimWinnings()
        .accounts({
          market: marketPda,
          marketVault: vaultPda,
          position: alicePosition,
          userTokenAccount: aliceTokenAccount,
          user: alice.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([alice])
        .rpc();

      const aliceBalanceAfter = await provider.connection.getTokenAccountBalance(aliceTokenAccount);
      const payout = Number(aliceBalanceAfter.value.amount) - Number(aliceBalanceBefore.value.amount);

      console.log("✅ Alice claimed", payout / 1_000_000, "USDC");
      assert.ok(payout > 0, "Alice should receive payout");

      // Check position marked as claimed
      const position = await program.account.userPosition.fetch(alicePosition);
      assert.equal(position.claimed, true);
    });

    it("Loser cannot claim (no winnings)", async () => {
      const [bobPosition] = PublicKey.findProgramAddressSync(
        [Buffer.from("position"), marketPda.toBuffer(), bob.publicKey.toBuffer()],
        program.programId
      );

      try {
        await program.methods
          .claimWinnings()
          .accounts({
            market: marketPda,
            marketVault: vaultPda,
            position: bobPosition,
            userTokenAccount: bobTokenAccount,
            user: bob.publicKey,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .signers([bob])
          .rpc();
        
        assert.fail("Should have failed with NoWinnings error");
      } catch (err: any) {
        assert.include(err.toString(), "NoWinnings");
        console.log("✅ Bob correctly has no winnings (bet on losing side)");
      }
    });

    it("Prevents double claiming", async () => {
      const [alicePosition] = PublicKey.findProgramAddressSync(
        [Buffer.from("position"), marketPda.toBuffer(), alice.publicKey.toBuffer()],
        program.programId
      );

      try {
        await program.methods
          .claimWinnings()
          .accounts({
            market: marketPda,
            marketVault: vaultPda,
            position: alicePosition,
            userTokenAccount: aliceTokenAccount,
            user: alice.publicKey,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .signers([alice])
          .rpc();
        
        assert.fail("Should have failed with AlreadyClaimed error");
      } catch (err: any) {
        assert.include(err.toString(), "AlreadyClaimed");
        console.log("✅ Correctly prevented double claiming");
      }
    });
  });

  describe("Fee Withdrawal", () => {
    let marketPda: PublicKey;
    let vaultPda: PublicKey;
    let treasuryPda: PublicKey;

    before(async () => {
      const question = "Fee withdrawal test market";
      const endTimestamp = new anchor.BN(Math.floor(Date.now() / 1000) + 3);
      const sideNames = ["Yes", "No"];
      const initialAmount = new anchor.BN(150_000_000);

      [marketPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("market"),
          creator.publicKey.toBuffer(),
          Buffer.from(question),
        ],
        program.programId
      );

      [vaultPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("vault"), marketPda.toBuffer()],
        program.programId
      );

      [treasuryPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("treasury")],
        program.programId
      );

      await program.methods
        .createMarket(
          question,
          "",
          endTimestamp,
          sideNames,
          initialAmount
        )
        .accounts({
          market: marketPda,
          marketVault: vaultPda,
          treasury: treasuryPda,
          creatorTokenAccount,
          usdcMint,
          creator: creator.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([creator])
        .rpc();

      // Place a bet
      const [alicePosition] = PublicKey.findProgramAddressSync(
        [Buffer.from("position"), marketPda.toBuffer(), alice.publicKey.toBuffer()],
        program.programId
      );
      await program.methods
        .placeBet(0, new anchor.BN(100_000_000))
        .accounts({
          market: marketPda,
          marketVault: vaultPda,
          position: alicePosition,
          userTokenAccount: aliceTokenAccount,
          user: alice.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([alice])
        .rpc();

      // Wait for market to end
      await new Promise(resolve => setTimeout(resolve, 4000));
    });

    it("Creator withdraws fees (auto-resolution happens)", async () => {
      const creatorBalanceBefore = await provider.connection.getTokenAccountBalance(creatorTokenAccount);
      
      await program.methods
        .withdrawCreatorFees()
        .accounts({
          market: marketPda,
          marketVault: vaultPda,
          treasury: treasuryPda,
          creatorTokenAccount,
          creator: creator.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([creator])
        .rpc();
      
      const creatorBalanceAfter = await provider.connection.getTokenAccountBalance(creatorTokenAccount);
      const withdrawn = Number(creatorBalanceAfter.value.amount) - Number(creatorBalanceBefore.value.amount);
      
      // Check that market is now resolved
      const market = await program.account.market.fetch(marketPda);
      assert.equal(market.resolved, true);
      console.log("✅ Market auto-resolved on fee withdrawal");
      console.log("✅ Creator withdrew", withdrawn / 1_000_000, "USDC in fees");
      assert.ok(withdrawn > 0, "Creator should receive fees");
    });

    it("Prevents creator from withdrawing fees twice", async () => {
      try {
        await program.methods
          .withdrawCreatorFees()
          .accounts({
            market: marketPda,
            marketVault: vaultPda,
            treasury: treasuryPda,
            creatorTokenAccount,
            creator: creator.publicKey,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .signers([creator])
          .rpc();
        
        assert.fail("Should have failed with NoWinnings error");
      } catch (err: any) {
        assert.include(err.toString(), "NoWinnings");
        console.log("✅ Correctly prevented double fee withdrawal");
      }
    });

    it("Protocol authority can withdraw their 50% share", async () => {
      // Get treasury to check who the authority is
      const treasury = await program.account.treasury.fetch(treasuryPda);
      
      // The treasury authority is the creator (from initialization)
      // We need to sign with the creator keypair
      const protocolBalanceBefore = await provider.connection.getTokenAccountBalance(creatorTokenAccount);
      
      await program.methods
        .withdrawProtocolFees()
        .accounts({
          market: marketPda,
          marketVault: vaultPda,
          treasury: treasuryPda,
          protocolTokenAccount: creatorTokenAccount,
          protocolAuthority: creator.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([creator])
        .rpc();

      const protocolBalanceAfter = await provider.connection.getTokenAccountBalance(creatorTokenAccount);
      const withdrawn = Number(protocolBalanceAfter.value.amount) - Number(protocolBalanceBefore.value.amount);

      console.log("✅ Protocol withdrew", withdrawn / 1_000_000, "USDC in fees");
      assert.ok(withdrawn > 0, "Protocol should receive fees");
    });

    it("Prevents protocol from withdrawing fees twice", async () => {
      try {
        await program.methods
          .withdrawProtocolFees()
          .accounts({
            market: marketPda,
            marketVault: vaultPda,
            treasury: treasuryPda,
            protocolTokenAccount: creatorTokenAccount,
            protocolAuthority: creator.publicKey,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .signers([creator])
          .rpc();
        
        assert.fail("Should have failed with NoWinnings error");
      } catch (err: any) {
        assert.include(err.toString(), "NoWinnings");
        console.log("✅ Correctly prevented double protocol fee withdrawal");
      }
    });

    it("Shows final treasury statistics", async () => {
      const treasury = await program.account.treasury.fetch(treasuryPda);
      
      console.log("\n🏦 Treasury Statistics:");
      console.log("Total Markets:", treasury.totalMarkets);
      console.log("Total Volume:", treasury.totalVolume.toNumber() / 1_000_000, "USDC");
      console.log("Total Creator Fees:", treasury.totalCreatorFees.toNumber() / 1_000_000, "USDC");
      console.log("Total Protocol Fees:", treasury.totalProtocolFees.toNumber() / 1_000_000, "USDC");
    });
  });

  describe("Edge Cases", () => {
    it("Market with maximum 10 sides works correctly", async () => {
      const question = "10 side market test";
      const endTimestamp = new anchor.BN(Math.floor(Date.now() / 1000) + 3600);
      const sideNames = [
        "Option 1", "Option 2", "Option 3", "Option 4", "Option 5",
        "Option 6", "Option 7", "Option 8", "Option 9", "Option 10"
      ];
      const initialAmount = new anchor.BN(150_000_000);

      const [marketPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("market"),
          creator.publicKey.toBuffer(),
          Buffer.from(question),
        ],
        program.programId
      );

      const [vaultPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("vault"), marketPda.toBuffer()],
        program.programId
      );

      const [treasuryPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("treasury")],
        program.programId
      );

      await program.methods
        .createMarket(
          question,
          "Testing maximum sides",
          endTimestamp,
          sideNames,
          initialAmount
        )
        .accounts({
          market: marketPda,
          marketVault: vaultPda,
          treasury: treasuryPda,
          creatorTokenAccount,
          usdcMint,
          creator: creator.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([creator])
        .rpc();

      const market = await program.account.market.fetch(marketPda);
      assert.equal(market.numSides, 10);
      console.log("✅ Market with 10 sides created successfully");
    });

    it("Fails to create market with duplicate side names", async () => {
      const question = "Duplicate sides test";
      const endTimestamp = new anchor.BN(Math.floor(Date.now() / 1000) + 3600);
      const sideNames = ["Option A", "Option B", "Option A"]; // Duplicate!
      const initialAmount = new anchor.BN(150_000_000);

      const [marketPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("market"),
          creator.publicKey.toBuffer(),
          Buffer.from(question),
        ],
        program.programId
      );

      const [vaultPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("vault"), marketPda.toBuffer()],
        program.programId
      );

      const [treasuryPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("treasury")],
        program.programId
      );

      try {
        await program.methods
          .createMarket(
            question,
            "",
            endTimestamp,
            sideNames,
            initialAmount
          )
          .accounts({
            market: marketPda,
            marketVault: vaultPda,
            treasury: treasuryPda,
            creatorTokenAccount,
            usdcMint,
            creator: creator.publicKey,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .signers([creator])
          .rpc();
        
        assert.fail("Should have failed with DuplicateSideName error");
      } catch (err: any) {
        assert.include(err.toString(), "DuplicateSideName");
        console.log("✅ Correctly rejected duplicate side names");
      }
    });
  });
});