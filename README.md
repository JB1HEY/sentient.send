# Solana Sentiment-Based Prediction Market

A fully decentralized, sentiment-driven prediction market on Solana. Unlike traditional prediction markets that require manual resolution, this protocol distributes **proportional payouts** based on the final pool sentiment when the market ends.

## 🎯 Key Innovation

**No Manual Resolution Required!**

Traditional prediction markets have a binary winner/loser outcome. This market uses **proportional payouts** where:
- Everyone gets paid based on their share of their pool
- The side with higher sentiment (larger final pool) gets more per share
- No one loses everything - fair distribution based on market sentiment
- Perfect for meme markets, subjective questions, and community sentiment

## 📊 Live Demo

- **Program ID**: `2Z7sJer7qW1DJcoZQHJ5i96Gw4LxQqRSpPfd33yVhRVZ` (Localnet)
- **Anchor Version**: 0.32.1
- **Solana Version**: 2.2.20

## 🏗️ Architecture

### Smart Contract Features
- ✅ Permissionless market creation (0.1 SOL fee)
- ✅ Automated Market Maker (AMM) for dynamic pricing
- ✅ Proportional sentiment-based payouts
- ✅ 2% platform fee on all bets
- ✅ Fully decentralized escrow via PDAs
- ✅ Support for adding liquidity

### Technical Stack
- **Framework**: Anchor 0.32.1
- **Language**: Rust
- **Blockchain**: Solana
- **AMM Formula**: Constant Product (k = x × y)

## 📁 Project Structure

```
prediction-market/
├── Anchor.toml                 # Anchor configuration
├── Cargo.toml                  # Workspace configuration
├── package.json                # Node.js dependencies
├── programs/
│   └── prediction-market/
│       ├── Cargo.toml          # Program dependencies
│       └── src/
│           ├── lib.rs          # Program entry point & instructions
│           ├── state.rs        # Account structures
│           ├── error.rs        # Error definitions
│           └── instructions/
│               ├── mod.rs              # Module exports
│               ├── create_market.rs    # Create prediction market
│               ├── place_bet.rs        # Place YES/NO bets
│               ├── claim_winnings.rs   # Claim proportional payouts
│               └── add_liquidity.rs    # Add market liquidity
└── tests/
    └── prediction-market.test.ts # Full test suite (7 tests)
```

## 🚀 Quick Start

### Prerequisites

```bash
# Check versions
solana --version    # 2.2.20 or compatible
anchor --version    # 0.32.1
node --version      # 23.x
rustc --version     # 1.82.0
```

### Installation

```bash
# Clone repository
git clone <your-repo>
cd prediction-market

# Install dependencies
npm install

# Build program
anchor build

# Get program ID
anchor keys list

# Sync program IDs (updates Anchor.toml and lib.rs)
anchor keys sync

# Rebuild with correct IDs
anchor build
```

### Local Testing

```bash
# Terminal 1 - Start local validator
solana-test-validator

# Terminal 2 - Run tests
solana config set --url localhost
anchor test --skip-local-validator
```

### Deploy to Devnet

```bash
# Configure for devnet
solana config set --url devnet

# Airdrop SOL
solana airdrop 2

# Deploy
anchor deploy

# Run tests on devnet
anchor test
```

## 📊 Account Structures

### Market Account
```rust
pub struct Market {
    pub creator: Pubkey,           // Market creator
    pub question: String,          // Question (max 200 chars)
    pub description: String,       // Description (max 500 chars)
    pub end_timestamp: i64,        // Market end time
    pub resolved: bool,            // Has market ended?
    pub outcome: bool,             // Final outcome
    pub yes_pool: u64,            // SOL in YES pool
    pub no_pool: u64,             // SOL in NO pool
    pub k: u128,                  // AMM constant (yes_pool * no_pool)
    pub total_yes_shares: u64,    // Total YES shares issued
    pub total_no_shares: u64,     // Total NO shares issued
    pub treasury_fee: u64,        // Accumulated platform fees
    pub creation_fee: u64,        // Market creation fee paid
    pub total_volume: u64,        // Total trading volume
    pub num_bettors: u32,         // Unique bettors count
    pub question_hash: [u8; 32],  // Question hash for PDA
    pub bump: u8,                 // PDA bump seed
}
```

**PDA**: `["market", creator, question_hash]`

### UserPosition Account
```rust
pub struct UserPosition {
    pub user: Pubkey,              // Position owner
    pub market: Pubkey,            // Market reference
    pub yes_shares: u64,           // YES shares owned
    pub no_shares: u64,            // NO shares owned
    pub amount_invested: u64,      // Total SOL invested
    pub claimed: bool,             // Payout claimed?
    pub bump: u8,                  // PDA bump seed
}
```

