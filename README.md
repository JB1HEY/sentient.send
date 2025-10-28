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
- **At Market End**: Fee pool distributed 50% to creator, 50% to protocol

### Auto-Resolution
- Markets automatically resolve when someone interacts after end time
- No manual resolution needed by creator
- Winner = side with most USDC
- Fees distributed at resolution time

### Fixed Sides
- Sides are set at market creation
- Cannot add/remove sides after creation
- Example: "Best Artist" → Kanye West, Taylor Swift, Travis Scott

## 📊 Architecture

```
Market Creation
├─ Creator sets: Question, Description, End Time, Side Names
├─ Creator deposits: Minimum 150 USDC
├─ Fee taken: 2% (to fee pool)
└─ Sides initialized with 0 balance

Betting Phase
├─ Users bet 1-200 USDC on any side
├─ Fee taken: 2% per bet (to fee pool)
├─ Bet amount (minus fee) added to that side's total
└─ Continue until end_timestamp

Auto-Resolution (triggered on first interaction after end_timestamp)
├─ Automatically determines winning side (most USDC)
├─ Splits fee pool: 50% creator, 50% protocol
├─ Total pool = sum of all bets (minus fees)
└─ Market marked as resolved

Claiming Phase
├─ Only winners can claim
├─ Payout = (your_bet / winning_side_total) × total_pool
├─ Proportional to your share of winning side
└─ One-time claim per user

Fee Withdrawal
├─ Can only withdraw AFTER market is resolved
├─ Creator withdraws their 50% share
├─ Protocol withdraws their 50% share
└─ One-time withdrawal per party
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
    pub fee_pool: u64,                      // Accumulated fees (before distribution)
    pub creator_fees_distributed: u64,      // Creator's share (after resolution)
    pub protocol_fees_distributed: u64,     // Protocol's share (after resolution)
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
    pub total_protocol_fees: u64,       // All protocol fees withdrawn
    pub total_creator_fees: u64,        // All creator fees withdrawn
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
    initial_amount: u64,           // Minimum 150 USDC (in lamports: 150_000_000)
) -> Result<()>
```

**Requirements:**
- Question ≤ 200 characters
- Description ≤ 500 characters
- 2-10 unique side names
- Each side name ≤ 50 characters
- Initial amount ≥ 150 USDC
- End timestamp in future

**Fees:**
- 2% of initial_amount goes to fee pool

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
- 2% of amount goes to fee pool

**Auto-Resolution:**
- If market has ended, automatically resolves before rejecting bet

**Accounts:**
- `market` - Market account
- `market_vault` - Market's USDC vault
- `position` - User position PDA (initialized if needed)
- `user_token_account` - User's USDC account
- `user` - Signer
- `token_program` - SPL Token program
- `system_program` - System program

### 3. claim_winnings
Claim your share if you won.

```rust
pub fn claim_winnings(
    ctx: Context<ClaimWinnings>,
) -> Result<()>
```

**Requirements:**
- Market resolved (or auto-resolves if past end time)
- Haven't claimed yet
- Bet on winning side

**Auto-Resolution:**
- Automatically resolves market if past end_timestamp

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

### 4. withdraw_creator_fees
Withdraw creator's share of fees (only after resolution).

```rust
pub fn withdraw_creator_fees(
    ctx: Context<WithdrawCreatorFees>,
) -> Result<()>
```

**Requirements:**
- Market must be resolved
- Called by market creator
- Fees available (50% of fee pool)

**Auto-Resolution:**
- Automatically resolves market if past end_timestamp

**Accounts:**
- `market` - Market account
- `market_vault` - Market's USDC vault
- `treasury` - Treasury account
- `creator_token_account` - Creator's USDC account
- `creator` - Signer
- `token_program` - SPL Token program

### 5. withdraw_protocol_fees
Withdraw protocol's share of fees (admin only, only after resolution).

```rust
pub fn withdraw_protocol_fees(
    ctx: Context<WithdrawProtocolFees>,
) -> Result<()>
```

**Requirements:**
- Market must be resolved
- Called by protocol authority
- Fees available (50% of fee pool)

**Auto-Resolution:**
- Automatically resolves market if past end_timestamp

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
- Initial: 150 USDC (2% fee = 3 USDC to fee pool, 147 USDC to pool)

**Betting Phase:**
```
Alice bets 100 USDC on Kanye
  ├─ Fee: 2 USDC (to fee pool)
  └─ Kanye total: 98 USDC

Bob bets 50 USDC on Taylor
  ├─ Fee: 1 USDC (to fee pool)
  └─ Taylor total: 49 USDC

Charlie bets 150 USDC on Kanye
  ├─ Fee: 3 USDC (to fee pool)
  └─ Kanye total: 245 USDC (98 + 147)

Dave bets 80 USDC on Travis
  ├─ Fee: 1.6 USDC (to fee pool)
  └─ Travis total: 78.4 USDC
```

