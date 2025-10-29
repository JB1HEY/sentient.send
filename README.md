# Prediction Market Smart Contract

A Solana smart contract (program) for decentralized prediction markets built with Anchor framework.

## 🎯 Overview

This smart contract enables:
- Permissionless market creation
- Multi-outcome prediction markets (2-10 outcomes)
- Parimutuel betting system (winners split the pool)
- Automated market resolution
- Fair fee distribution (50% creator, 50% protocol)

## 🛠️ Tech Stack

- **Framework**: Anchor 0.30.1
- **Language**: Rust
- **Blockchain**: Solana
- **Cluster**: Devnet (for testing) / Mainnet (production)

## 📦 Prerequisites

- Rust 1.75+
- Solana CLI 1.18+
- Anchor CLI 0.30.1
- Node.js 18+ (for testing)

## 🚀 Quick Start

### 1. Install Dependencies

```bash
# Install Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Install Solana
sh -c "$(curl -sSfL https://release.solana.com/v1.18.0/install)"

# Install Anchor
cargo install --git https://github.com/coral-xyz/anchor avm --locked --force
avm install 0.30.1
avm use 0.30.1
```

### 2. Clone and Setup

```bash
cd prediction-market
anchor build
```

### 3. Configure Solana

```bash
# Set to devnet for testing
solana config set --url devnet

# Create/set your wallet
solana-keygen new
# or
solana config set --keypair ~/.config/solana/id.json

# Get devnet SOL
solana airdrop 2
```

### 4. Update Program ID

```bash
# After first build, get program ID
anchor keys list

# Update in Anchor.toml and lib.rs
declare_id!("YOUR_PROGRAM_ID");
```

### 5. Deploy

```bash
anchor build
anchor deploy
```

### 6. Initialize Treasury

```bash
anchor run initialize
```

## 📁 Project Structure

```
prediction-market/
├── programs/
│   └── prediction-market/
│       └── src/
│           └── lib.rs              # Main contract code
│
├── tests/
│   └── prediction-market.ts        # TypeScript tests
│
├── migrations/
│   └── deploy.ts                   # Deployment script
│
├── Anchor.toml                     # Anchor config
├── Cargo.toml                      # Rust dependencies
└── package.json                    # Node dependencies
```

## 🏗️ Architecture

### Accounts

#### 1. Market
Stores all market data:
```rust
pub struct Market {
    pub creator: Pubkey,                    // Market creator
    pub question: String,                   // "Who will win?"
    pub description: String,                // Details
    pub end_timestamp: i64,                 // Unix timestamp
    pub resolved: bool,                     // Resolution status
    pub winning_side_index: u8,             // Winner index
    pub total_pool: u64,                    // Total SOL in pool
    pub num_sides: u8,                      // Number of outcomes
    pub sides: [Side; MAX_SIDES],          // Outcome data
    pub fee_pool: u64,                      // Accumulated fees
    pub creator_fees_distributed: u64,      // Fees paid to creator
    pub protocol_fees_distributed: u64,     // Fees paid to protocol
    pub total_volume: u64,                  // All-time volume
    pub num_bettors: u32,                   // Unique bettors
    pub creation_amount: u64,               // Initial deposit
    pub bump: u8,                           // PDA bump
}
```

PDA Seeds: `["market", creator, question]`

#### 2. UserPosition
Tracks user's bets per market:
```rust
pub struct UserPosition {
    pub user: Pubkey,                       // User wallet
    pub market: Pubkey,                     // Market address
    pub bets: [SideBet; MAX_SIDES],        // Bets per outcome
    pub total_invested: u64,                // Total SOL bet
    pub claimed: bool,                      // Winnings claimed
    pub bump: u8,                           // PDA bump
}
```

PDA Seeds: `["position", market, user]`

#### 3. Treasury
Global protocol state:
```rust
pub struct Treasury {
    pub authority: Pubkey,                  // Protocol owner
    pub total_protocol_fees: u64,           // Cumulative protocol fees
    pub total_creator_fees: u64,            // Cumulative creator fees
    pub total_markets: u32,                 // Total markets created
    pub total_volume: u64,                  // All-time volume
    pub bump: u8,                           // PDA bump
}
```

PDA Seeds: `["treasury"]`

## 🔧 Instructions

### 1. initialize_treasury
One-time setup, creates treasury account.

**Accounts:**
- `treasury` (init): Treasury PDA
- `authority` (signer): Protocol owner
- `system_program`

**Access:** Anyone (only works once)

```rust
pub fn initialize_treasury(ctx: Context<InitializeTreasury>) -> Result<()>
```

---

### 2. create_market
Create a new prediction market.

**Parameters:**
- `question: String` - Market question (max 200 chars)
- `description: String` - Details (max 500 chars)
- `end_timestamp: i64` - Unix timestamp when betting ends
- `side_names: Vec<String>` - Outcome names (2-10, max 50 chars each)
- `initial_amount: u64` - Initial liquidity (min 1 SOL)

