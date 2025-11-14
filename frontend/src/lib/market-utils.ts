import { PublicKey } from '@solana/web3.js';
import { LAMPORTS_PER_SOL } from './constants';
import { MarketWithPrices } from '@/types/market';

/**
 * Process raw market account data into MarketWithPrices format
 * Handles tie scenarios where multiple sides can win
 */
export function processMarketData(
  publicKey: PublicKey,
  marketAccount: any
): MarketWithPrices {
  const market = marketAccount as any;

  // Calculate prices (% of total pool for each side)
  const totalPoolNum = market.totalPool.toNumber();
  const sidePrices = [];
  const sideNames = [];

  for (let i = 0; i < market.numSides; i++) {
    const side = market.sides[i];

    // Decode side name
    const nameBytes = side.name.slice(0, side.nameLen);
    const name = new TextDecoder('utf-8', { fatal: false }).decode(
      new Uint8Array(nameBytes)
    );
    sideNames.push(name);

    // Calculate percentage
    const sidePercent =
      totalPoolNum > 0
        ? (side.totalAmount.toNumber() / totalPoolNum) * 100
        : 0;
    sidePrices.push(sidePercent);
  }

  const endDate = new Date(market.endTimestamp.toNumber() * 1000);
  const isActive = !market.resolved && Date.now() < endDate.getTime();

  // Check for tie (more than one winner)
  const isTie = market.resolved && market.numWinners > 1;

  // Get names of all winning sides
  const winningNames: string[] = [];
  if (market.resolved) {
    for (let i = 0; i < market.numSides; i++) {
      if (market.winningSides && market.winningSides[i]) {
        winningNames.push(sideNames[i]);
      }
    }
  }

  const marketWithPrices: MarketWithPrices = {
    publicKey,
    creator: market.creator,
    question: market.question,
    description: market.description,
    endTimestamp: market.endTimestamp,
    resolved: market.resolved,
    winningSideIndex: market.winningSideIndex,
    totalPool: market.totalPool,
    numSides: market.numSides,
    sides: market.sides,
    feePool: market.feePool,
    creatorFeesDistributed: market.creatorFeesDistributed,
    protocolFeesDistributed: market.protocolFeesDistributed,
    totalVolume: market.totalVolume,
    numBettors: market.numBettors,
    creationAmount: market.creationAmount,
    bump: market.bump,
    winningSides: market.winningSides || [false, false, false, false, false, false, false, false, false, false],
    numWinners: market.numWinners || 1,
    endDate,
    isActive,
    totalLiquidity: totalPoolNum / LAMPORTS_PER_SOL,
    volume: market.totalVolume.toNumber() / LAMPORTS_PER_SOL,
    sidePrices,
    sideNames,
    isTie,
    winningNames,
  };

  return marketWithPrices;
}

/**
 * Calculate user's estimated payout considering ties
 * In a tie, user gets payout based on their proportion of ALL winning sides
 */
export function calculateTiePayout(
  market: MarketWithPrices,
  position: any
): number {
  if (!market.resolved || position.claimed) {
    return 0;
  }

  // Calculate total user bet on all winning sides
  let totalUserBetOnWinners = 0;
  let totalWinningSideAmounts = 0;

  for (let i = 0; i < market.numSides; i++) {
    if (market.winningSides[i]) {
      const userBet = position.bets[i];
      if (userBet && userBet.hasBet && userBet.amount.toNumber() > 0) {
        totalUserBetOnWinners += userBet.amount.toNumber();
      }
      totalWinningSideAmounts += market.sides[i].totalAmount.toNumber();
    }
  }

  if (totalUserBetOnWinners === 0 || totalWinningSideAmounts === 0) {
    return 0;
  }

  // Calculate proportional payout
  const payout =
    (totalUserBetOnWinners / totalWinningSideAmounts) *
    market.totalPool.toNumber();

  return payout / LAMPORTS_PER_SOL;
}

/**
 * Check if user has winning bets (considering ties)
 */
export function hasWinningBets(market: MarketWithPrices, position: any): boolean {
  if (!market.resolved) {
    return false;
  }

  for (let i = 0; i < market.numSides; i++) {
    if (market.winningSides[i]) {
      const userBet = position.bets[i];
      if (userBet && userBet.hasBet && userBet.amount.toNumber() > 0) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Get display text for market result (handles ties)
 */
export function getMarketResultText(market: MarketWithPrices): string {
  if (!market.resolved) {
    return 'Not resolved';
  }

  if (market.isTie) {
    if (market.numWinners === market.numSides) {
      return `${market.numWinners}-way tie (all sides tied)`;
    }
    return `${market.numWinners}-way tie: ${market.winningNames.join(', ')}`;
  }

  return `Winner: ${market.winningNames[0] || market.sideNames[market.winningSideIndex]}`;
}