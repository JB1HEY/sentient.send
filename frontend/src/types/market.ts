import { PublicKey } from '@solana/web3.js';
import BN from 'bn.js';

export interface Side {
  name: number[]; // [u8; 50]
  nameLen: number;
  totalAmount: BN;
  numBettors: number;
}

export interface SideBet {
  amount: BN;
  hasBet: boolean;
}

export interface Market {
  publicKey: PublicKey;
  creator: PublicKey;
  question: string;
  description: string;
  endTimestamp: BN;
  resolved: boolean;
  winningSideIndex: number;
  totalPool: BN;
  numSides: number;
  sides: Side[];
  feePool: BN;
  creatorFeesDistributed: BN;
  protocolFeesDistributed: BN;
  totalVolume: BN;
  numBettors: number;
  creationAmount: BN;
  bump: number;
  winningSides: boolean[]; // NEW: array marking which sides won
  numWinners: number; // NEW: number of sides that tied
}

export interface UserPosition {
  publicKey: PublicKey;
  user: PublicKey;
  market: PublicKey;
  bets: SideBet[];
  totalInvested: BN;
  claimed: boolean;
  bump: number;
}

export interface MarketWithPrices extends Market {
  endDate: Date;
  isActive: boolean;
  totalLiquidity: number; // in SOL
  volume: number; // in SOL
  sidePrices: number[]; // percentage for each side
  sideNames: string[]; // decoded side names
  isTie: boolean; // NEW: whether market ended in a tie
  winningNames: string[]; // NEW: names of all winning sides
}

export interface Treasury {
  authority: PublicKey;
  totalProtocolFees: BN;
  totalCreatorFees: BN;
  totalMarkets: number;
  totalVolume: BN;
  bump: number;
}