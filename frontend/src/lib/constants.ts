import { PublicKey, clusterApiUrl } from '@solana/web3.js';

// Program ID
export const PROGRAM_ID = new PublicKey('2Z7sJer7qW1DJcoZQHJ5i96Gw4LxQqRSpPfd33yVhRVZ');

// Network configuration
export const NETWORK = (process.env.NEXT_PUBLIC_SOLANA_NETWORK || 'devnet') as 'devnet' | 'mainnet-beta' | 'testnet';
export const RPC_ENDPOINT = process.env.NEXT_PUBLIC_RPC_ENDPOINT || clusterApiUrl(NETWORK);

// USDC Mint addresses
export const USDC_MINT_DEVNET = new PublicKey('4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU');
export const USDC_MINT_MAINNET = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');

export const USDC_MINT = NETWORK === 'mainnet-beta' ? USDC_MINT_MAINNET : USDC_MINT_DEVNET;

// USDC has 6 decimals (1 USDC = 1,000,000 base units)
export const USDC_DECIMALS = 6;
export const USDC_MULTIPLIER = Math.pow(10, USDC_DECIMALS);

// Minimum bet amount: 1 USDC
export const MIN_BET_USDC = 1;
export const MIN_BET_AMOUNT = MIN_BET_USDC * USDC_MULTIPLIER; // 1,000,000

// Maximum bet amount: 200 USDC
export const MAX_BET_USDC = 200;
export const MAX_BET_AMOUNT = MAX_BET_USDC * USDC_MULTIPLIER; // 200,000,000

// Minimum market creation: 150 USDC
export const MIN_MARKET_CREATION_USDC = 150;
export const MIN_LIQUIDITY = MIN_MARKET_CREATION_USDC * USDC_MULTIPLIER; // 150,000,000

// Fee structure
export const CREATION_FEE_BPS = 200; // 2%
export const BET_FEE_BPS = 200; // 2%
export const CREATION_FEE_PERCENT = CREATION_FEE_BPS / 100; // 2%

// Market constraints
export const MIN_SIDES = 2;
export const MAX_SIDES = 10;
export const MAX_SIDE_NAME_LENGTH = 50;

// PDA seeds
export const TREASURY_SEED = Buffer.from('treasury');
export const MARKET_SEED = Buffer.from('market');
export const VAULT_SEED = Buffer.from('vault');
export const POSITION_SEED = Buffer.from('position');

// Legacy SOL constant (for transaction fees only)
export const LAMPORTS_PER_SOL = 1_000_000_000;