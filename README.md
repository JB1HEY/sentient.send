# Multi-Side Winner-Takes-All Sentiment Market

A completely redesigned Sentiment market smart contract on Solana where **multiple sides compete** and the **winning side takes the entire pool**.

## 🎯 Key Features

### Winner-Takes-All Model
- Multiple sides (2-10 options per market)
- The side with the most USDC at the end wins
- Winning side splits the entire pool proportionally
- Losers get nothing

### USDC-Based
- All bets in USDC (1-200 USDC per bet)
- Market creation requires minimum 150 USDC
- No SOL needed (except for transaction fees)

### Fair Fee Structure
- **Market Creation**: 2% fee
   - 100% to fee pool
- **Each Bet**: 2% fee
  - 100% to fee pool
- At the end of the market, Pool is distributed 50% to market creater and 50% to 
  protocol

### Fixed Sides
- Sides are set at market creation
- Cannot add/remove sides after creation
- Example: "Best Artist" → Kanye West, Taylor Swift, Travis Scott

## 📊 Architecture

```
Market Creation
├─ Creator sets: Question, Description, End Time, Side Names
├─ Creator deposits: Minimum 150 USDC
├─ Fee taken: 2% (split 50/50)
└─ Sides initialized with 0 balance

Betting Phase
├─ Users bet 1-200 USDC on any side
├─ Fee taken: 2% per bet (split 50/50)
├─ Bet amount (minus fee) added to that side's total
└─ Continue until end_timestamp

Market Resolution
├─ Only creator can resolve after end_timestamp
├─ Winning side = side with most USDC
├─ Total pool = sum of all bets (minus fees)
└─ Market marked as resolved

Claiming Phase
├─ Only winners can claim
├─ Payout = (your_bet / winning_side_total) × total_pool
├─ Proportional to your share of winning side
└─ One-time claim per user
```

## 🏗️ Account Structure

### Market
```rust
pub struct Market {
    pub creator: Pubkey,                    // Who created it
    pub question: String,                   // "Who is the best artist?"
    pub description: String,                // Additional context
    pub end_timestamp: i64,                 // When betting ends
    pub resolved: bool,                     // Has it been resolved?
    pub winning_side_index: u8,             // Which side won (0-9)
    pub total_pool: u64,                    // Total USDC to distribute
    pub num_sides: u8,                      // Number of sides (2-10)
    pub sides: [Side; 10],                  // Array of sides
    pub creator_fees_collected: u64,        // Fees for creator
    pub protocol_fees_collected: u64,       // Fees for protocol
    pub total_volume: u64,                  // All-time volume
    pub num_bettors: u32,                   // Unique bettors
    pub creation_amount: u64,               // Initial deposit
    pub bump: u8,                           // PDA bump
}
```

**PDA**: `["market", creator, question]`

### Side
```rust
pub struct Side {
    pub name: [u8; 50],         // Side name (e.g., "Kanye West")
    pub name_len: u8,           // Actual length
    pub total_amount: u64,      // Total USDC on this side
    pub num_bettors: u32,       // Number of bettors
}
```

### UserPosition
```rust
pub struct UserPosition {
    pub user: Pubkey,                   // User address
    pub market: Pubkey,                 // Market reference
    pub bets: [SideBet; 10],            // Bets on each side
    pub total_invested: u64,            // Total USDC invested
    pub claimed: bool,                  // Claimed winnings?
    pub bump: u8,                       // PDA bump
}
```

**PDA**: `["position", market, user]`

### Treasury
```rust
pub struct Treasury {
    pub authority: Pubkey,              // Protocol authority
    pub total_protocol_fees: u64,       // All protocol fees
    pub total_creator_fees: u64,        // All creator fees
    pub total_markets: u32,             // Markets created
    pub total_volume: u64,              // All-time volume
    pub bump: u8,                       // PDA bump
}
```

**PDA**: `["treasury"]`

## 🔧 Instructions

### 1. create_market
Create a new multi-side market.

```rust
pub fn create_market(
    ctx: Context<CreateMarket>,
    question: String,              // "Who is the best artist?"
    description: String,           // Additional context
    end_timestamp: i64,            // Unix timestamp when market ends
    side_names: Vec<String>,       // ["Kanye West", "Taylor Swift", "Travis Scott"]
    initial_amount: u64,           // Minimum 1 USDC (in lamports: 1_000_000)
) -> Result<()>
```

