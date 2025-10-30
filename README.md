# Sentient Send - Prediction Market Platform

A full-stack decentralized prediction market platform on Solana with a Next.js frontend.

## 📋 Table of Contents
- [Overview](#-overview)
- [Tech Stack](#️-tech-stack)
- [Prerequisites](#-prerequisites)
- [Quick Start](#-quick-start)
- [Project Structure](#-project-structure)
- [Architecture](#️-architecture)
- [Instructions](#-instructions)
- [Auto-Resolution](#-auto-resolution)
- [Economics](#-economics)
- [Security Features](#-security-features)
- [Testing](#-testing)
- [Constants](#-constants)
- [Error Codes](#-error-codes)
- [Deployment](#-deployment)
- [Useful Commands](#-useful-commands)

## 🎯 Overview

**Sentient Send** is a complete prediction market platform consisting of:
- **Smart Contract**: Solana program built with Anchor framework
- **Frontend**: Next.js 14 application with TypeScript and Tailwind CSS
- **Features**:
  - Permissionless market creation
  - Multi-outcome prediction markets (2-10 outcomes)
  - Parimutuel betting system (winners split the pool)
  - Automated market resolution
  - Fair fee distribution (50% creator, 50% protocol)
  - Real-time market tracking
  - User portfolio management

## 🛠️ Tech Stack

### Smart Contract
- **Framework**: Anchor 0.32.1
- **Language**: Rust
- **Blockchain**: Solana
- **Cluster**: Devnet (for testing) / Mainnet (production)
- **Program ID**: `C3LRoEztvLPioY3ruddYGTT9qxzvqBivHzgmpGJuQ9CT`

### Frontend
- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Wallet**: Solana Wallet Adapter
- **State Management**: React Hooks

## 📦 Prerequisites

- Rust 1.75+
- Solana CLI 1.18+
- Anchor CLI 0.32.1
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
avm install 0.32.1
avm use 0.32.1
```

### 2. Clone and Setup

```bash
git clone <your-repo-url>
cd sentient.send
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

After deployment, the program ID is already set in the project:
```
Program ID: C3LRoEztvLPioY3ruddYGTT9qxzvqBivHzgmpGJuQ9CT
```

If you need to deploy your own instance:
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

The treasury must be initialized once before any markets can be created:

```bash
# Using npm script
npm run init-treasury

# Or manually with ts-node
ts-node init-treasury.ts

# Verify treasury was created
npm run inspect-treasury
```

### 7. Run Frontend (Optional)

To run the Next.js frontend application:

```bash
cd frontend
npm install
npm run dev
```

The frontend will be available at `http://localhost:3000`

**Frontend Features:**
- Browse active prediction markets
- Create new markets with custom outcomes
- Place bets on market outcomes
- View your portfolio and positions
- Claim winnings from resolved markets
- Real-time market statistics

## 📁 Project Structure

```
sentient.send/
├── programs/
│   └── prediction-market/
│       ├── src/
│       │   ├── lib.rs              # Main contract code
│       │   ├── state.rs            # Account structures
│       │   └── error.rs            # Error definitions
│       └── Cargo.toml              # Rust dependencies
│
├── tests/
│   └── prediction-market.test.ts   # TypeScript tests
│
├── frontend/                       # Next.js frontend application
│   ├── src/
│   │   ├── app/                   # Next.js app directory
│   │   ├── components/            # React components
│   │   ├── hooks/                 # Custom hooks
│   │   ├── lib/                   # Anchor & utilities
│   │   └── types/                 # TypeScript types
│   └── package.json
│
├── init-treasury.ts                # Treasury initialization script
├── inspect-treasury.ts             # Treasury inspection tool
├── Anchor.toml                     # Anchor configuration
├── Cargo.toml                      # Workspace dependencies
└── package.json                    # Root dependencies
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

### 6. resolve_market
Explicitly resolve a market after end time (optional).

**Accounts:**
- `market` (mut): Market account
- `resolver` (signer): Anyone can call this

**What it does:**
1. Checks if market has ended (current time > end_timestamp)
2. Finds the outcome with the most SOL
3. Sets that outcome as the winner
4. Marks market as resolved

**Note:** This instruction is optional as markets auto-resolve when `claim_winnings` or `claim_creator_fees` are called. However, it's useful for:
- Explicitly triggering resolution
- Allowing resolution before anyone claims
- Frontend displaying resolution status immediately

**Constraints:**
- Market must not already be resolved
- Current time must be > end_timestamp

```rust
pub fn resolve_market(ctx: Context<ResolveMarket>) -> Result<()>
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
- `resolve_market` (explicit resolution)

**Anyone can call `resolve_market`** after the end timestamp to explicitly trigger resolution.

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

# Run with detailed output
anchor test -- --nocapture

# Test specific file
anchor test --skip-deploy tests/prediction-market.test.ts

# Test with logs
RUST_LOG=debug anchor test
```

### Test Coverage
The test suite includes:
- ✅ Treasury initialization
- ✅ Market creation with validation
- ✅ Bet placement on multiple outcomes
- ✅ Multi-outcome market support (2-10 sides)
- ✅ Automatic market resolution
- ✅ Winnings calculation and distribution
- ✅ Fee distribution (creator + protocol)
- ✅ Edge cases (no bets, ties, invalid inputs)
- ✅ Error handling (expired markets, invalid bets)
- ✅ Position tracking and claims
- ✅ Double-claim prevention

## 👨‍💻 Development Workflow

### Adding New Features

1. **Update Smart Contract**
   ```bash
   # Edit programs/prediction-market/src/lib.rs
   # Add new instruction or modify existing
   
   # Build
   anchor build
   
   # Generate new IDL
   # (automatically generated on build)
   ```

2. **Add Tests**
   ```bash
   # Edit tests/prediction-market.test.ts
   # Add test cases for new functionality
   
   # Run tests
   anchor test
   ```

3. **Update Frontend**
   ```bash
   cd frontend
   
   # Copy new IDL
   cp ../target/idl/prediction_market.json src/lib/idl.ts
   
   # Update types if needed
   # Edit src/types/*.ts
   
   # Update hooks/components
   # Edit src/hooks/*.ts and src/components/*.tsx
   ```

4. **Test End-to-End**
   ```bash
   # Deploy to devnet
   anchor deploy --provider.cluster devnet
   
   # Run frontend
   cd frontend && npm run dev
   
   # Test with wallet in browser
   ```

### Contributing Guidelines

To contribute to the project:
1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass (`anchor test`)
6. Build successfully (`anchor build`)
7. Update documentation if needed
8. Commit your changes (`git commit -m 'Add amazing feature'`)
9. Push to the branch (`git push origin feature/amazing-feature`)
10. Open a Pull Request

## 📊 Constants

Located in `programs/prediction-market/src/lib.rs`:

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

## 🔄 Program Upgrade Process

To upgrade the program (requires upgrade authority):

```bash
# 1. Make changes to programs/prediction-market/src/lib.rs
# 2. Update version in Cargo.toml

# 3. Build new program
anchor build

# 4. Test thoroughly
anchor test

# 5. Deploy upgrade to devnet first
solana config set --url devnet
anchor upgrade target/deploy/prediction_market.so \
  --program-id C3LRoEztvLPioY3ruddYGTT9qxzvqBivHzgmpGJuQ9CT \
  --provider.cluster devnet

# 6. Test on devnet with frontend

# 7. Deploy to mainnet (if applicable)
solana config set --url mainnet-beta
anchor upgrade target/deploy/prediction_market.so \
  --program-id <YOUR_MAINNET_PROGRAM_ID> \
  --provider.cluster mainnet-beta
```

**Important Notes:**
- Only the upgrade authority can perform upgrades
- Always test on devnet first
- Verify the build is correct before upgrading
- Consider making programs immutable in production

## 🌐 Deployment

### Current Deployment
The program is currently deployed with the following details:
- **Program ID**: `C3LRoEztvLPioY3ruddYGTT9qxzvqBivHzgmpGJuQ9CT`
- **Network**: Devnet
- **Status**: Active

### Deploy Your Own Instance

#### Devnet
```bash
# Set cluster
solana config set --url devnet

# Build program
anchor build

# Deploy
anchor deploy

# Initialize treasury
npm run init-treasury

# Verify deployment
anchor keys list
solana program show <YOUR_PROGRAM_ID>
```

#### Mainnet
```bash
# Set cluster
solana config set --url mainnet-beta

# Build with verification support
anchor build --verifiable

# Deploy (ensure you have enough SOL)
anchor deploy

# Initialize treasury
npm run init-treasury

# Verify build
anchor verify <YOUR_PROGRAM_ID>
```

### Frontend Deployment

The frontend can be deployed to Vercel, Netlify, or any platform supporting Next.js:

```bash
cd frontend

# Build for production
npm run build

# Deploy to Vercel (example)
vercel deploy

# Or set environment variables and deploy
# NEXT_PUBLIC_SOLANA_NETWORK=devnet
# NEXT_PUBLIC_PROGRAM_ID=C3LRoEztvLPioY3ruddYGTT9qxzvqBivHzgmpGJuQ9CT
```

## 📈 Monitoring & Inspection

### Check Program Status
```bash
# Get program info
solana program show C3LRoEztvLPioY3ruddYGTT9qxzvqBivHzgmpGJuQ9CT

# Get program data account
solana account C3LRoEztvLPioY3ruddYGTT9qxzvqBivHzgmpGJuQ9CT
```

### Inspect Treasury
```bash
# Use built-in script
npm run inspect-treasury

# Or manually derive PDA and check
# Treasury PDA seeds: ["treasury"]
solana account <TREASURY_PDA_ADDRESS>
```

### Monitor Markets
```bash
# Get market info (replace with actual market PDA)
solana account <MARKET_PDA_ADDRESS>

# Monitor all program logs
solana logs | grep C3LRoEztvLPioY3ruddYGTT9qxzvqBivHzgmpGJuQ9CT

# Get recent transactions
solana transaction-history C3LRoEztvLPioY3ruddYGTT9qxzvqBivHzgmpGJuQ9CT
```

### Frontend Monitoring
The frontend provides real-time visibility into:
- All active markets
- Market statistics (volume, bettors, pool size)
- User positions and portfolio
- Market resolution status
- Transaction history

## 🐛 Debugging & Troubleshooting

### Enable Detailed Logging

In tests:
```typescript
// In tests/prediction-market.test.ts
before(() => {
  // Log all transactions
  provider.connection.onLogs("all", (logs) => {
    console.log("Transaction logs:", logs);
  });
});
```

In Rust:
```bash
# Run with debug output
RUST_LOG=debug anchor test

# Or in code, add:
msg!("Debug message: {:?}", variable);
```

### Common Issues

#### 1. Account Size Too Small
**Error**: "Account data too small for instruction"

**Solution**: Increase space allocation in account constraints:
```rust
#[account(
    init,
    payer = user,
    space = 8 + YourAccount::INIT_SPACE, // Adjust INIT_SPACE
    seeds = [...],
    bump
)]
```

#### 2. PDA Collision
**Error**: "Account already exists"

**Solution**: Change PDA seeds to be more unique:
```rust
seeds = [b"market", creator.key().as_ref(), question.as_bytes()],
```

#### 3. Math Overflow
**Error**: "Math overflow occurred"

**Solution**: Use checked math operations:
```rust
let result = amount
    .checked_mul(fee_bps as u64)
    .ok_or(ErrorCode::MathOverflow)?;
```

#### 4. Insufficient Rent
**Error**: "Insufficient funds for rent"

**Solution**: Add more lamports or check rent exemption:
```bash
# Check rent required for account size
solana rent <BYTES>

# Request devnet airdrop
solana airdrop 2
```

#### 5. Program Not Found
**Error**: "Program not deployed"

**Solution**: 
```bash
# Verify program ID in Anchor.toml
anchor keys list

# Redeploy if needed
anchor deploy
```

#### 6. Frontend Connection Issues
**Error**: "Failed to fetch" or network errors

**Solution**:
- Check RPC endpoint in frontend config
- Verify network setting (devnet/mainnet)
- Check wallet is connected
- Try different RPC provider

#### 7. Transaction Simulation Failed
**Error**: Various transaction errors

**Solution**:
```bash
# Check recent blockhash
solana cluster-version

# Verify account balances
solana balance

# Check transaction with explorer
# Use transaction signature from error
```

### Debug Commands

```bash
# Verify program deployment
solana program show <PROGRAM_ID>

# Check account data
solana account <ACCOUNT_ADDRESS> --output json

# View recent logs
solana logs --commitment confirmed

# Simulate transaction (add to test)
await provider.simulate(tx);

# Get transaction details
solana confirm <TRANSACTION_SIGNATURE> -v
```

## 🔐 Production Checklist

Before deploying to mainnet:

### Smart Contract
- [ ] Comprehensive code audit
- [ ] All edge cases tested
- [ ] Overflow/underflow checks verified
- [ ] Security review completed
- [ ] Verify program build
- [ ] Set correct protocol authority
- [ ] Fund protocol wallet with SOL
- [ ] Initialize treasury
- [ ] Test with real SOL (small amounts first)
- [ ] Monitor initial markets closely
- [ ] Prepare upgrade authority management
- [ ] Consider making program immutable when stable

### Frontend
- [ ] Update program ID for mainnet
- [ ] Configure mainnet RPC endpoints
- [ ] Test wallet connections
- [ ] Verify all transactions work
- [ ] Test error handling
- [ ] Security headers configured
- [ ] Rate limiting implemented
- [ ] Analytics set up
- [ ] User documentation prepared
- [ ] Support system ready

### Infrastructure
- [ ] Backup upgrade authority keys securely
- [ ] Set up monitoring and alerts
- [ ] Prepare incident response plan
- [ ] Document recovery procedures
- [ ] Test disaster recovery
- [ ] Set up logging infrastructure

## 📝 IDL Generation

```bash
# Build generates IDL automatically
anchor build

# IDL location
target/idl/prediction_market.json

# Copy to frontend
cp target/idl/prediction_market.json ../frontend/src/idl/
```

## 📝 IDL Generation

The IDL (Interface Definition Language) is automatically generated on build:

```bash
# Build generates IDL automatically
anchor build

# IDL location
target/idl/prediction_market.json

# Copy to frontend (if needed manually)
cp target/idl/prediction_market.json frontend/src/lib/idl.ts
```

The IDL is used by the frontend to interact with the smart contract and provides:
- Type definitions for all accounts
- Instruction signatures
- Error codes
- Event definitions

## 📚 Resources

### Official Documentation
- [Anchor Framework](https://www.anchor-lang.com/) - Smart contract framework
- [Solana Documentation](https://docs.solana.com/) - Blockchain documentation
- [Solana Cookbook](https://solanacookbook.com/) - Recipes and examples
- [Next.js Documentation](https://nextjs.org/docs) - Frontend framework

### Code Examples
- [Anchor Examples](https://github.com/coral-xyz/anchor/tree/master/examples) - Official examples
- [Solana Program Examples](https://github.com/solana-developers/program-examples) - Community examples

### Tools & Libraries
- [Solana Web3.js](https://solana-labs.github.io/solana-web3.js/) - JavaScript SDK
- [Solana Wallet Adapter](https://github.com/solana-labs/wallet-adapter) - Wallet integration
- [Anchor TypeScript](https://coral-xyz.github.io/anchor/ts/) - TypeScript client

### Explorers
- [Solana Explorer](https://explorer.solana.com/) - Official explorer
- [Solscan](https://solscan.io/) - Advanced explorer
- [SolanaFM](https://solana.fm/) - Alternative explorer

## 🤝 Support & Community

- **Issues**: Report bugs via [GitHub Issues](https://github.com/JB1HEY/sentient.send/issues)
- **Discussions**: Join conversations in GitHub Discussions
- **Documentation**: Check this README and inline code comments

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🔧 Useful Commands

### Smart Contract
```bash
# Clean build
anchor clean && anchor build

# Test with logs
RUST_LOG=debug anchor test

# Deploy to specific cluster
anchor deploy --provider.cluster devnet

# Get program size
du -h target/deploy/prediction_market.so

# List program keys
anchor keys list

# Build without deploy
anchor build

# Run tests
npm test
```

### Treasury Management
```bash
# Initialize treasury (one-time setup)
npm run init-treasury

# Inspect treasury stats
npm run inspect-treasury

# Check treasury account
solana account <TREASURY_PDA_ADDRESS>
```

### Frontend
```bash
# Install dependencies
cd frontend && npm install

# Run development server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Lint code
npm run lint
```

### Solana CLI
```bash
# Estimate rent
solana rent BYTES

# Close program (careful!)
solana program close YOUR_PROGRAM_ID

# Check program info
solana program show YOUR_PROGRAM_ID

# Get account info
solana account <ACCOUNT_ADDRESS>

# Monitor logs
solana logs | grep YOUR_PROGRAM_ID
```

---

Built with ⚓ Anchor on Solana