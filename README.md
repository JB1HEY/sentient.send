# Solana Prediction Markets - Smart Contract

A decentralized prediction market platform on Solana, similar to Polymarket but fully on-chain and permissionless.

## 🏗️ Architecture

**Smart Contract Features:**
- ✅ Anyone can create prediction markets (0.1 SOL fee)
- ✅ Automated Market Maker (AMM) for pricing
- ✅ YES/NO binary outcomes
- ✅ 2% platform fee on bets
- ✅ Fully decentralized escrow
- ✅ Liquidity provision support

## 📁 File Structure

```
prediction-market/
├── Anchor.toml                 # Anchor configuration
├── Cargo.toml                  # Rust dependencies
├── package.json                # Node dependencies
├── programs/
│   └── prediction-market/
│       ├── Cargo.toml
│       └── src/
│           ├── lib.rs          # Main program entry
│           ├── state.rs        # Account structures
│           ├── error.rs        # Error definitions
│           └── instructions/
│               ├── mod.rs
│               ├── create_market.rs    # Create new market
│               ├── place_bet.rs        # Place YES/NO bets
│               ├── resolve_market.rs   # Resolve market outcome
│               ├── claim_winnings.rs   # Claim winnings
│               └── add_liquidity.rs    # Add liquidity
└── tests/
    └── prediction-market.test.ts # Full test suite
```

## 🚀 Setup Instructions

### 1. Install Prerequisites

**Install Rust:**
```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source $HOME/.cargo/env
```

**Install Solana CLI:**
```bash
sh -c "$(curl -sSfL https://release.solana.com/stable/install)"
export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"
```

**Install Anchor:**
```bash
cargo install --git https://github.com/coral-xyz/anchor avm --locked --force
avm install latest
avm use latest
```

**Verify installations:**
```bash
solana --version    # Should show v1.18.x or higher
anchor --version    # Should show anchor-cli 0.29.0
rustc --version     # Should show rustc 1.75.0 or higher
```

### 2. Create Solana Wallet

```bash
solana-keygen new
```

Save your seed phrase securely!

### 3. Configure for Devnet

```bash
solana config set --url devnet
```

### 4. Airdrop SOL for Testing

```bash
solana airdrop 2
```

### 5. Install Dependencies

```bash
npm install
```

### 6. Build the Program

```bash
anchor build
```

This will:
- Compile the Rust smart contract
- Generate TypeScript types in `target/types/`
- Create the program binary in `target/deploy/`

### 7. Get Your Program ID

```bash
anchor keys list
```

Copy the program ID and update it in:
- `Anchor.toml` (all three `[programs.*]` sections)
- `programs/prediction-market/src/lib.rs` (in the `declare_id!` macro)

### 8. Rebuild After Updating Program ID

```bash
anchor build
```

### 9. Deploy to Devnet

```bash
anchor deploy
```

### 10. Run Tests

```bash
anchor test
```

## 📊 Smart Contract Overview

### Accounts

**Market:**
- Stores question, end time, pools, outcome
- Uses PDA: `["market", creator, question]`
- Initial liquidity split 50/50 between YES/NO

**UserPosition:**
- Tracks user's YES/NO shares
- Uses PDA: `["position", market, user]`
- Stores investment amount and claim status

**Treasury:**
- Global account for platform fees
- Uses PDA: `["treasury"]`
- Accumulates 2% of all bets + creation fees

### Instructions

#### 1. create_market
```rust
pub fn create_market(
    ctx: Context<CreateMarket>,
    question: String,          // Max 200 chars
    description: String,       // Max 500 chars
    end_timestamp: i64,        // Unix timestamp
    initial_liquidity: u64,    // Minimum 1 SOL
) -> Result<()>
```
- Pays 0.1 SOL creation fee
- Deposits initial liquidity (split 50/50)
- Creates Market PDA

#### 2. place_bet
```rust
pub fn place_bet(
    ctx: Context<PlaceBet>,
    amount: u64,               // Minimum 0.01 SOL
    is_yes: bool,              // true = YES, false = NO
) -> Result<()>
```
- Charges 2% platform fee
- Uses AMM to calculate shares
- Updates pools automatically
- Creates/updates UserPosition PDA