**Accounts:**
- `market` (init): New market PDA
- `position` (init): Creator's position PDA
- `treasury` (mut): Treasury PDA
- `creator` (signer, mut): Pays for accounts and liquidity
- `system_program`

**Fees:** 2% of initial_amount

**What it does:**
1. Validates inputs (length, timestamp, uniqueness)
2. Creates market account
3. Splits initial liquidity equally across outcomes
4. Creates creator's position
5. Takes 2% creation fee
6. Updates treasury stats

```rust
pub fn create_market(
    ctx: Context<CreateMarket>,
    question: String,
    description: String,
    end_timestamp: i64,
    side_names: Vec<String>,
    initial_amount: u64,
) -> Result<()>
```

---

### 3. place_bet
Bet on a market outcome.

**Parameters:**
- `side_index: u8` - Outcome to bet on (0-based)
- `amount: u64` - SOL to bet (0.01-1 SOL)

**Accounts:**
- `market` (mut): Market account
- `position` (init_if_needed, mut): User's position
- `user` (signer, mut): Pays for bet
- `system_program`

**Fees:** 2% of amount

**What it does:**
1. Validates market is active
2. Takes 2% fee
3. Adds net amount to outcome pool
4. Updates user position
5. Increments bettor count if first bet

**Constraints:**
- Market must not be resolved
- Current time < end_timestamp
- 0.01 SOL ≤ amount ≤ 1 SOL

```rust
pub fn place_bet(
    ctx: Context<PlaceBet>,
    side_index: u8,
    amount: u64,
) -> Result<()>
```

---

### 4. claim_winnings
Claim winnings after market resolves.

**Accounts:**
- `market` (mut): Market account
- `position` (mut): User's position
- `user` (signer, mut): Receives winnings

**What it does:**
1. Auto-resolves market if needed
2. Checks user bet on winning outcome
3. Calculates proportional payout
4. Transfers SOL to user
5. Marks position as claimed

**Payout Formula:**
```
payout = (user_bet / winning_side_total) * total_pool
```

**Constraints:**
- Market must be resolved
- User must have bet on winner
- Can't claim twice

```rust
pub fn claim_winnings(ctx: Context<ClaimWinnings>) -> Result<()>
```

---

### 5. claim_creator_fees
Creator claims their fees (auto-pays protocol).

**Accounts:**
- `market` (mut): Market account
- `treasury` (mut): Treasury PDA
- `creator` (signer, mut): Market creator, receives 50%
- `protocol_authority` (mut): Protocol wallet, receives 50%

**What it does:**
1. Auto-resolves market if needed
2. Validates creator identity
3. Calculates 50/50 split
4. Transfers 50% to creator
5. Transfers 50% to protocol (automatic!)
6. Updates tracking fields

**Constraints:**
- Market must be resolved
- Only creator can call
- Can't claim twice

```rust
pub fn claim_creator_fees(ctx: Context<ClaimCreatorFees>) -> Result<()>
```

---

## 🤖 Auto-Resolution

Markets automatically resolve when:
1. Current time > end_timestamp
2. Anyone calls an instruction that triggers resolution

**Resolution Logic:**
```rust
fn try_resolve_market(market: &mut Market) -> Result<()> {
    if market.resolved || now < market.end_timestamp {
        return Ok(());
    }
    
    // Winner = outcome with most SOL
    let winning_side = find_max_amount_side(market.sides);
    market.winning_side_index = winning_side;
    market.resolved = true;
    
    Ok(())
}
```

Triggered by:
- `place_bet` (will fail but resolve market)
- `claim_winnings`
- `claim_creator_fees`

## 💰 Economics

### Fee Structure
```
Creation: 2% of initial_amount
Trading:  2% per bet
Split:    50% creator, 50% protocol
```

### Example Market
```
Initial: 10 SOL (9.8 SOL after 2% fee)
  → 4.9 SOL to "Yes"
  → 4.9 SOL to "No"

User bets 1 SOL on "Yes":
  → 0.02 SOL fee
  → 0.98 SOL to "Yes" pool
  
"Yes" pool: 5.88 SOL
"No" pool:  4.9 SOL
Total:      10.78 SOL

Market resolves: "Yes" wins
User's share: (0.98 / 5.88) * 10.78 = 1.796 SOL

Creator fees: 0.01 SOL (50% of 0.02)
Protocol fees: 0.01 SOL (50% of 0.02)
```

## 🔒 Security Features

### Access Control
- Only creator can claim creator fees
- Only winners can claim winnings
- Only protocol authority in treasury
- No custody - all SOL in PDAs

### Safety Checks
- Overflow/underflow protection (checked math)
- Duplicate outcome prevention
- End time validation
- Bet limit enforcement
- Double-claim prevention

### Economic Security
- Parimutuel system (always solvent)
- No house edge (except fees)
- Transparent odds
- Immutable market terms

## 🧪 Testing

```bash
# Run all tests
anchor test

# Test specific file
anchor test --skip-deploy tests/prediction-market.ts

# With logs
anchor test -- --features "verbose"
```

