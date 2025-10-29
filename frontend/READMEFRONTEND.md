# Prediction Market Frontend

A modern Next.js application for creating and trading on prediction markets built on Solana.

## 🎯 Overview

This frontend allows users to:
- Browse active prediction markets
- Create new markets with multiple outcomes
- Place bets on market outcomes using SOL
- Track positions and claim winnings
- Market creators earn 50% of trading fees

## 🛠️ Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Blockchain**: Solana (Anchor framework)
- **Wallet**: Solana Wallet Adapter
- **Styling**: Tailwind CSS
- **Language**: TypeScript

## 📦 Prerequisites

- Node.js 18+ and npm
- A Solana wallet (Phantom, Solflare, etc.)
- SOL tokens (devnet or mainnet)

## 🚀 Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

Create a `.env.local` file:

```env
NEXT_PUBLIC_RPC_ENDPOINT=https://api.devnet.solana.com
NEXT_PUBLIC_PROGRAM_ID=your_program_id_here
```

### 3. Set Protocol Authority

Update `src/lib/constants.ts` with your protocol wallet:

```typescript
export const PROTOCOL_AUTHORITY = new PublicKey('YOUR_WALLET_ADDRESS');
```

### 4. Run Development Server

```bash
npm run dev
```

Visit `http://localhost:3000`

## 📁 Project Structure

```
frontend/
├── src/
│   ├── app/                    # Next.js app router pages
│   │   ├── page.tsx           # Home - Browse markets
│   │   ├── create/            # Create new market
│   │   ├── market/[id]/       # Market detail page
│   │   └── portfolio/         # User portfolio
│   │
│   ├── components/            # Reusable components
│   │   ├── Navbar.tsx        # Navigation bar
│   │   └── WalletProvider.tsx # Wallet connection
│   │
│   ├── hooks/                 # Custom React hooks
│   │   └── useProgram.ts     # Anchor program hook
│   │
│   ├── lib/                   # Utilities
│   │   ├── constants.ts      # SOL amounts, fees, limits
│   │   └── anchor.ts         # PDA derivation helpers
│   │
│   └── idl/                   # Anchor IDL
│       └── prediction_market.json
│
├── public/                    # Static assets
├── tailwind.config.ts        # Tailwind configuration
└── package.json              # Dependencies
```

## 🔑 Key Features

### 1. Browse Markets
- View all active prediction markets
- See real-time odds and total pool size
- Filter by status (active, ended, resolved)

### 2. Create Markets
- Set question and description
- Define 2-10 possible outcomes
- Choose end date
- Initial liquidity (minimum 1 SOL)
- 2% creation fee applied

### 3. Place Bets
- Bet on any outcome
- Min: 0.01 SOL, Max: 1 SOL per bet
- 2% trading fee applied
- Real-time odds updates

### 4. Portfolio Management
- **Your Bets Tab**: All markets you've bet on
  - Active positions
  - Claimable winnings
  - Resolved markets
  
- **Markets You Created Tab**: Markets you created
  - Trading statistics
  - Fee earnings (50% of trading fees)
  - One-click fee withdrawal

### 5. Auto-Resolution
Markets automatically resolve when:
- Time expires AND
- Anyone interacts (bet/claim/withdraw)
- Winner = outcome with most SOL

### 6. Claiming Winnings
- Winners claim proportional share of pool
- Losers get nothing
- One-click claim after resolution

### 7. Creator Fee Distribution
- Creators earn 50% of all trading fees
- Protocol earns 50% of all trading fees
- Both paid in single transaction
- No manual protocol withdrawal needed

## 🔌 Core Hooks & Functions

### `useProgram()`
Returns the Anchor program instance:
```typescript
const program = useProgram();
```

### `getPositionPda(market, user)`
Derives user position PDA:
```typescript
const { positionPda } = getPositionPda(marketPubkey, userPubkey);
```

### `getTreasuryPda()`
Derives treasury PDA:
```typescript
const { treasuryPda } = getTreasuryPda();
```

## 💰 Fee Structure

All amounts in SOL:

- **Market Creation**: 2% fee (minimum 1 SOL deposit)
- **Trading**: 2% fee per bet
- **Fee Split**: 50% creator, 50% protocol
- **Bet Limits**: 0.01 SOL min, 1 SOL max