**PDA**: `["position", market, user]`

### Treasury Account
```rust
pub struct Treasury {
    pub authority: Pubkey,         // Treasury authority
    pub total_fees: u64,           // All-time fees
    pub total_markets: u32,        // Markets created
    pub total_volume: u64,         // All-time volume
    pub bump: u8,                  // PDA bump seed
}
```

**PDA**: `["treasury"]`

## 🔧 Instructions

### 1. create_market
Create a new prediction market.

```typescript
await program.methods
  .createMarket(
    "Will it rain tomorrow?",                    // question
    "Weather prediction market",                 // description
    new anchor.BN(Date.now() / 1000 + 86400),   // end_timestamp (24h)
    new anchor.BN(1_000_000_000),               // initial_liquidity (1 SOL)
    Array.from(questionSeed)                     // question_hash (SHA-256)
  )
  .accounts({
    market: marketPda,
    treasury: treasuryPda,
    creator: creator.publicKey,
    systemProgram: SystemProgram.programId,
  })
  .rpc();
```

**Requirements:**
- 0.1 SOL creation fee
- Minimum 1 SOL initial liquidity
- Question ≤ 200 characters
- Description ≤ 500 characters
- End timestamp in future

### 2. place_bet
Place a YES or NO bet.

```typescript
await program.methods
  .placeBet(
    new anchor.BN(1_000_000_000),  // 1 SOL
    true                            // true = YES, false = NO
  )
  .accounts({
    market: marketPda,
    position: userPositionPda,
    user: user.publicKey,
    systemProgram: SystemProgram.programId,
  })
  .rpc();
```

**Mechanics:**
- 2% platform fee deducted
- Shares calculated via AMM
- Pools updated automatically
- Position created/updated

### 3. claim_winnings
Claim proportional payout after market ends.

```typescript
await program.methods
  .claimWinnings()
  .accounts({
    market: marketPda,
    position: userPositionPda,
    user: user.publicKey,
    systemProgram: SystemProgram.programId,
  })
  .rpc();
```

**Payout Formula:**
```
YES payout = (yes_shares / total_yes_shares) × yes_pool_value
NO payout = (no_shares / total_no_shares) × no_pool_value
Total = YES payout + NO payout
```

### 4. add_liquidity
Add liquidity to deepen the market.

```typescript
await program.methods
  .addLiquidity(new anchor.BN(1_000_000_000))  // 1 SOL
  .accounts({
    market: marketPda,
    liquidityProvider: provider.publicKey,
    systemProgram: SystemProgram.programId,
  })
  .rpc();
```

## 🧮 AMM Mechanics

### Constant Product Formula
```
k = yes_pool × no_pool (constant)
```

### Price Calculation
```
YES price = no_pool / (yes_pool + no_pool)
NO price = yes_pool / (yes_pool + no_pool)
```

### Share Calculation (Buying YES)
```
1. new_no_pool = current_no_pool + bet_amount
2. new_yes_pool = k / new_no_pool
3. shares_received = current_yes_pool - new_yes_pool
```

### Example Trade
```
Initial State:
├─ YES pool: 1,000 SOL
├─ NO pool: 1,000 SOL
├─ k = 1,000,000
└─ YES price = 50%

User bets 100 SOL on YES (after 2% fee = 98 SOL):
├─ New NO pool = 1,098 SOL
├─ New YES pool = 1,000,000 / 1,098 = 911 SOL
├─ Shares received = 1,000 - 911 = 89 shares
└─ New YES price = 1,098 / 2,009 = 54.7%
```

## 💰 Proportional Payout Model

### How It Works

Unlike traditional markets where losers get nothing, **everyone gets paid**:

1. **Market Ends**: Trading stops at `end_timestamp`
2. **Final Sentiment**: Pools reflect community sentiment
3. **Proportional Distribution**:
   - Each YES share gets: `yes_pool_value / total_yes_shares`
   - Each NO share gets: `no_pool_value / total_no_shares`

### Example Payout

**Final Market State:**
```
├─ YES pool: 3,000 SOL (60% sentiment)
├─ NO pool: 2,000 SOL (40% sentiment)
├─ Total YES shares: 2,500
└─ Total NO shares: 1,800
```

**Alice's Position (YES bettor):**
```
├─ Owns: 500 YES shares
├─ YES pool value per share: 3,000 / 2,500 = 1.2 SOL
├─ Payout: 500 × 1.2 = 600 SOL
└─ Result: 20% profit (if invested 500 SOL)
```