### Test Coverage
- ✅ Market creation
- ✅ Bet placement
- ✅ Multi-outcome support
- ✅ Auto-resolution
- ✅ Winnings calculation
- ✅ Fee distribution
- ✅ Edge cases (no bets, ties, etc.)

## 📊 Constants

Located in `lib.rs`:

```rust
pub const LAMPORTS_PER_SOL: u64 = 1_000_000_000;
pub const MIN_BET: u64 = LAMPORTS_PER_SOL / 100;      // 0.01 SOL
pub const MAX_BET: u64 = LAMPORTS_PER_SOL;            // 1 SOL
pub const MIN_CREATION_AMOUNT: u64 = LAMPORTS_PER_SOL; // 1 SOL
pub const CREATION_FEE_BPS: u16 = 200;                // 2%
pub const BET_FEE_BPS: u16 = 200;                     // 2%
pub const MAX_SIDES: usize = 10;                      // Max outcomes
pub const MIN_SIDES: usize = 2;                       // Min outcomes
pub const MAX_SIDE_NAME_LEN: usize = 50;              // Max chars
pub const MAX_QUESTION_LEN: usize = 200;
pub const MAX_DESCRIPTION_LEN: usize = 500;
```

## 🚨 Error Codes

```rust
#[error_code]
pub enum ErrorCode {
    MarketEnded,              // Betting closed
    MarketNotEnded,           // Can't resolve yet
    MarketAlreadyResolved,    // Already resolved
    QuestionTooLong,          // Question > 200 chars
    DescriptionTooLong,       // Description > 500 chars
    InvalidEndTimestamp,      // End time in past
    BetTooSmall,             // < 0.01 SOL
    BetTooLarge,             // > 1 SOL
    NoWinnings,              // No money to claim
    AlreadyClaimed,          // Can't claim twice
    MathOverflow,            // Arithmetic error
    CreationAmountTooSmall,  // < 1 SOL
    InvalidSideIndex,        // Side doesn't exist
    InvalidSideCount,        // Not 2-10 sides
    SideNameTooLong,         // Name > 50 chars
    DuplicateSideName,       // Same name twice
    UnauthorizedCreator,     // Not market creator
    FeesAlreadyClaimed,      // Can't claim twice
    NoFeesToClaim,           // No fees available
    InvalidProtocolAuthority, // Wrong protocol wallet
}
```

## 🔄 Upgrade Process

To upgrade the program:

```bash
# 1. Make changes to lib.rs
# 2. Update version in Cargo.toml
# 3. Build
anchor build

# 4. Deploy upgrade
anchor upgrade target/deploy/prediction_market.so \
  --program-id YOUR_PROGRAM_ID \
  --provider.cluster devnet
```

## 🌐 Deployment

### Devnet
```bash
solana config set --url devnet
anchor build
anchor deploy
anchor run initialize
```

### Mainnet
```bash
solana config set --url mainnet-beta
anchor build --verifiable
anchor deploy
anchor run initialize

# Verify build
anchor verify YOUR_PROGRAM_ID
```

## 📈 Monitoring

Check program data:
```bash
# Get treasury info
solana account TREASURY_PDA_ADDRESS

# Get market info  
solana account MARKET_PDA_ADDRESS

# Monitor logs
solana logs | grep YOUR_PROGRAM_ID
```

## 🐛 Debugging

Enable logs in tests:
```typescript
// In anchor test
before(() => {
  provider.connection.onLogs("all", (logs) => {
    console.log(logs);
  });
});
```

Common issues:
- Account size too small → Increase in `#[account]` space
- PDA collision → Change seeds
- Math overflow → Use checked operations
- Insufficient rent → Add more lamports

## 🔐 Production Checklist

Before mainnet:
- [ ] Audit code for vulnerabilities
- [ ] Test all edge cases
- [ ] Verify program build
- [ ] Set correct protocol authority
- [ ] Fund protocol wallet
- [ ] Initialize treasury
- [ ] Test with real money (small amounts)
- [ ] Monitor initial markets closely
- [ ] Have upgrade authority ready

## 📝 IDL Generation

```bash
# Build generates IDL automatically
anchor build

# IDL location
target/idl/prediction_market.json

# Copy to frontend
cp target/idl/prediction_market.json ../frontend/src/idl/
```

## 🤝 Contributing

To add features:
1. Add instruction to `lib.rs`
2. Add tests
3. Update IDL
4. Build and test
5. Deploy to devnet
6. Update frontend

## 📚 Resources

- [Anchor Docs](https://www.anchor-lang.com/)
- [Solana Docs](https://docs.solana.com/)
- [Solana Cookbook](https://solanacookbook.com/)
- [Anchor Examples](https://github.com/coral-xyz/anchor/tree/master/examples)

## 🔧 Useful Commands

```bash
# Clean build
anchor clean && anchor build

# Test with logs
RUST_LOG=debug anchor test

# Deploy to specific cluster
anchor deploy --provider.cluster devnet

# Get program size
du -h target/deploy/prediction_market.so

# Estimate rent
solana rent BYTES

# Close program (careful!)
solana program close YOUR_PROGRAM_ID
```

---

Built with Anchor on Solana ⚓