#### 3. resolve_market
```rust
pub fn resolve_market(
    ctx: Context<ResolveMarket>,
    outcome: bool,             // true = YES won, false = NO won
) -> Result<()>
```
- Only creator can resolve
- Must be after end_timestamp
- Transfers fees to treasury
- Marks market as resolved

#### 4. claim_winnings
```rust
pub fn claim_winnings(
    ctx: Context<ClaimWinnings>,
) -> Result<()>
```
- Winners get 1 SOL per winning share
- Transfers from market to user
- Marks position as claimed

#### 5. add_liquidity
```rust
pub fn add_liquidity(
    ctx: Context<AddLiquidity>,
    amount: u64,               // Minimum 0.1 SOL
) -> Result<()>
```
- Adds liquidity to both pools equally
- Maintains current price
- Deepens the market

## 🧮 AMM Formula

**Constant Product:** `yes_pool * no_pool = k`

**YES Price:** `no_pool / (yes_pool + no_pool)`

**Shares Out:** `current_pool - (k / new_opposite_pool)`

Example:
- Initial: YES pool = 1000, NO pool = 1000, k = 1,000,000
- YES price = 1000/(1000+1000) = 0.5 (50%)
- User bets 100 on YES
- New NO pool = 1100
- New YES pool = 1,000,000/1100 = 909
- User gets 1000 - 909 = 91 shares
- New YES price = 1100/2009 = 0.547 (54.7%)

## 🔧 Testing Locally

**Start local validator:**
```bash
solana-test-validator
```

**In another terminal, run tests:**
```bash
anchor test --skip-local-validator
```

## 🌐 Deploying to Mainnet

1. **Switch to mainnet:**
```bash
solana config set --url mainnet-beta
```

2. **Fund your wallet:**
```bash
# Send real SOL to your wallet address
solana address
```

3. **Deploy:**
```bash
anchor deploy --provider.cluster mainnet
```

4. **Update frontend config with mainnet program ID**

## 💰 Economic Model

**Revenue Streams:**
- Market creation fee: 0.1 SOL per market
- Trading fee: 2% of every bet
- All fees go to Treasury PDA

**Example Economics:**
- 100 markets created = 10 SOL
- 10,000 SOL in volume = 200 SOL in fees
- Total revenue = 210 SOL

## 🔐 Security Features

- ✅ All funds held in escrow (Market PDA)
- ✅ No admin keys (fully decentralized)
- ✅ Market creator can't steal funds
- ✅ Winners automatically entitled to payouts
- ✅ Time-locked resolution (after end_timestamp)
- ✅ Protected against reentrancy
- ✅ Math overflow checks

## 📝 Next Steps

1. ✅ Smart contract complete
2. ⏳ Build Next.js frontend (next phase)
3. ⏳ Add USDC support (optional)
4. ⏳ Build indexer for market discovery
5. ⏳ Deploy to mainnet
6. ⏳ Marketing & launch

## 🐛 Common Issues

**"Program not found"**
- Run `anchor build` then `anchor deploy`
- Make sure program ID matches in all files

**"Insufficient funds"**
- Run `solana airdrop 2` (devnet only)

**"Transaction simulation failed"**
- Check account sizes
- Verify PDA derivations
- Look at logs: `solana logs`

## 📚 Resources

- [Anchor Documentation](https://www.anchor-lang.com/)
- [Solana Cookbook](https://solanacookbook.com/)
- [Solana Program Library](https://spl.solana.com/)

## 🎯 What Makes This Special

Unlike traditional prediction markets:
- **Fully on-chain** - No centralized backend
- **Permissionless** - Anyone can create markets
- **Transparent** - All bets visible on Solana explorer
- **Composable** - Other apps can integrate
- **Low fees** - 2% vs 5-10% on centralized platforms
- **Fast** - Solana's 400ms block times

Ready to build the frontend? Let me know!