**Bob's Position (NO bettor):**
```
├─ Owns: 450 NO shares
├─ NO pool value per share: 2,000 / 1,800 = 1.11 SOL
├─ Payout: 450 × 1.11 = 500 SOL
└─ Result: Break-even (if invested 500 SOL)
```

## 🧪 Test Suite

Run the comprehensive test suite:

```bash
anchor test --skip-local-validator
```

**Tests (7 total):**
1. ✅ Creates sentiment-based prediction market
2. ✅ Alice bets heavily on 'Chicken' (YES)
3. ✅ Bob and Charlie bet on 'Egg' (NO)
4. ✅ Cannot bet after market ends
5. ✅ Everyone claims proportional payouts
6. ✅ Cannot claim twice
7. ✅ Shows final market statistics

**Test Scenario:** "Chicken vs Egg" meme market
- Alice: 2 SOL on Chicken → Drives price to 89.8%
- Bob: 1 SOL on Egg → Adjusts to 11.4%
- Charlie: 1.5 SOL on Egg → Final Egg sentiment 88.6%
- All users claim proportional payouts after 40 seconds

## 🔐 Security Features

- ✅ All funds in decentralized escrow (Market PDA)
- ✅ No admin keys - fully permissionless
- ✅ Time-locked claiming (after end_timestamp)
- ✅ Overflow protection with checked math
- ✅ PDA-based access control
- ✅ Anti-double-claim protection
- ✅ Proportional fairness - no one loses 100%

## 💡 Economic Model

### Revenue Streams
- Market creation: 0.1 SOL per market
- Trading fee: 2% of every bet
- All fees → Treasury PDA

### Example Economics
```
100 markets created = 10 SOL
10,000 SOL trading volume = 200 SOL fees
Total treasury = 210 SOL
```

## 🎯 Use Cases

### Perfect For
- 🎭 Meme markets ("Chicken vs Egg", "Pineapple on Pizza")
- 🎨 Subjective predictions ("Best movie of 2024")
- 🏆 Community sentiment ("Which feature should we build?")
- 🎪 Fun betting ("Will the launch be delayed?")
- 📊 Opinion polling ("Should we rebrand?")

### Not Ideal For
- ❌ Binary factual events requiring proof
- ❌ Long-term markets where liquidity is critical
- ❌ High-stakes decisions needing objective resolution

## 🐛 Troubleshooting

### Build Errors

**IndexMap version error:**
```bash
# Solana's Rust version doesn't support indexmap 2.12+
# Solution: Use compatible Solana version (2.2.20)
solana --version
rustc --version  # Should be 1.82.0
```

**Cargo.lock version 4 error:**
```bash
rm Cargo.lock
rustup default 1.82.0
anchor build
```

### Deployment Errors

**Program ID mismatch:**
```bash
anchor keys sync
anchor build
anchor deploy
```

**400 Bad Request (devnet):**
```bash
# Devnet can be unstable, use localnet or alternative RPC
solana config set --url https://rpc.ankr.com/solana_devnet
# Or use localnet
solana-test-validator
solana config set --url localhost
```

### Test Errors

**Account already exists:**
```bash
# Clean test ledger between runs
pkill -9 solana-test-validator
rm -rf test-ledger
solana-test-validator &
anchor test --skip-local-validator
```

**Market not ended:**
```bash
# Increase end_timestamp in tests
# Current: 40 seconds + 45 second wait
```

## 📚 Resources

- [Anchor Documentation](https://www.anchor-lang.com/)
- [Solana Cookbook](https://solanacookbook.com/)
- [Constant Product AMM Explained](https://docs.uniswap.org/contracts/v2/concepts/protocol-overview/how-uniswap-works)
- [Solana CLI](https://docs.solanalabs.com/cli)

## 🤝 Contributing

Contributions welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Submit a pull request

## 📄 License

MIT License

## ⚠️ Disclaimer

This is experimental software for educational purposes. Use at your own risk. Not financial advice. Always audit smart contracts before mainnet deployment.

---

## 🎉 What Makes This Special

Unlike traditional prediction markets:
- **Fully on-chain** - No centralized backend
- **Permissionless** - Anyone can create markets
- **Fair payouts** - Everyone gets something based on sentiment
- **Transparent** - All bets visible on Solana explorer
- **Composable** - Other apps can integrate
- **Low fees** - 2% vs 5-10% on centralized platforms
- **Fast** - Solana's 400ms block times
- **No resolution needed** - Sentiment-based payouts eliminate disputes

**Built with ❤️ on Solana**

*Making prediction markets fun, fair, and fully on-chain*