**Requirements:**
- Question ≤ 200 characters
- Description ≤ 500 characters
- 2-10 unique side names
- Each side name ≤ 50 characters
- Initial amount ≥ 1 USDC
- End timestamp in future

**Fees:**
- 2% of initial_amount
- 1% to creator 
- 1% to protocol

**Accounts:**
- `market` - Market PDA (initialized)
- `market_vault` - Token account to hold USDC (initialized)
- `treasury` - Treasury PDA (initialized if needed)
- `creator_token_account` - Creator's USDC account
- `usdc_mint` - USDC mint
- `creator` - Signer
- `token_program` - SPL Token program
- `system_program` - System program
- `rent` - Rent sysvar

### 2. place_bet
Bet on a specific side.

```rust
pub fn place_bet(
    ctx: Context<PlaceBet>,
    side_index: u8,                // Which side (0-9)
    amount: u64,                   // 1-200 USDC (in lamports)
) -> Result<()>
```

**Requirements:**
- Market not ended
- Amount between 1-200 USDC
- Valid side_index

**Fees:**
- 2% of amount
- 1% to creator (accumulated)
- 1% to protocol (accumulated)

**Accounts:**
- `market` - Market account
- `market_vault` - Market's USDC vault
- `position` - User position PDA (initialized if needed)
- `user_token_account` - User's USDC account
- `user` - Signer
- `token_program` - SPL Token program
- `system_program` - System program

### 3. resolve_market
Determine the winning side (creator only).

```rust
pub fn resolve_market(
    ctx: Context<ResolveMarket>,
) -> Result<()>
```

**Requirements:**
- Market ended (past end_timestamp)
- Not already resolved
- Called by market creator

**Logic:**
- Finds side with highest total_amount
- Sets winning_side_index
- Marks market as resolved

**Accounts:**
- `market` - Market account
- `resolver` - Market creator (signer)

### 4. claim_winnings
Claim your share if you won.

```rust
pub fn claim_winnings(
    ctx: Context<ClaimWinnings>,
) -> Result<()>
```

**Requirements:**
- Market resolved
- Haven't claimed yet
- Bet on winning side

**Payout Formula:**
```
payout = (your_bet_on_winning_side / total_winning_side) × total_pool
```

**Accounts:**
- `market` - Market account
- `market_vault` - Market's USDC vault
- `position` - User position
- `user_token_account` - User's USDC account
- `user` - Signer
- `token_program` - SPL Token program

### 5. withdraw_creator_fees
Withdraw accumulated creator fees.

```rust
pub fn withdraw_creator_fees(
    ctx: Context<WithdrawCreatorFees>,
) -> Result<()>
```

**Requirements:**
- Called by market creator
- Fees available

**Accounts:**
- `market` - Market account
- `market_vault` - Market's USDC vault
- `creator_token_account` - Creator's USDC account
- `creator` - Signer
- `token_program` - SPL Token program

### 6. withdraw_protocol_fees
Withdraw protocol fees (admin only).

```rust
pub fn withdraw_protocol_fees(
    ctx: Context<WithdrawProtocolFees>,
) -> Result<()>
```

**Requirements:**
- Called by protocol authority
- Fees available

**Accounts:**
- `market` - Market account
- `market_vault` - Market's USDC vault
- `treasury` - Treasury account
- `protocol_token_account` - Protocol's USDC account
- `protocol_authority` - Signer
- `token_program` - SPL Token program

## 💰 Example Scenario

**Market:** "Who is the best artist?"
- Sides: Kanye West, Taylor Swift, Travis Scott
- End: December 31, 2024

**Betting Phase:**
```
Alice bets 100 USDC on Kanye
  ├─ Fee: 2 USDC
  └─ Kanye total: 98 USDC

Bob bets 50 USDC on Taylor
  ├─ Fee: 1 USDC
  └─ Taylor total: 49 USDC

Charlie bets 150 USDC on Kanye
  ├─ Fee: 2.5 USDC
  └─ Kanye total: 246.25 USDC (98.5 + 147.75)

Dave bets 80 USDC on Travis
  ├─ Fee: 1.2 USDC
  └─ Travis total: 78.8 USDC
```

