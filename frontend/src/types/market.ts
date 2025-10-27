import { PublicKey } from '@solana/web3.js';
import BN from 'bn.js';

export interface Market {
  publicKey: PublicKey;
  creator: PublicKey;
  question: string;
  description: string;
  endTimestamp: BN;
  resolved: boolean;
  outcome: boolean;
  yesPool: BN;
  noPool: BN;
  k: BN;
  totalYesShares: BN;
  totalNoShares: BN;
  treasuryFee: BN;
  creationFee: BN;
  totalVolume: BN;
  numBettors: number;
  questionHash: number[];
  bump: number;
}

export interface UserPosition {
  publicKey: PublicKey;
  user: PublicKey;
  market: PublicKey;
  yesShares: BN;
  noShares: BN;
  amountInvested: BN;
  claimed: boolean;
  bump: number;
}

export interface MarketWithPrice extends Market {
  yesPrice: number; // 0-1
  noPrice: number; // 0-1
  yesPricePercent: number; // 0-100
  noPricePercent: number; // 0-100
  endDate: Date;
  isActive: boolean;
  totalLiquidity: number; // in SOL
  volume: number; // in SOL
}

export type BetSide = 'YES' | 'NO';