## 🎨 Styling

Uses Tailwind CSS with custom gradient:

```css
/* Primary gradient used throughout */
.bg-gradient-main {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}
```

## 🔐 Security Features

- Wallet-based authentication
- Transaction confirmation required
- All SOL transfers on-chain
- No custody of user funds
- Transparent on-chain odds calculation

## 📱 Responsive Design

Fully responsive with breakpoints:
- Mobile: < 768px
- Tablet: 768px - 1024px
- Desktop: > 1024px

## 🧪 Testing Checklist

### Market Creation
- [ ] Can create market with valid inputs
- [ ] Validation works (min SOL, max sides, etc.)
- [ ] Creator position initialized correctly
- [ ] Market appears on homepage

### Trading
- [ ] Can place bet within limits
- [ ] Can't bet after market ends
- [ ] Position updates correctly
- [ ] Odds update in real-time

### Portfolio
- [ ] Shows all user positions
- [ ] Stats calculate correctly
- [ ] Can claim winnings
- [ ] Creator fees display properly

### Auto-Resolution
- [ ] Market resolves after end time
- [ ] Winner determined correctly
- [ ] Can trigger resolution by interacting

### Fee Distribution
- [ ] Creator gets 50% when claiming
- [ ] Protocol gets 50% automatically
- [ ] Can't claim twice
- [ ] Fees display in portfolio

## 🚨 Common Issues

### "Program not initialized"
Solution: Deploy and initialize treasury in backend first

### "Insufficient SOL"
Solution: Request devnet SOL from faucet or add more

### "Transaction simulation failed"
Solution: Check RPC endpoint, try again, or switch RPC

### "Market not resolved"
Solution: Wait for auto-resolution trigger (interact with market)

### Markets not loading
Solution: Check NEXT_PUBLIC_PROGRAM_ID matches deployed program

## 🔄 Environment Variables

Required:
```env
NEXT_PUBLIC_RPC_ENDPOINT=https://api.devnet.solana.com
NEXT_PUBLIC_PROGRAM_ID=C3LRoEztvLPioY3ruddYGTT9qxzvqBivHzgmpGJuQ9CT
```

Optional (for production):
```env
NEXT_PUBLIC_RPC_ENDPOINT=https://api.mainnet-beta.solana.com
NEXT_PUBLIC_NETWORK=mainnet-beta
```

## 🎯 Smart Contract Integration

The frontend interacts with 4 main instructions:

1. **create_market**: Create new prediction market
2. **place_bet**: Bet on an outcome
3. **claim_winnings**: Claim winnings after resolution
4. **claim_creator_fees**: Creator withdraws fees (auto-pays protocol)

## 📊 Market States

- **Active**: Betting open, before end_timestamp
- **Ended**: Past end time, awaiting resolution
- **Resolved**: Winner determined, can claim

## 🌐 Deployment

### Vercel (Recommended)
```bash
vercel deploy
```

Add environment variables in Vercel dashboard.

### Build for Production
```bash
npm run build
npm start
```

## 🤝 Contributing

To add new features:
1. Add instruction to smart contract
2. Update IDL in `src/idl/`
3. Create UI component
4. Test on devnet
5. Deploy to mainnet

## 📝 IDL Updates

After changing smart contract:
```bash
# In backend
anchor build

# Copy IDL to frontend
cp target/idl/prediction_market.json ../frontend/src/idl/
```

## 🔧 Development Tips

- Use devnet for testing (free SOL)
- Check browser console for transaction logs
- Monitor Solana Explorer for on-chain data
- Test with multiple wallets
- Clear browser cache if seeing stale data

## 📈 Future Enhancements

Potential features:
- Market categories/tags
- Search and filtering
- Historical data charts
- Social features (comments, sharing)
- Mobile app
- Push notifications
- Multi-wallet support
- Limit orders

## 🐛 Debug Mode

Enable verbose logging:
```typescript
// In useProgram hook
console.log('Program:', program);
console.log('Accounts:', accounts);
```

## 📞 Support

Issues? Check:
1. RPC endpoint status
2. Wallet connection
3. Program deployment
4. Browser console errors
5. Solana Explorer for failed transactions

---

Built with ❤️ on Solana