**Final Totals:**
- Kanye: 246.25 USDC (WINNER - most money)
- Taylor: 49.25 USDC
- Travis: 78.8 USDC
- Total Pool: 374.3 USDC

**Resolution:**
- Creator resolves market
- Kanye is declared winner

**Payouts:**
- Alice (bet 98.5 on Kanye):
  ```
  (98.5 / 246.25) × 374.3 = 149.7 USDC
  Profit: 49.7 USDC (49.7% return)
  ```
- Charlie (bet 147.75 on Kanye):
  ```
  (147.75 / 246.25) × 374.3 = 224.6 USDC
  Profit: 74.6 USDC (49.7% return)
  ```
- Bob (bet on Taylor): 0 USDC (lost)
- Dave (bet on Travis): 0 USDC (lost)

**Fees Collected:**
- Creator: 2.625 USDC (can withdraw anytime)
- Protocol: 2.625 USDC (can withdraw anytime)

## 🔒 Security Features

- ✅ All funds in program-controlled vault
- ✅ Only creator can resolve
- ✅ Time-locked claiming (after resolution)
- ✅ Anti-double-claim protection
- ✅ PDA-based access control
- ✅ Checked arithmetic (overflow protection)
- ✅ Token account validation

## 📝 Installation

1. **Update Cargo.toml:**
```toml
[dependencies]
anchor-lang = { version = "0.32.1", features = ["init-if-needed"] }
anchor-spl = "0.32.1"
```

2. **Copy files:**
```
programs/prediction-market/src/
├── lib.rs
├── state.rs
├── error.rs
└── instructions/
    ├── mod.rs
    ├── create_market.rs
    ├── place_bet.rs
    ├── resolve_market.rs
    ├── claim_winnings.rs
    └── withdraw_fees.rs
```

3. **Build:**
```bash
anchor build
```

4. **Deploy:**
```bash
anchor deploy
```

## 🧪 Testing

Create a test file with:
```typescript
// Create market with 3 sides
await program.methods
  .createMarket(
    "Who is the best artist?",
    "Vote with your wallet",
    new BN(Date.now() / 1000 + 86400), // 24 hours
    ["Kanye West", "Taylor Swift", "Travis Scott"],
    new BN(1_000_000) // 1 USDC
  )
  .accounts({...})
  .rpc();

// Place bets
await program.methods
  .placeBet(0, new BN(100_000_000)) // 100 USDC on side 0 (Kanye)
  .accounts({...})
  .rpc();

// Resolve (after market ends)
await program.methods
  .resolveMarket()
  .accounts({...})
  .rpc();

// Claim winnings
await program.methods
  .claimWinnings()
  .accounts({...})
  .rpc();
```

## ⚠️ Important Notes

1. **USDC Mint:** You need to use the official USDC mint address
   - Devnet: `4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU`
   - Mainnet: `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v`

2. **Fee Withdrawals:** Need to wait for market to end

3. **Losers:** Get nothing. Winner-takes-all model.

4. **Multiple Bets:** Users can bet on multiple sides (hedging allowed)

5. **No AMM:** Prices don't adjust. Simple tracking of total per side.

## 🚀 Deployment Checklist

- [ ] Update `declare_id!` in lib.rs with your program ID
- [ ] Test on devnet with test USDC
- [ ] Verify all fee calculations
- [ ] Test winner determination logic
- [ ] Test claim payouts
- [ ] Audit before mainnet

## 📚 Key Differences from Old Contract

| Feature | Old (Sentiment) | New (Winner-Takes-All) |
|---------|----------------|------------------------|
| Sides | 2 (YES/NO) | 2-10 (custom names) |
| Payout | Everyone proportional | Winners only |
| Currency | SOL | USDC |
| Pricing | AMM (dynamic) | None (just tracking) |
| Resolution | Automatic | Creator resolves |
| Bet Limits | 0.01+ SOL | 1-200 USDC |
| Fees | 2% on bets | 1.5% on bets, 2% on creation |

---

**This is a complete rewrite. Use this contract for the multi-side winner-takes-all model you described.**