**Final Totals:**
- Kanye: 245 USDC (WINNER - most money)
- Taylor: 49 USDC
- Travis: 78.4 USDC
- Total Pool: 372.4 USDC
- Fee Pool: 10.6 USDC

**Auto-Resolution (first person to interact after Dec 31):**
- System determines Kanye is winner (most USDC)
- Fee pool split: 5.3 USDC to creator, 5.3 USDC to protocol
- Market marked as resolved

**Payouts:**
- Alice (bet 98 on Kanye):
  ```
  (98 / 245) × 372.4 = 148.9 USDC
  Profit: 48.9 USDC (49.9% return)
  ```
- Charlie (bet 147 on Kanye):
  ```
  (147 / 245) × 372.4 = 223.5 USDC
  Profit: 73.5 USDC (49.9% return)
  ```
- Bob (bet on Taylor): 0 USDC (lost)
- Dave (bet on Travis): 0 USDC (lost)

**Fee Withdrawals (after resolution):**
- Creator withdraws: 5.3 USDC
- Protocol withdraws: 5.3 USDC

## 🔒 Security Features

- ✅ All funds in program-controlled vault
- ✅ Auto-resolution prevents manipulation
- ✅ Time-locked claiming (after resolution)
- ✅ Fee withdrawal only after resolution
- ✅ Anti-double-claim protection
- ✅ Anti-double-withdrawal protection
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
    new BN(150_000_000) // 150 USDC
  )
  .accounts({...})
  .rpc();

// Place bets
await program.methods
  .placeBet(0, new BN(100_000_000)) // 100 USDC on side 0 (Kanye)
  .accounts({...})
  .rpc();

// Wait for market to end, then claim (auto-resolves)
await program.methods
  .claimWinnings()
  .accounts({...})
  .rpc();

// Withdraw fees (only after resolution)
await program.methods
  .withdrawCreatorFees()
  .accounts({...})
  .rpc();
```

## ⚠️ Important Notes

1. **USDC Mint:** You need to use the official USDC mint address
   - Devnet: `4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU`
   - Mainnet: `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v`

2. **Auto-Resolution:** Market automatically resolves on first interaction after end_timestamp (could be claim, bet attempt, or fee withdrawal)

3. **Fee Timing:** Fees can ONLY be withdrawn AFTER market is resolved

4. **Losers:** Get nothing. Winner-takes-all model.

5. **Multiple Bets:** Users can bet on multiple sides (hedging allowed)

6. **No Manual Resolution:** Creator doesn't need to do anything - market resolves automatically

## 🚀 Deployment Checklist

- [ ] Update `declare_id!` in lib.rs with your program ID
- [ ] Test on devnet with test USDC
- [ ] Verify all fee calculations
- [ ] Test auto-resolution logic
- [ ] Test claim payouts
- [ ] Test fee withdrawal restrictions
- [ ] Audit before mainnet

## 📚 Key Differences from Traditional Markets

| Feature | Traditional | This Contract |
|---------|-------------|---------------|
| Sides | 2 (YES/NO) | 2-10 (custom names) |
| Payout | Everyone proportional | Winners only |
| Currency | SOL | USDC |
| Resolution | Manual by creator | Automatic by contract |
| Fee Distribution | During trading | After resolution |
| Bet Limits | Varies | 1-200 USDC |
| Creation Fee | Varies | 2% (to fee pool) |
| Bet Fee | Varies | 2% (to fee pool) |
| Fee Split | Varies | 50/50 creator/protocol |

## 🎯 Auto-Resolution Behavior

The market automatically resolves when anyone tries to interact with it after the `end_timestamp`. This includes:

1. **During place_bet**: If someone tries to bet after the market ended, it auto-resolves then rejects the bet
2. **During claim_winnings**: First claimer after end time triggers resolution
3. **During withdraw_creator_fees**: Creator's withdrawal attempt triggers resolution
4. **During withdraw_protocol_fees**: Protocol's withdrawal attempt triggers resolution

The auto-resolution:
- Determines the winning side (side with most USDC)
- Splits the fee pool 50/50 between creator and protocol
- Marks the market as resolved
- Prevents any further bets

This ensures markets always resolve fairly based on which side attracted the most capital, with no possibility of creator manipulation.

---

**This is a winner-takes-all market with automatic resolution. The side with the most USDC wins everything.**