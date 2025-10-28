# Frontend Updates for Sentiment-Based Prediction Market

## What Changed

Your smart contract was updated from a traditional binary outcome model to a **sentiment-based proportional payout** model. The frontend needs to be updated to match.

## Key Changes

1. **Removed `resolve_market` instruction** - Markets now automatically distribute payouts based on final pool ratios (no manual resolution needed)
2. **Everyone gets paid** - Proportional payouts mean no one loses 100%
3. **New market detail page** - Was missing from your frontend

## Files to Update

### 1. `frontend/src/lib/idl.ts` 
**Replace your existing IDL with:** `idl.ts`

**What changed:** Removed the `resolve_market` instruction that no longer exists in the smart contract.

### 2. `frontend/src/app/market/[id]/page.tsx` (NEW!)
**Add this new file:** `market-[id]-page.tsx`

This is the market detail page that was missing. It includes:
- Market information display
- Real-time YES/NO prices
- Bet placement interface
- Position tracking
- Claim winnings functionality
- Sentiment-based payout explanation

### 3. `frontend/.env.example` (OPTIONAL)
Add environment variable template (create this file with your RPC endpoint and network config).

## How Sentiment-Based Payouts Work

**Traditional model:**
- Market resolves YES or NO
- Winners get everything
- Losers get nothing

**Sentiment-based model:**
- Market ends (no resolution needed)
- Everyone gets paid based on their share of their pool
- Side with higher sentiment (bigger pool) gets more per share
- Nobody loses everything

**Example:**
```
Final State:
- YES pool: 3,000 SOL (60% sentiment)
- NO pool: 2,000 SOL (40% sentiment)
- Total YES shares: 2,500
- Total NO shares: 1,800

Your Position (YES bettor):
- You own: 500 YES shares (20% of total YES shares)
- Your payout: (500 / 2,500) × 3,000 = 600 SOL

Their Position (NO bettor):
- They own: 450 NO shares (25% of total NO shares)  
- Their payout: (450 / 1,800) × 2,000 = 500 SOL

Both got paid! Just different amounts based on final sentiment.
```

## Installation

1. **Copy the files:**
```bash
# Copy updated IDL
cp idl.ts frontend/src/lib/idl.ts

# Create the market detail directory
mkdir -p frontend/src/app/market/[id]

# Copy the market detail page
cp market-[id]-page.tsx frontend/src/app/market/[id]/page.tsx
```

2. **Update your program ID** in `frontend/src/lib/constants.ts`:
```typescript
export const PROGRAM_ID = new PublicKey('YOUR_PROGRAM_ID_HERE');
// Devnet: 8qXgRQksNnwYLprU4wmfTRJEN2tva4AtS64PyxKn2NNs
// Localnet: 2Z7sJer7qW1DJcoZQHJ5i96Gw4LxQqRSpPfd33yVhRVZ
```

3. **Install dependencies** (if needed):
```bash
cd frontend
npm install
```

4. **Run the dev server:**
```bash
npm run dev
```

5. **Test it out:**
- Open http://localhost:3000
- Connect your wallet
- Create a market
- Click on a market to see the new detail page
- Place some bets
- Track your position
- After market ends, claim your winnings

## Testing on Devnet

```bash
# Make sure you're on devnet
solana config set --url devnet

# Get some devnet SOL
solana airdrop 2

# Your frontend should now be set to devnet in .env.local:
NEXT_PUBLIC_SOLANA_NETWORK=devnet
NEXT_PUBLIC_RPC_ENDPOINT=https://api.devnet.solana.com
```

## What's Different in the UI

### No More Resolution Button
The market creator no longer needs to resolve the market. When the `end_timestamp` is reached, trading stops and everyone can claim their proportional payout.

### Claim Button for Everyone
After a market ends, ALL participants (YES and NO bettors) can claim their proportional share. There's no "winner" and "loser" - everyone gets something based on the final pool ratios.

### Sentiment Display
The UI now shows the final sentiment (% of total pool) rather than a binary outcome.

## Troubleshooting

**"Module not found" errors:**
```bash
rm -rf node_modules .next
npm install
npm run dev
```

**"Transaction failed" when placing bet:**
- Check you have enough SOL
- Make sure market hasn't ended yet
- Minimum bet is 0.01 SOL

**Market detail page not showing:**
- Make sure you copied the file to the correct location: `frontend/src/app/market/[id]/page.tsx`
- The `[id]` folder name must include the square brackets

**Program not found:**
Make sure your smart contract is deployed and the program ID is correct in `constants.ts`.

## Complete User Flow

1. **Home page** - Browse active markets
2. **Create page** - Create a new market (0.1 SOL fee + initial liquidity)
3. **Market detail page** - View market, place bets (YES or NO)
4. **Position tracking** - See your shares and estimated payout
5. **Claim winnings** - After market ends, claim your proportional payout

## Architecture

```
Frontend (Next.js 14)
├── Home page (/) - Browse markets
├── Create page (/create) - Create new market
├── Market detail (/market/[id]) - Trade & claim ← NEW!
└── Portfolio (/portfolio) - Your positions

↓ RPC Connection ↓

Smart Contract (Anchor 0.32.1)
├── create_market - Create new market
├── place_bet - Bet YES or NO
├── claim_winnings - Claim proportional payout ← Changed!
└── add_liquidity - Add liquidity to market
```

## That's It!

Your frontend is now updated to work with the sentiment-based smart contract. The key addition is the market detail page where all the trading happens.