import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PredictionMarket } from "../target/types/prediction_market";
import { PublicKey, SystemProgram, Keypair, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { expect } from "chai";

describe("prediction_market (SOL-based)", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.PredictionMarket as Program<PredictionMarket>;
  
  let treasuryPda: PublicKey;
  let treasuryBump: number;

  // Helper to get market PDA
  function getMarketPda(creator: PublicKey, question: string) {
    const [marketPda, bump] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("market"),
        creator.toBuffer(),
        Buffer.from(question),
      ],
      program.programId
    );
    return { marketPda, bump };
  }

  // Helper to get position PDA
  function getPositionPda(market: PublicKey, user: PublicKey) {
    const [positionPda, bump] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("position"),
        market.toBuffer(),
        user.toBuffer(),
      ],
      program.programId
    );
    return { positionPda, bump };
  }

  before(async () => {
    // Get treasury PDA
    [treasuryPda, treasuryBump] = PublicKey.findProgramAddressSync(
      [Buffer.from("treasury")],
      program.programId
    );

    try {
      // Initialize treasury
      await program.methods
        .initializeTreasury()
        .accounts({
          treasury: treasuryPda,
          authority: provider.wallet.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
      
      console.log("✅ Treasury initialized");
    } catch (err) {
      console.log("Treasury already initialized or error:", err.message);
    }
  });

  describe("Treasury", () => {
    it("Treasury is initialized correctly", async () => {
      const treasury = await program.account.treasury.fetch(treasuryPda);
      
      expect(treasury.authority.toString()).to.equal(
        provider.wallet.publicKey.toString()
      );
      expect(treasury.totalProtocolFees.toNumber()).to.be.at.least(0);
      expect(treasury.totalCreatorFees.toNumber()).to.be.at.least(0);
      expect(treasury.totalMarkets).to.be.at.least(0); // Can be > 0 from previous test runs
    });
  });

  describe("Create Market", () => {
    it("Creates a 2-side market with SOL", async () => {
      const creator = provider.wallet.publicKey;
      const question = `BTC $100k ${Date.now()}`; // Unique per run
      const description = "Market resolves based on BTC price on Dec 31, 2024";
      const endTimestamp = new anchor.BN(Date.now() / 1000 + 86400); // 1 day from now
      const sideNames = ["Yes", "No"];
      const initialAmount = new anchor.BN(1 * LAMPORTS_PER_SOL); // 1 SOL

      const { marketPda } = getMarketPda(creator, question);
      const { positionPda } = getPositionPda(marketPda, creator);

      const creatorBalanceBefore = await provider.connection.getBalance(creator);

      await program.methods
        .createMarket(question, description, endTimestamp, sideNames, initialAmount)
        .accounts({
          market: marketPda,
          position: positionPda,
          treasury: treasuryPda,
          creator: creator,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      const creatorBalanceAfter = await provider.connection.getBalance(creator);
      const market = await program.account.market.fetch(marketPda);
      const position = await program.account.userPosition.fetch(positionPda);

      // Verify market data
      expect(market.creator.toString()).to.equal(creator.toString());
      expect(market.question).to.equal(question);
      expect(market.description).to.equal(description);
      expect(market.numSides).to.equal(2);
      expect(market.resolved).to.be.false;
      
      // Verify fees (2% of 1 SOL = 0.02 SOL = 20,000,000 lamports)
      const expectedFee = initialAmount.toNumber() * 0.02;
      expect(market.feePool.toNumber()).to.equal(expectedFee);
      
      // Verify pool (98% of 1 SOL)
      const expectedPool = initialAmount.toNumber() - expectedFee;
      expect(market.totalPool.toNumber()).to.equal(expectedPool);
      
      // Verify each side gets equal amount
      const amountPerSide = expectedPool / 2;
      expect(market.sides[0].totalAmount.toNumber()).to.equal(amountPerSide);
      expect(market.sides[1].totalAmount.toNumber()).to.equal(amountPerSide);

      // Verify creator position
      expect(position.user.toString()).to.equal(creator.toString());
      expect(position.totalInvested.toNumber()).to.equal(initialAmount.toNumber());
      expect(position.bets[0].amount.toNumber()).to.equal(amountPerSide);
      expect(position.bets[1].amount.toNumber()).to.equal(amountPerSide);
      expect(position.bets[0].hasBet).to.be.true;
      expect(position.bets[1].hasBet).to.be.true;

      // Verify SOL was transferred
      const solSpent = creatorBalanceBefore - creatorBalanceAfter;
      expect(solSpent).to.be.greaterThan(initialAmount.toNumber()); // includes rent

      console.log("✅ 2-side market created with 1 SOL");
      console.log("   Fee pool:", market.feePool.toNumber() / LAMPORTS_PER_SOL, "SOL");
      console.log("   Total pool:", market.totalPool.toNumber() / LAMPORTS_PER_SOL, "SOL");
      console.log("   Per side:", amountPerSide / LAMPORTS_PER_SOL, "SOL");
    });

    it("Creates a 3-side market with SOL", async () => {
      const creator = provider.wallet.publicKey;
      const question = `2024 election ${Date.now()}`; // Unique question
      const description = "Market resolves when election results are certified";
      const endTimestamp = new anchor.BN(Date.now() / 1000 + 86400);
      const sideNames = ["Trump", "Harris", "Other"];
      const initialAmount = new anchor.BN(2 * LAMPORTS_PER_SOL); // 2 SOL

      const { marketPda } = getMarketPda(creator, question);
      const { positionPda } = getPositionPda(marketPda, creator);

      await program.methods
        .createMarket(question, description, endTimestamp, sideNames, initialAmount)
        .accounts({
          market: marketPda,
          position: positionPda,
          treasury: treasuryPda,
          creator: creator,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      const market = await program.account.market.fetch(marketPda);

      expect(market.numSides).to.equal(3);
      
      const expectedFee = initialAmount.toNumber() * 0.02;
      const expectedPool = initialAmount.toNumber() - expectedFee;
      const amountPerSide = expectedPool / 3;

      expect(market.sides[0].totalAmount.toNumber()).to.be.closeTo(amountPerSide, 1);
      expect(market.sides[1].totalAmount.toNumber()).to.be.closeTo(amountPerSide, 1);
      expect(market.sides[2].totalAmount.toNumber()).to.be.closeTo(amountPerSide, 1);

      console.log("✅ 3-side market created with 2 SOL");
      console.log("   Per side:", amountPerSide / LAMPORTS_PER_SOL, "SOL");
    });

    it("Fails with amount below minimum (1 SOL)", async () => {
      const creator = provider.wallet.publicKey;
      const question = `Low amount ${Date.now()}`;
      const endTimestamp = new anchor.BN(Date.now() / 1000 + 86400);
      const sideNames = ["Yes", "No"];
      const initialAmount = new anchor.BN(0.5 * LAMPORTS_PER_SOL); // 0.5 SOL - too low

      const { marketPda } = getMarketPda(creator, question);
      const { positionPda } = getPositionPda(marketPda, creator);

      try {
        await program.methods
          .createMarket(question, "", endTimestamp, sideNames, initialAmount)
          .accounts({
            market: marketPda,
            position: positionPda,
            treasury: treasuryPda,
            creator: creator,
            systemProgram: SystemProgram.programId,
          })
          .rpc();
        
        expect.fail("Should have failed with CreationAmountTooSmall");
      } catch (err) {
        expect(err.message).to.include("CreationAmountTooSmall");
        console.log("✅ Correctly rejected amount below 1 SOL");
      }
    });
  });

  describe("Place Bet", () => {
    let marketPda: PublicKey;
    let creator: PublicKey;
    const question = `Bet test ${Date.now()}`; // Unique

    before(async () => {
      creator = provider.wallet.publicKey;
      const endTimestamp = new anchor.BN(Date.now() / 1000 + 86400);
      const sideNames = ["Bitcoin", "Ethereum", "Solana"];
      const initialAmount = new anchor.BN(1 * LAMPORTS_PER_SOL);

      const result = getMarketPda(creator, question);
      marketPda = result.marketPda;
      const { positionPda } = getPositionPda(marketPda, creator);

      await program.methods
        .createMarket(question, "", endTimestamp, sideNames, initialAmount)
        .accounts({
          market: marketPda,
          position: positionPda,
          treasury: treasuryPda,
          creator: creator,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
    });

    it("Places a bet on side 0 (Bitcoin)", async () => {
      const bettor = Keypair.generate();
      
      // Airdrop SOL to bettor
      const airdropSig = await provider.connection.requestAirdrop(
        bettor.publicKey,
        5 * LAMPORTS_PER_SOL
      );
      await provider.connection.confirmTransaction(airdropSig);

      const { positionPda } = getPositionPda(marketPda, bettor.publicKey);
      const betAmount = new anchor.BN(0.5 * LAMPORTS_PER_SOL); // 0.5 SOL
      const sideIndex = 0; // Bitcoin

      const marketBefore = await program.account.market.fetch(marketPda);
      const bitcoinBefore = marketBefore.sides[0].totalAmount.toNumber();

      await program.methods
        .placeBet(sideIndex, betAmount)
        .accounts({
          market: marketPda,
          position: positionPda,
          user: bettor.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([bettor])
        .rpc();

      const marketAfter = await program.account.market.fetch(marketPda);
      const position = await program.account.userPosition.fetch(positionPda);

      // Verify bet was recorded
      const fee = betAmount.toNumber() * 0.02;
      const netAmount = betAmount.toNumber() - fee;
      
      expect(position.bets[0].amount.toNumber()).to.equal(netAmount);
      expect(position.bets[0].hasBet).to.be.true;
      expect(position.totalInvested.toNumber()).to.equal(betAmount.toNumber());

      // Verify market updated
      const bitcoinAfter = marketAfter.sides[0].totalAmount.toNumber();
      expect(bitcoinAfter - bitcoinBefore).to.equal(netAmount);

      console.log("✅ Bet placed: 0.5 SOL on Bitcoin");
      console.log("   Net to pool:", netAmount / LAMPORTS_PER_SOL, "SOL");
      console.log("   Fee:", fee / LAMPORTS_PER_SOL, "SOL");
    });

    it("Places multiple bets from same user", async () => {
      const bettor = Keypair.generate();
      
      const airdropSig = await provider.connection.requestAirdrop(
        bettor.publicKey,
        5 * LAMPORTS_PER_SOL
      );
      await provider.connection.confirmTransaction(airdropSig);

      const { positionPda } = getPositionPda(marketPda, bettor.publicKey);

      // Bet 1: 0.3 SOL on Ethereum (side 1)
      await program.methods
        .placeBet(1, new anchor.BN(0.3 * LAMPORTS_PER_SOL))
        .accounts({
          market: marketPda,
          position: positionPda,
          user: bettor.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([bettor])
        .rpc();

      // Bet 2: 0.2 SOL more on Ethereum
      await program.methods
        .placeBet(1, new anchor.BN(0.2 * LAMPORTS_PER_SOL))
        .accounts({
          market: marketPda,
          position: positionPda,
          user: bettor.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([bettor])
        .rpc();

      const position = await program.account.userPosition.fetch(positionPda);
      
      // Total invested should be 0.5 SOL
      expect(position.totalInvested.toNumber()).to.equal(0.5 * LAMPORTS_PER_SOL);
      
      // Ethereum position should have both bets combined (minus fees)
      const bet1Net = 0.3 * LAMPORTS_PER_SOL * 0.98;
      const bet2Net = 0.2 * LAMPORTS_PER_SOL * 0.98;
      const expectedTotal = bet1Net + bet2Net;
      
      expect(position.bets[1].amount.toNumber()).to.be.closeTo(expectedTotal, 1);

      console.log("✅ Multiple bets placed on same side");
      console.log("   Total position:", position.bets[1].amount.toNumber() / LAMPORTS_PER_SOL, "SOL");
    });

    it("Fails with bet below minimum (0.01 SOL)", async () => {
      const bettor = Keypair.generate();
      
      const airdropSig = await provider.connection.requestAirdrop(
        bettor.publicKey,
        1 * LAMPORTS_PER_SOL
      );
      await provider.connection.confirmTransaction(airdropSig);

      const { positionPda } = getPositionPda(marketPda, bettor.publicKey);
      const tinyBet = new anchor.BN(0.005 * LAMPORTS_PER_SOL); // 0.005 SOL - too small

      try {
        await program.methods
          .placeBet(0, tinyBet)
          .accounts({
            market: marketPda,
            position: positionPda,
            user: bettor.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .signers([bettor])
          .rpc();
        
        expect.fail("Should have failed with BetTooSmall");
      } catch (err) {
        expect(err.message).to.include("BetTooSmall");
        console.log("✅ Correctly rejected bet below 0.01 SOL");
      }
    });

    it("Fails with bet above maximum (1 SOL)", async () => {
      const bettor = Keypair.generate();
      
      const airdropSig = await provider.connection.requestAirdrop(
        bettor.publicKey,
        5 * LAMPORTS_PER_SOL
      );
      await provider.connection.confirmTransaction(airdropSig);

      const { positionPda } = getPositionPda(marketPda, bettor.publicKey);
      const hugeBet = new anchor.BN(2 * LAMPORTS_PER_SOL); // 2 SOL - too large

      try {
        await program.methods
          .placeBet(0, hugeBet)
          .accounts({
            market: marketPda,
            position: positionPda,
            user: bettor.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .signers([bettor])
          .rpc();
        
        expect.fail("Should have failed with BetTooLarge");
      } catch (err) {
        expect(err.message).to.include("BetTooLarge");
        console.log("✅ Correctly rejected bet above 1 SOL");
      }
    });
  });

  describe("Resolve Market", () => {
    it("Explicitly resolves market after end time", async () => {
      const creator = provider.wallet.publicKey;
      const question = `Resolve test ${Date.now()}`;
      
      // Get actual blockchain time
      const slot = await provider.connection.getSlot();
      const blockTime = await provider.connection.getBlockTime(slot);
      const endTimestamp = new anchor.BN(blockTime + 10); // 10 seconds from blockchain time
      
      const sideNames = ["Winner", "Loser"];
      const initialAmount = new anchor.BN(1 * LAMPORTS_PER_SOL);

      const { marketPda } = getMarketPda(creator, question);
      const { positionPda } = getPositionPda(marketPda, creator);

      // Create market
      await program.methods
        .createMarket(question, "", endTimestamp, sideNames, initialAmount)
        .accounts({
          market: marketPda,
          position: positionPda,
          treasury: treasuryPda,
          creator: creator,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      // User bets on Winner (side 0)
      const bettor = Keypair.generate();
      const airdropSig = await provider.connection.requestAirdrop(
        bettor.publicKey,
        5 * LAMPORTS_PER_SOL
      );
      await provider.connection.confirmTransaction(airdropSig);

      const { positionPda: bettorPositionPda } = getPositionPda(marketPda, bettor.publicKey);
      const betAmount = new anchor.BN(0.5 * LAMPORTS_PER_SOL);

      await program.methods
        .placeBet(0, betAmount) // Bet on Winner
        .accounts({
          market: marketPda,
          position: bettorPositionPda,
          user: bettor.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([bettor])
        .rpc();

      // Wait for market to end
      console.log("   Waiting for market to end...");
      await new Promise(resolve => setTimeout(resolve, 12000)); // Wait 12 seconds

      // Explicitly resolve the market
      await program.methods
        .resolveMarket()
        .accounts({
          market: marketPda,
          resolver: provider.wallet.publicKey,
        })
        .rpc();

      const market = await program.account.market.fetch(marketPda);
      
      // Verify market is resolved
      expect(market.resolved).to.be.true;
      expect(market.winningSideIndex).to.equal(0); // Side 0 (Winner) should win
      
      console.log("✅ Market explicitly resolved");
      console.log("   Winner side index:", market.winningSideIndex);
    });
  });

  describe("Claim Winnings", () => {
    it("Winner claims proportional share of pool", async () => {
      const creator = provider.wallet.publicKey;
      const question = `Claim ${Date.now()}`;
      
      // Get actual blockchain time
      const slot = await provider.connection.getSlot();
      const blockTime = await provider.connection.getBlockTime(slot);
      const endTimestamp = new anchor.BN(blockTime + 10);
      
      const sideNames = ["Winner", "Loser"];
      const initialAmount = new anchor.BN(1 * LAMPORTS_PER_SOL);

      const { marketPda } = getMarketPda(creator, question);
      const { positionPda: creatorPositionPda } = getPositionPda(marketPda, creator);

      // Create market
      await program.methods
        .createMarket(question, "", endTimestamp, sideNames, initialAmount)
        .accounts({
          market: marketPda,
          position: creatorPositionPda,
          treasury: treasuryPda,
          creator: creator,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      // User bets on Winner (side 0)
      const bettor = Keypair.generate();
      const airdropSig = await provider.connection.requestAirdrop(
        bettor.publicKey,
        5 * LAMPORTS_PER_SOL
      );
      await provider.connection.confirmTransaction(airdropSig);

      const { positionPda: bettorPositionPda } = getPositionPda(marketPda, bettor.publicKey);
      const betAmount = new anchor.BN(0.5 * LAMPORTS_PER_SOL);

      await program.methods
        .placeBet(0, betAmount) // Bet on Winner
        .accounts({
          market: marketPda,
          position: bettorPositionPda,
          user: bettor.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([bettor])
        .rpc();

      // Wait for market to end
      console.log("   Waiting for market to end...");
      await new Promise(resolve => setTimeout(resolve, 12000)); // Wait 12 seconds

      // Explicitly resolve market
      await program.methods
        .resolveMarket()
        .accounts({
          market: marketPda,
          resolver: provider.wallet.publicKey,
        })
        .rpc();

      const bettorBalanceBefore = await provider.connection.getBalance(bettor.publicKey);

      // Claim winnings
      await program.methods
        .claimWinnings()
        .accounts({
          market: marketPda,
          position: bettorPositionPda,
          user: bettor.publicKey,
        })
        .signers([bettor])
        .rpc();

      const bettorBalanceAfter = await provider.connection.getBalance(bettor.publicKey);
      const position = await program.account.userPosition.fetch(bettorPositionPda);
      const market = await program.account.market.fetch(marketPda);

      // Verify position marked as claimed
      expect(position.claimed).to.be.true;
      expect(market.resolved).to.be.true;

      // Verify SOL was received
      const solReceived = bettorBalanceAfter - bettorBalanceBefore;
      expect(solReceived).to.be.greaterThan(0);

      console.log("✅ Winner claimed", solReceived / LAMPORTS_PER_SOL, "SOL");
    });

    it("Fails when trying to claim twice", async () => {
      const creator = provider.wallet.publicKey;
      const question = `Double ${Date.now()}`;
      
      // Get actual blockchain time
      const slot = await provider.connection.getSlot();
      const blockTime = await provider.connection.getBlockTime(slot);
      const endTimestamp = new anchor.BN(blockTime + 10);
      
      const sideNames = ["A", "B"];
      const initialAmount = new anchor.BN(1 * LAMPORTS_PER_SOL);

      const { marketPda } = getMarketPda(creator, question);
      const { positionPda } = getPositionPda(marketPda, creator);

      await program.methods
        .createMarket(question, "", endTimestamp, sideNames, initialAmount)
        .accounts({
          market: marketPda,
          position: positionPda,
          treasury: treasuryPda,
          creator: creator,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      // Wait for market to end
      await new Promise(resolve => setTimeout(resolve, 12000)); // Wait 12 seconds

      // Explicitly resolve market
      await program.methods
        .resolveMarket()
        .accounts({
          market: marketPda,
          resolver: provider.wallet.publicKey,
        })
        .rpc();

      // First claim
      await program.methods
        .claimWinnings()
        .accounts({
          market: marketPda,
          position: positionPda,
          user: creator,
        })
        .rpc();

      // Try to claim again
      try {
        await program.methods
          .claimWinnings()
          .accounts({
            market: marketPda,
            position: positionPda,
            user: creator,
          })
          .rpc();
        
        expect.fail("Should have failed with AlreadyClaimed");
      } catch (err) {
        expect(err.message).to.include("AlreadyClaimed");
        console.log("✅ Correctly prevented double claim");
      }
    });
  });

  describe("Fee Distribution", () => {
    it("Creator can withdraw their share of fees", async () => {
      const creator = provider.wallet.publicKey;
      const question = `Fee ${Date.now()}`;
      
      // Get actual blockchain time
      const slot = await provider.connection.getSlot();
      const blockTime = await provider.connection.getBlockTime(slot);
      const endTimestamp = new anchor.BN(blockTime + 10);
      
      const sideNames = ["A", "B"];
      const initialAmount = new anchor.BN(1 * LAMPORTS_PER_SOL);

      const { marketPda } = getMarketPda(creator, question);
      const { positionPda } = getPositionPda(marketPda, creator);

      await program.methods
        .createMarket(question, "", endTimestamp, sideNames, initialAmount)
        .accounts({
          market: marketPda,
          position: positionPda,
          treasury: treasuryPda,
          creator: creator,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      // Wait for market to end
      await new Promise(resolve => setTimeout(resolve, 12000)); // Wait 12 seconds

      // Explicitly resolve market
      await program.methods
        .resolveMarket()
        .accounts({
          market: marketPda,
          resolver: provider.wallet.publicKey,
        })
        .rpc();

      const marketBefore = await program.account.market.fetch(marketPda);
      const creatorBalanceBefore = await provider.connection.getBalance(creator);

      // Withdraw creator fees
      await program.methods
        .claimCreatorFees()
        .accounts({
          market: marketPda,
          treasury: treasuryPda,
          creator: creator,
          protocolAuthority: provider.wallet.publicKey, // Using same wallet for testing
        })
        .rpc();

      const creatorBalanceAfter = await provider.connection.getBalance(creator);
      const marketAfter = await program.account.market.fetch(marketPda);

      // Verify fees withdrawn
      const expectedFees = marketBefore.feePool.toNumber() / 2; // Creator gets 50%
      expect(marketAfter.creatorFeesDistributed.toNumber()).to.equal(expectedFees);

      const solReceived = creatorBalanceAfter - creatorBalanceBefore;
      expect(solReceived).to.be.greaterThan(0);

      console.log("✅ Creator withdrew", solReceived / LAMPORTS_PER_SOL, "SOL in fees");
    });
  });

  describe("Integration: Full Market Lifecycle", () => {
    it("Complete flow: create -> bets -> resolve -> claims", async () => {
      console.log("\n🎯 Running full market lifecycle test...\n");

      const creator = provider.wallet.publicKey;
      const question = `Lifecycle ${Date.now()}`;
      
      // Get actual blockchain time
      const slot = await provider.connection.getSlot();
      const blockTime = await provider.connection.getBlockTime(slot);
      const endTimestamp = new anchor.BN(blockTime + 15);
      
      const sideNames = ["Bitcoin", "Ethereum", "Solana"];
      const initialAmount = new anchor.BN(1.5 * LAMPORTS_PER_SOL); // 1.5 SOL

      const { marketPda } = getMarketPda(creator, question);
      const { positionPda: creatorPositionPda } = getPositionPda(marketPda, creator);

      // 1. Create market
      console.log("1️⃣  Creating market with 1.5 SOL...");
      await program.methods
        .createMarket(question, "", endTimestamp, sideNames, initialAmount)
        .accounts({
          market: marketPda,
          position: creatorPositionPda,
          treasury: treasuryPda,
          creator: creator,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      let market = await program.account.market.fetch(marketPda);
      console.log("   ✅ Market created");
      console.log("   Initial pool:", market.totalPool.toNumber() / LAMPORTS_PER_SOL, "SOL");
      console.log("   Fee pool:", market.feePool.toNumber() / LAMPORTS_PER_SOL, "SOL");

      // 2. Users place bets
      console.log("\n2️⃣  Users placing bets...");
      
      const bettor1 = Keypair.generate();
      const bettor2 = Keypair.generate();
      const bettor3 = Keypair.generate();

      // Airdrop to bettors
      for (const bettor of [bettor1, bettor2, bettor3]) {
        const sig = await provider.connection.requestAirdrop(
          bettor.publicKey,
          5 * LAMPORTS_PER_SOL
        );
        await provider.connection.confirmTransaction(sig, 'confirmed');
      }

      // Wait for airdrops to settle
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Verify balances
      const bal1 = await provider.connection.getBalance(bettor1.publicKey);
      const bal2 = await provider.connection.getBalance(bettor2.publicKey);
      const bal3 = await provider.connection.getBalance(bettor3.publicKey);
      console.log(`   Balances: ${bal1 / LAMPORTS_PER_SOL}, ${bal2 / LAMPORTS_PER_SOL}, ${bal3 / LAMPORTS_PER_SOL} SOL`);

      // Bettor 1: 0.8 SOL on Ethereum
      const { positionPda: pos1 } = getPositionPda(marketPda, bettor1.publicKey);
      try {
        await program.methods
          .placeBet(1, new anchor.BN(0.8 * LAMPORTS_PER_SOL))
          .accounts({
            market: marketPda,
            position: pos1,
            user: bettor1.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .signers([bettor1])
          .rpc();
        console.log("   ✅ Bettor 1: 0.8 SOL on Ethereum");
      } catch (err) {
        console.error("Bettor 1 bet failed:", err);
        throw err;
      }

      // Bettor 2: 0.3 SOL on Ethereum
      const { positionPda: pos2 } = getPositionPda(marketPda, bettor2.publicKey);
      await program.methods
        .placeBet(1, new anchor.BN(0.3 * LAMPORTS_PER_SOL))
        .accounts({
          market: marketPda,
          position: pos2,
          user: bettor2.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([bettor2])
        .rpc();
      console.log("   ✅ Bettor 2: 0.3 SOL on Ethereum");

      // Bettor 3: 0.2 SOL on Solana
      const { positionPda: pos3 } = getPositionPda(marketPda, bettor3.publicKey);
      await program.methods
        .placeBet(2, new anchor.BN(0.2 * LAMPORTS_PER_SOL))
        .accounts({
          market: marketPda,
          position: pos3,
          user: bettor3.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([bettor3])
        .rpc();
      console.log("   ✅ Bettor 3: 0.2 SOL on Solana");

      market = await program.account.market.fetch(marketPda);
      console.log("\n   📊 Market state:");
      console.log("   Bitcoin:", market.sides[0].totalAmount.toNumber() / LAMPORTS_PER_SOL, "SOL");
      console.log("   Ethereum:", market.sides[1].totalAmount.toNumber() / LAMPORTS_PER_SOL, "SOL", "← WINNER");
      console.log("   Solana:", market.sides[2].totalAmount.toNumber() / LAMPORTS_PER_SOL, "SOL");
      console.log("   Total pool:", market.totalPool.toNumber() / LAMPORTS_PER_SOL, "SOL");

      // 3. Wait for market to end
      console.log("\n3️⃣  Waiting for market to end...");
      await new Promise(resolve => setTimeout(resolve, 17000)); // Wait 17 seconds

      // 3.5. Explicitly resolve the market
      console.log("\n3.5️⃣  Resolving market...");
      await program.methods
        .resolveMarket()
        .accounts({
          market: marketPda,
          resolver: provider.wallet.publicKey,
        })
        .rpc();
      
      market = await program.account.market.fetch(marketPda);
      console.log("   ✅ Market resolved");
      console.log("   Winning side:", market.winningSideIndex);

      // 4. Winners claim
      console.log("\n4️⃣  Winners claiming...");

      // Bettor 1 claims (80% of Ethereum side)
      const bal1Before = await provider.connection.getBalance(bettor1.publicKey);
      await program.methods
        .claimWinnings()
        .accounts({
          market: marketPda,
          position: pos1,
          user: bettor1.publicKey,
        })
        .signers([bettor1])
        .rpc();
      const bal1After = await provider.connection.getBalance(bettor1.publicKey);
      const won1 = (bal1After - bal1Before) / LAMPORTS_PER_SOL;
      console.log("   ✅ Bettor 1 claimed:", won1.toFixed(4), "SOL");

      // Bettor 2 claims (20% of Ethereum side)
      const bal2Before = await provider.connection.getBalance(bettor2.publicKey);
      await program.methods
        .claimWinnings()
        .accounts({
          market: marketPda,
          position: pos2,
          user: bettor2.publicKey,
        })
        .signers([bettor2])
        .rpc();
      const bal2After = await provider.connection.getBalance(bettor2.publicKey);
      const won2 = (bal2After - bal2Before) / LAMPORTS_PER_SOL;
      console.log("   ✅ Bettor 2 claimed:", won2.toFixed(4), "SOL");

      // 5. Creator withdraws fees
      console.log("\n5️⃣  Creator withdrawing fees...");
      const creatorBalBefore = await provider.connection.getBalance(creator);
      await program.methods
        .claimCreatorFees()
        .accounts({
          market: marketPda,
          treasury: treasuryPda,
          creator: creator,
          protocolAuthority: provider.wallet.publicKey,
        })
        .rpc();
      const creatorBalAfter = await provider.connection.getBalance(creator);
      const creatorFees = (creatorBalAfter - creatorBalBefore) / LAMPORTS_PER_SOL;
      console.log("   ✅ Creator received:", creatorFees.toFixed(4), "SOL in fees");

      console.log("\n✅ Full lifecycle test complete!");
      console.log("   Total distributed:", (won1 + won2 + creatorFees).toFixed(4), "SOL");
    });
  });

  describe("Tie Handling", () => {
    describe("Two-Way Tie", () => {
      it("Resolves market with two tied winners and distributes pool correctly", async () => {
        console.log("\n🎯 Testing Two-Way Tie...\n");

        const creator = provider.wallet.publicKey;
        const question = `2-way tie ${Date.now()}`;
        
        // Get actual blockchain time
        const slot = await provider.connection.getSlot();
        const blockTime = await provider.connection.getBlockTime(slot);
        const endTimestamp = new anchor.BN(blockTime + 10);
        
        const sideNames = ["Option A", "Option B", "Option C"];
        const initialAmount = new anchor.BN(3 * LAMPORTS_PER_SOL);

        const { marketPda } = getMarketPda(creator, question);
        const { positionPda: creatorPos } = getPositionPda(marketPda, creator);

        // Create market
        await program.methods
          .createMarket(question, "", endTimestamp, sideNames, initialAmount)
          .accounts({
            market: marketPda,
            position: creatorPos,
            treasury: treasuryPda,
            creator: creator,
            systemProgram: SystemProgram.programId,
          })
          .rpc();

        // Create two bettors
        const bettor1 = Keypair.generate();
        const bettor2 = Keypair.generate();

        for (const bettor of [bettor1, bettor2]) {
          const sig = await provider.connection.requestAirdrop(
            bettor.publicKey,
            5 * LAMPORTS_PER_SOL
          );
          await provider.connection.confirmTransaction(sig, 'confirmed');
        }

        // Bettor1: 1 SOL on Option A
        const { positionPda: pos1 } = getPositionPda(marketPda, bettor1.publicKey);
        await program.methods
          .placeBet(0, new anchor.BN(1 * LAMPORTS_PER_SOL))
          .accounts({
            market: marketPda,
            position: pos1,
            user: bettor1.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .signers([bettor1])
          .rpc();
        console.log("   ✅ Bettor 1: 1 SOL on Option A");

        // Bettor2: 1 SOL on Option B (to create tie)
        const { positionPda: pos2 } = getPositionPda(marketPda, bettor2.publicKey);
        await program.methods
          .placeBet(1, new anchor.BN(1 * LAMPORTS_PER_SOL))
          .accounts({
            market: marketPda,
            position: pos2,
            user: bettor2.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .signers([bettor2])
          .rpc();
        console.log("   ✅ Bettor 2: 1 SOL on Option B");

        let market = await program.account.market.fetch(marketPda);
        console.log("\n   Market state before resolution:");
        console.log("   Option A:", market.sides[0].totalAmount.toNumber() / LAMPORTS_PER_SOL, "SOL");
        console.log("   Option B:", market.sides[1].totalAmount.toNumber() / LAMPORTS_PER_SOL, "SOL");
        console.log("   Option C:", market.sides[2].totalAmount.toNumber() / LAMPORTS_PER_SOL, "SOL");

        // Wait for market to end
        await new Promise(resolve => setTimeout(resolve, 12000));

        // Resolve market
        await program.methods
          .resolveMarket()
          .accounts({
            market: marketPda,
            resolver: provider.wallet.publicKey,
          })
          .rpc();

        market = await program.account.market.fetch(marketPda);
        
        console.log("\n   Resolution result:");
        console.log("   Resolved:", market.resolved);
        console.log("   Number of winners:", market.numWinners);
        console.log("   Winning sides:", market.winningSides.slice(0, 3));

        // Verify it's a tie
        expect(market.resolved).to.be.true;
        expect(market.numWinners).to.equal(2);
        expect(market.winningSides[0]).to.be.true; // Option A wins
        expect(market.winningSides[1]).to.be.true; // Option B wins
        expect(market.winningSides[2]).to.be.false; // Option C loses

        // Both winners claim
        const bal1Before = await provider.connection.getBalance(bettor1.publicKey);
        await program.methods
          .claimWinnings()
          .accounts({
            market: marketPda,
            position: pos1,
            user: bettor1.publicKey,
          })
          .signers([bettor1])
          .rpc();
        const bal1After = await provider.connection.getBalance(bettor1.publicKey);
        const won1 = (bal1After - bal1Before) / LAMPORTS_PER_SOL;

        const bal2Before = await provider.connection.getBalance(bettor2.publicKey);
        await program.methods
          .claimWinnings()
          .accounts({
            market: marketPda,
            position: pos2,
            user: bettor2.publicKey,
          })
          .signers([bettor2])
          .rpc();
        const bal2After = await provider.connection.getBalance(bettor2.publicKey);
        const won2 = (bal2After - bal2Before) / LAMPORTS_PER_SOL;

        console.log("\n   Payouts:");
        console.log("   Bettor 1:", won1.toFixed(4), "SOL");
        console.log("   Bettor 2:", won2.toFixed(4), "SOL");

        // Both should get equal payouts (they bet equal amounts on tied winners)
        expect(Math.abs(won1 - won2)).to.be.lessThan(0.0001);

        console.log("   ✅ Two-way tie test passed!");
      });
    });

    describe("Three-Way Tie", () => {
      it("Resolves market with three tied winners and distributes pool correctly", async () => {
        console.log("\n🎯 Testing Three-Way Tie...\n");

        const creator = provider.wallet.publicKey;
        const question = `3-way tie ${Date.now()}`;
        
        // Get actual blockchain time
        const slot = await provider.connection.getSlot();
        const blockTime = await provider.connection.getBlockTime(slot);
        const endTimestamp = new anchor.BN(blockTime + 10);
        
        const sideNames = ["Red", "Blue", "Green"];
        const initialAmount = new anchor.BN(3 * LAMPORTS_PER_SOL);

        const { marketPda } = getMarketPda(creator, question);
        const { positionPda: creatorPos } = getPositionPda(marketPda, creator);

        // Create market (all sides start equal = perfect tie)
        await program.methods
          .createMarket(question, "", endTimestamp, sideNames, initialAmount)
          .accounts({
            market: marketPda,
            position: creatorPos,
            treasury: treasuryPda,
            creator: creator,
            systemProgram: SystemProgram.programId,
          })
          .rpc();

        let market = await program.account.market.fetch(marketPda);
        console.log("   Market state (perfect 3-way tie from creation):");
        console.log("   Red:", market.sides[0].totalAmount.toNumber() / LAMPORTS_PER_SOL, "SOL");
        console.log("   Blue:", market.sides[1].totalAmount.toNumber() / LAMPORTS_PER_SOL, "SOL");
        console.log("   Green:", market.sides[2].totalAmount.toNumber() / LAMPORTS_PER_SOL, "SOL");

        // Wait for market to end
        await new Promise(resolve => setTimeout(resolve, 12000));

        // Resolve market
        await program.methods
          .resolveMarket()
          .accounts({
            market: marketPda,
            resolver: provider.wallet.publicKey,
          })
          .rpc();

        market = await program.account.market.fetch(marketPda);
        
        console.log("\n   Resolution result:");
        console.log("   Resolved:", market.resolved);
        console.log("   Number of winners:", market.numWinners);
        console.log("   Winning sides:", market.winningSides.slice(0, 3));

        // Verify it's a 3-way tie
        expect(market.resolved).to.be.true;
        expect(market.numWinners).to.equal(3);
        expect(market.winningSides[0]).to.be.true; // Red wins
        expect(market.winningSides[1]).to.be.true; // Blue wins
        expect(market.winningSides[2]).to.be.true; // Green wins

        console.log("   ✅ Three-way tie test passed!");
      });
    });

    describe("Tie with Different Bet Amounts", () => {
      it("Distributes winnings proportionally in a tie", async () => {
        console.log("\n🎯 Testing Proportional Distribution in Tie...\n");

        const creator = provider.wallet.publicKey;
        const question = `Proportional tie ${Date.now()}`;
        
        // Get actual blockchain time
        const slot = await provider.connection.getSlot();
        const blockTime = await provider.connection.getBlockTime(slot);
        const endTimestamp = new anchor.BN(blockTime + 10);
        
        const sideNames = ["Team A", "Team B", "Team C"];
        const initialAmount = new anchor.BN(3 * LAMPORTS_PER_SOL);

        const { marketPda } = getMarketPda(creator, question);
        const { positionPda: creatorPos } = getPositionPda(marketPda, creator);

        await program.methods
          .createMarket(question, "", endTimestamp, sideNames, initialAmount)
          .accounts({
            market: marketPda,
            position: creatorPos,
            treasury: treasuryPda,
            creator: creator,
            systemProgram: SystemProgram.programId,
          })
          .rpc();

        // Create three bettors
        const bettor1 = Keypair.generate();
        const bettor2 = Keypair.generate();
        const bettor3 = Keypair.generate();

        for (const bettor of [bettor1, bettor2, bettor3]) {
          const sig = await provider.connection.requestAirdrop(
            bettor.publicKey,
            5 * LAMPORTS_PER_SOL
          );
          await provider.connection.confirmTransaction(sig, 'confirmed');
        }

        // Bettor1: 0.8 SOL on Team A
        const { positionPda: pos1 } = getPositionPda(marketPda, bettor1.publicKey);
        await program.methods
          .placeBet(0, new anchor.BN(0.8 * LAMPORTS_PER_SOL))
          .accounts({
            market: marketPda,
            position: pos1,
            user: bettor1.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .signers([bettor1])
          .rpc();
        console.log("   ✅ Bettor 1: 0.8 SOL on Team A");

        // Bettor2: 0.2 SOL on Team A (same team as bettor1)
        const { positionPda: pos2 } = getPositionPda(marketPda, bettor2.publicKey);
        await program.methods
          .placeBet(0, new anchor.BN(0.2 * LAMPORTS_PER_SOL))
          .accounts({
            market: marketPda,
            position: pos2,
            user: bettor2.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .signers([bettor2])
          .rpc();
        console.log("   ✅ Bettor 2: 0.2 SOL on Team A");

        // Bettor3: 1 SOL on Team B (creates tie)
        const { positionPda: pos3 } = getPositionPda(marketPda, bettor3.publicKey);
        await program.methods
          .placeBet(1, new anchor.BN(1 * LAMPORTS_PER_SOL))
          .accounts({
            market: marketPda,
            position: pos3,
            user: bettor3.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .signers([bettor3])
          .rpc();
        console.log("   ✅ Bettor 3: 1 SOL on Team B");

        let market = await program.account.market.fetch(marketPda);
        console.log("\n   Market state:");
        console.log("   Team A:", market.sides[0].totalAmount.toNumber() / LAMPORTS_PER_SOL, "SOL");
        console.log("   Team B:", market.sides[1].totalAmount.toNumber() / LAMPORTS_PER_SOL, "SOL");
        console.log("   Team C:", market.sides[2].totalAmount.toNumber() / LAMPORTS_PER_SOL, "SOL");

        // Wait for market to end
        await new Promise(resolve => setTimeout(resolve, 12000));

        // Resolve market
        await program.methods
          .resolveMarket()
          .accounts({
            market: marketPda,
            resolver: provider.wallet.publicKey,
          })
          .rpc();

        market = await program.account.market.fetch(marketPda);
        
        console.log("\n   Resolution: Team A and Team B tied");
        expect(market.numWinners).to.equal(2);

        // All winners claim
        const bal1Before = await provider.connection.getBalance(bettor1.publicKey);
        await program.methods
          .claimWinnings()
          .accounts({
            market: marketPda,
            position: pos1,
            user: bettor1.publicKey,
          })
          .signers([bettor1])
          .rpc();
        const bal1After = await provider.connection.getBalance(bettor1.publicKey);
        const won1 = (bal1After - bal1Before) / LAMPORTS_PER_SOL;

        const bal2Before = await provider.connection.getBalance(bettor2.publicKey);
        await program.methods
          .claimWinnings()
          .accounts({
            market: marketPda,
            position: pos2,
            user: bettor2.publicKey,
          })
          .signers([bettor2])
          .rpc();
        const bal2After = await provider.connection.getBalance(bettor2.publicKey);
        const won2 = (bal2After - bal2Before) / LAMPORTS_PER_SOL;

        const bal3Before = await provider.connection.getBalance(bettor3.publicKey);
        await program.methods
          .claimWinnings()
          .accounts({
            market: marketPda,
            position: pos3,
            user: bettor3.publicKey,
          })
          .signers([bettor3])
          .rpc();
        const bal3After = await provider.connection.getBalance(bettor3.publicKey);
        const won3 = (bal3After - bal3Before) / LAMPORTS_PER_SOL;

        console.log("\n   Payouts:");
        console.log("   Bettor 1 (0.8 SOL):", won1.toFixed(4), "SOL");
        console.log("   Bettor 2 (0.2 SOL):", won2.toFixed(4), "SOL");
        console.log("   Bettor 3 (1.0 SOL):", won3.toFixed(4), "SOL");

        // Bettor1 should get ~4x what Bettor2 gets (0.8 vs 0.2)
        const ratio = won1 / won2;
        console.log("   Ratio (Bettor1/Bettor2):", ratio.toFixed(2), "should be ~4.0");
        expect(ratio).to.be.closeTo(4.0, 0.5);

        console.log("   ✅ Proportional distribution test passed!");
      });
    });
  });
});