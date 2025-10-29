import { PublicKey, clusterApiUrl } from '@solana/web3.js';

// Program ID - This matches your deployed program
export const PROGRAM_ID = new PublicKey('C3LRoEztvLPioY3ruddYGTT9qxzvqBivHzgmpGJuQ9CT');

// Network configuration
export const NETWORK = (process.env.NEXT_PUBLIC_SOLANA_NETWORK || 'devnet') as 'devnet' | 'mainnet-beta' | 'testnet';
export const RPC_ENDPOINT = process.env.NEXT_PUBLIC_RPC_ENDPOINT || clusterApiUrl(NETWORK);

// SOL constants
export const LAMPORTS_PER_SOL = 1_000_000_000;

// Minimum bet amount: 0.01 SOL
export const MIN_BET_SOL = 0.01;
export const MIN_BET_AMOUNT = MIN_BET_SOL * LAMPORTS_PER_SOL; // 10,000,000 lamports

// Maximum bet amount: 1 SOL
export const MAX_BET_SOL = 1;
export const MAX_BET_AMOUNT = MAX_BET_SOL * LAMPORTS_PER_SOL; // 1,000,000,000 lamports

// Minimum market creation: 1 SOL
export const MIN_MARKET_CREATION_SOL = 1;
export const MIN_LIQUIDITY = MIN_MARKET_CREATION_SOL * LAMPORTS_PER_SOL; // 1,000,000,000 lamports

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
export const POSITION_SEED = Buffer.from('position');