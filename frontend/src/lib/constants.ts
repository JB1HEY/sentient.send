import { PublicKey, clusterApiUrl } from '@solana/web3.js';

// Use the program ID from your IDL
export const PROGRAM_ID = new PublicKey('2Z7sJer7qW1DJcoZQHJ5i96Gw4LxQqRSpPfd33yVhRVZ');

export const NETWORK = (process.env.NEXT_PUBLIC_SOLANA_NETWORK || 'devnet') as 'devnet' | 'mainnet-beta' | 'testnet';

export const RPC_ENDPOINT = process.env.NEXT_PUBLIC_RPC_ENDPOINT || clusterApiUrl(NETWORK);

export const TREASURY_SEED = Buffer.from('treasury');

export const LAMPORTS_PER_SOL = 1_000_000_000;

export const MIN_BET_AMOUNT = 0.01; // SOL
export const MIN_LIQUIDITY = 1; // SOL
export const CREATION_FEE = 0.1; // SOL
export const PLATFORM_FEE_BPS = 200; // 2% = 200 basis points