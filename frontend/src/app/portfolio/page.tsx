'use client';

import { useEffect, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useProgram } from '@/hooks/useProgram';
import Navbar from '@/components/Navbar';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { PublicKey } from '@solana/web3.js';
import { LAMPORTS_PER_SOL, PROTOCOL_AUTHORITY } from '@/lib/constants';
import { getPositionPda, getTreasuryPda } from '@/lib/anchor';
import Link from 'next/link';
import { calculateTiePayout, hasWinningBets, getMarketResultText } from '@/lib/market-utils';

interface MarketPosition {
  marketAddress: string;
  marketQuestion: string;
  marketEndDate: Date;
  marketResolved: boolean;
  winningSideIndex: number;
  winningSides: boolean[];
  numWinners: number;
  isTie: boolean;
  isActive: boolean;
  totalPool: number;
  sides: {
    name: string;
    totalAmount: number;
  }[];
  userBets: {
    sideIndex: number;
    sideName: string;
    amount: number;
    hasBet: boolean;
    isWinner: boolean;
  }[];
  totalInvested: number;
  claimed: boolean;
  estimatedPayout: number;
}

interface CreatedMarket {
  marketAddress: string;
  question: string;
  endDate: Date;
  resolved: boolean;
  isActive: boolean;
  totalPool: number;
  totalVolume: number;
  numBettors: number;
  feePool: number;
  creatorFeesDistributed: number;
  availableCreatorFees: number;
}

export default function PortfolioPage() {
  const { publicKey } = useWallet();
  const program = useProgram();
  
  const [positions, setPositions] = useState<MarketPosition[]>([]);
  const [createdMarkets, setCreatedMarkets] = useState<CreatedMarket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [txLoading, setTxLoading] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'positions' | 'created'>('positions');

  useEffect(() => {
    if (publicKey && program) {
      loadPortfolio();
    } else {
      setLoading(false);
    }
  }, [publicKey, program]);

  async function loadPortfolio() {
    if (!publicKey || !program) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError('');
      
      console.log('🔍 Loading portfolio for:', publicKey.toString());

      // Get all markets
      const allMarkets = await program.account.market.all();
      console.log('📊 Found', allMarkets.length, 'total markets');

      const userPositions: MarketPosition[] = [];
      const userCreatedMarkets: CreatedMarket[] = [];

      // Check each market
      for (const { publicKey: marketPubkey, account: marketAccount } of allMarkets) {
        try {
          const market = marketAccount as any;
          
          // Check if user created this market
          if (market.creator.toString() === publicKey.toString()) {
            console.log('✅ Found created market:', market.question);
            
            const endDate = new Date(market.endTimestamp.toNumber() * 1000);
            const isActive = !market.resolved && Date.now() < endDate.getTime();
            
            // Calculate available creator fees (50% of fee pool minus already distributed)
            const totalCreatorFees = market.feePool.toNumber() / 2;
            const availableCreatorFees = totalCreatorFees - market.creatorFeesDistributed.toNumber();
            
            userCreatedMarkets.push({
              marketAddress: marketPubkey.toString(),
              question: market.question,
              endDate,
              resolved: market.resolved,
              isActive,
              totalPool: market.totalPool.toNumber() / LAMPORTS_PER_SOL,
              totalVolume: market.totalVolume.toNumber() / LAMPORTS_PER_SOL,
              numBettors: market.numBettors,
              feePool: market.feePool.toNumber() / LAMPORTS_PER_SOL,
              creatorFeesDistributed: market.creatorFeesDistributed.toNumber() / LAMPORTS_PER_SOL,
              availableCreatorFees: availableCreatorFees / LAMPORTS_PER_SOL,
            });
          }
          
          // Try to get user's position for this market
          const { positionPda } = getPositionPda(marketPubkey, publicKey);
          
          let positionAccount;
          try {
            positionAccount = await program.account.userPosition.fetch(positionPda);
          } catch (err) {
            // No position for this market - skip
            continue;
          }

          const position = positionAccount as any;

          // Check if user has any bets in this market
          const hasAnyBets = position.bets.some((bet: any) => bet.hasBet && bet.amount.toNumber() > 0);
          
          if (!hasAnyBets) {
            continue;
          }

          console.log('✅ Found position in market:', market.question);

          // Decode side names
          const sides = [];
          for (let i = 0; i < market.numSides; i++) {
            const side = market.sides[i];
            const nameBytes = side.name.slice(0, side.nameLen);
            const name = new TextDecoder('utf-8', { fatal: false }).decode(new Uint8Array(nameBytes));
            sides.push({
              name,
              totalAmount: side.totalAmount.toNumber() / LAMPORTS_PER_SOL,
            });
          }

          // Get user's bets with winner flags
          const userBets = position.bets
            .map((bet: any, index: number) => ({
              sideIndex: index,
              sideName: sides[index]?.name || `Side ${index}`,
              amount: bet.amount.toNumber() / LAMPORTS_PER_SOL,
              hasBet: bet.hasBet,
              isWinner: market.resolved && market.winningSides && market.winningSides[index],
            }))
            .filter((bet: any) => bet.hasBet && bet.amount > 0);

          // Calculate estimated payout using tie-aware function
          const endDate = new Date(market.endTimestamp.toNumber() * 1000);
          const isActive = !market.resolved && Date.now() < endDate.getTime();
          
          // Create a temporary market object for calculation
          const tempMarket = {
            resolved: market.resolved,
            winningSides: market.winningSides || Array(10).fill(false),
            numWinners: market.numWinners || 1,
            totalPool: market.totalPool,
            numSides: market.numSides,
            sides: market.sides,
          };
          
          const estimatedPayout = market.resolved && !position.claimed 
            ? calculateTiePayout(tempMarket as any, position)
            : 0;

          const isTie = market.resolved && market.numWinners > 1;

          userPositions.push({
            marketAddress: marketPubkey.toString(),
            marketQuestion: market.question,
            marketEndDate: endDate,
            marketResolved: market.resolved,
            winningSideIndex: market.winningSideIndex,
            winningSides: market.winningSides || Array(10).fill(false),
            numWinners: market.numWinners || 1,
            isTie,
            isActive,
            totalPool: market.totalPool.toNumber() / LAMPORTS_PER_SOL,
            sides,
            userBets,
            totalInvested: position.totalInvested.toNumber() / LAMPORTS_PER_SOL,
            claimed: position.claimed,
            estimatedPayout,
          });

        } catch (err) {
          console.error('Error processing market:', marketPubkey.toString(), err);
        }
      }

      console.log('📈 Found', userPositions.length, 'positions');
      console.log('🎯 Created', userCreatedMarkets.length, 'markets');
      
      setPositions(userPositions);
      setCreatedMarkets(userCreatedMarkets);

    } catch (err: any) {
      console.error('❌ Error loading portfolio:', err);
      setError(err.message || 'Failed to load portfolio');
    } finally {
      setLoading(false);
    }
  }

  async function handleClaimCreatorFees(marketAddress: string) {
    if (!publicKey || !program) return;

    try {
      setTxLoading(marketAddress);
      setError('');

      const marketPubkey = new PublicKey(marketAddress);
      const { treasuryPda } = getTreasuryPda();

      console.log('Claiming creator fees from:', marketAddress);
      console.log('Protocol authority:', PROTOCOL_AUTHORITY.toString());

      const tx = await program.methods
        .claimCreatorFees()
        .accounts({
          market: marketPubkey,
          treasury: treasuryPda,
          creator: publicKey,
          protocolAuthority: PROTOCOL_AUTHORITY,
        })
        .rpc();

      console.log('✅ Fees claimed! Both creator and protocol paid:', tx);

      // Reload portfolio
      await new Promise(resolve => setTimeout(resolve, 2000));
      await loadPortfolio();

    } catch (err: any) {
      console.error('Error claiming fees:', err);
      let errorMessage = 'Failed to claim fees';
      if (err.message) {
        if (err.message.includes('MarketNotEnded')) {
          errorMessage = 'Market has not ended yet';
        } else if (err.message.includes('NoFeesToClaim')) {
          errorMessage = 'No fees available to claim';
        } else if (err.message.includes('FeesAlreadyClaimed')) {
          errorMessage = 'Fees already claimed';
        } else {
          errorMessage = err.message;
        }
      }
      setError(errorMessage);
    } finally {
      setTxLoading(null);
    }
  }

  // Calculate stats
  const totalInvested = positions.reduce((sum, p) => sum + p.totalInvested, 0);
  const totalPotentialPayout = positions.reduce((sum, p) => {
    if (p.marketResolved && !p.claimed) {
      return sum + p.estimatedPayout;
    }
    return sum;
  }, 0);
  const activePositions = positions.filter(p => p.isActive).length;
  const claimablePositions = positions.filter(p => p.marketResolved && !p.claimed && p.estimatedPayout > 0).length;

  // Creator stats
  const totalCreatorFees = createdMarkets.reduce((sum, m) => sum + m.availableCreatorFees, 0);
  const activeCreatedMarkets = createdMarkets.filter(m => m.isActive).length;
  const claimableCreatorFees = createdMarkets.filter(m => m.resolved && m.availableCreatorFees > 0).length;

  return (
    <div className="min-h-screen bg-dark-bg">
      <Navbar />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-8 flex justify-between items-center">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2">Your Portfolio</h1>
            <p className="text-lg text-dark-muted">Track your positions and earnings</p>
          </div>
          {publicKey && (
            <button
              onClick={loadPortfolio}
              disabled={loading}
              className="bg-dark-card text-white border-2 border-white px-6 py-2 rounded-lg font-semibold hover:bg-dark-border transition disabled:opacity-50"
            >
              {loading ? 'Loading...' : 'Refresh'}
            </button>
          )}
        </div>

        {!publicKey ? (
          <div className="text-center py-16 bg-dark-card rounded-lg shadow border border-dark-border">
            <div className="text-6xl mb-4">👛</div>
            <h2 className="text-2xl font-bold text-white mb-4">
              Connect Your Wallet
            </h2>
            <p className="text-dark-muted mb-6">
              Connect your wallet to view your portfolio
            </p>
            <WalletMultiButton />
          </div>
        ) : loading ? (
          <div className="text-center py-16 bg-dark-card rounded-lg shadow border border-dark-border">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-white mb-4"></div>
            <p className="text-dark-muted">Loading your positions...</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Tab Navigation */}
            <div className="bg-dark-card rounded-lg shadow border border-dark-border">
              <div className="border-b border-dark-border">
                <nav className="flex -mb-px">
                  <button
                    onClick={() => setActiveTab('positions')}
                    className={`px-6 py-4 font-semibold border-b-2 transition ${
                      activeTab === 'positions'
                        ? 'border-white text-white'
                        : 'border-transparent text-dark-muted hover:text-white hover:border-dark-border'
                    }`}
                  >
                    Your Sentiments ({positions.length})
                  </button>
                  <button
                    onClick={() => setActiveTab('created')}
                    className={`px-6 py-4 font-semibold border-b-2 transition ${
                      activeTab === 'created'
                        ? 'border-white text-white'
                        : 'border-transparent text-dark-muted hover:text-white hover:border-dark-border'
                    }`}
                  >
                    Markets You Created ({createdMarkets.length})
                  </button>
                </nav>
              </div>

              {/* Error Message */}
              {error && (
                <div className="m-6 bg-red-900/20 border-l-4 border-red-500 p-4">
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <svg className="h-5 w-5 text-red-500" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="ml-3">
                      <p className="text-sm text-red-400">{error}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Your Bets Tab */}
              {activeTab === 'positions' && (
                <>
                  {/* Stats Overview */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-6 p-6 border-b border-dark-border">
                    <div>
                      <div className="text-sm text-dark-muted mb-1">Total Invested</div>
                      <div className="text-2xl font-bold text-white">
                        {totalInvested.toFixed(4)} SOL
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-dark-muted mb-1">Potential Payout</div>
                      <div className="text-2xl font-bold text-white">
                        {totalPotentialPayout.toFixed(4)} SOL
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-dark-muted mb-1">Active Positions</div>
                      <div className="text-2xl font-bold text-white">{activePositions}</div>
                    </div>
                    <div>
                      <div className="text-sm text-dark-muted mb-1">Claimable</div>
                      <div className="text-2xl font-bold text-white">{claimablePositions}</div>
                    </div>
                  </div>

                  {/* Positions List */}
                  {positions.length === 0 ? (
                    <div className="p-12 text-center">
                      <div className="text-6xl mb-4">📊</div>
                      <h3 className="text-xl font-semibold text-white mb-2">
                        No Positions Yet
                      </h3>
                      <p className="text-dark-muted mb-6">
                        Start trading on prediction markets to see your positions here
                      </p>
                      <a
                        href="/"
                        className="inline-block bg-white text-black px-6 py-3 rounded-lg font-semibold hover:bg-gray-200 transition"
                      >
                        Browse Markets
                      </a>
                    </div>
                  ) : (
                    <div className="divide-y divide-dark-border">
                      {positions.map((position, index) => (
                        <div key={index} className="p-6 hover:bg-dark-bg transition">
                          <div className="flex justify-between items-start mb-4">
                            <div className="flex-1">
                              <Link 
                                href={`/market/${position.marketAddress}`}
                                className="text-lg font-bold text-white hover:text-gray-300 transition"
                              >
                                {position.marketQuestion}
                              </Link>
                              <div className="flex items-center space-x-3 mt-2 text-sm flex-wrap gap-2">
                                {position.isActive ? (
                                  <span className="flex items-center text-white">
                                    <span className="inline-block w-2 h-2 bg-white rounded-full mr-1 animate-pulse"></span>
                                    Active
                                  </span>
                                ) : position.marketResolved ? (
                                  <>
                                    <span className="flex items-center text-dark-muted">
                                      <span className="inline-block w-2 h-2 bg-gray-400 rounded-full mr-1"></span>
                                      Resolved
                                    </span>
                                    {position.isTie && position.numWinners > 1 && (
                                      <span className="text-xs bg-white/10 text-white px-2 py-1 rounded">
                                        {position.numWinners}-way tie
                                      </span>
                                    )}
                                  </>
                                ) : (
                                  <span className="flex items-center text-gray-400">
                                    <span className="inline-block w-2 h-2 bg-gray-500 rounded-full mr-1"></span>
                                    Ended
                                  </span>
                                )}
                                <span className="text-dark-muted">
                                  {position.marketEndDate.toLocaleDateString()}
                                </span>
                              </div>
                            </div>
                            
                            {/* Action Button */}
                            {position.marketResolved && !position.claimed && position.estimatedPayout > 0 ? (
                              <Link
                                href={`/market/${position.marketAddress}`}
                                className="bg-white text-black px-4 py-2 rounded-lg font-semibold hover:bg-gray-200 transition text-sm"
                              >
                                Claim {position.estimatedPayout.toFixed(4)} SOL
                              </Link>
                            ) : position.claimed ? (
                              <span className="bg-white/10 text-white px-4 py-2 rounded-lg font-semibold text-sm">
                                ✓ Claimed
                              </span>
                            ) : position.isActive ? (
                              <Link
                                href={`/market/${position.marketAddress}`}
                                className="bg-dark-bg text-white border-2 border-white px-4 py-2 rounded-lg font-semibold hover:bg-dark-border transition text-sm"
                              >
                                View Market
                              </Link>
                            ) : (
                              <span className="bg-dark-bg text-dark-muted px-4 py-2 rounded-lg text-sm border border-dark-border">
                                {position.isTie 
                                  ? 'No Winnings (No Winning Bets)'
                                  : 'No Winnings'
                                }
                              </span>
                            )}
                          </div>

                          {/* Your Bets with Tie Winner Indicators */}
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-3">
                            {position.userBets.map((bet, betIndex) => {
                              const isWinningSide = bet.isWinner;
                              return (
                                <div
                                  key={betIndex}
                                  className={`p-3 rounded-lg border-2 ${
                                    isWinningSide
                                      ? 'border-white bg-white/10'
                                      : 'border-dark-border bg-dark-bg'
                                  }`}
                                >
                                  <div className="flex justify-between items-center">
                                    <div>
                                      <div className="font-semibold text-sm text-white">
                                        {bet.sideName}
                                      </div>
                                      <div className="text-xs text-dark-muted">
                                        {bet.amount.toFixed(4)} SOL
                                      </div>
                                    </div>
                                    {isWinningSide && (
                                      <span className="text-white text-lg">
                                        {position.isTie && position.numWinners > 1 ? '🏆' : '🏆'}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>

                          {/* Stats with Tie Information */}
                          <div className="flex justify-between items-center text-sm pt-3 border-t border-dark-border">
                            <div className="flex space-x-4">
                              <span className="text-dark-muted">
                                Total Invested: <span className="font-semibold text-white">
                                  {position.totalInvested.toFixed(4)} SOL
                                </span>
                              </span>
                              {position.marketResolved && position.estimatedPayout > 0 && (
                                <span className="text-dark-muted">
                                  Payout: <span className="font-semibold text-white">
                                    {position.estimatedPayout.toFixed(4)} SOL
                                  </span>
                                </span>
                              )}
                            </div>
                            {position.marketResolved && (
                              <span className="text-dark-muted text-xs">
                                {position.isTie && position.numWinners > 1 ? (
                                  <>
                                    {position.numWinners}-way tie: {
                                      position.userBets
                                        .filter(bet => bet.isWinner)
                                        .map(bet => bet.sideName)
                                        .join(', ')
                                    }
                                  </>
                                ) : (
                                  <>Winner: {position.sides[position.winningSideIndex]?.name}</>
                                )}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}

              {/* Markets You Created Tab */}
              {activeTab === 'created' && (
                <>
                  {/* Creator Stats */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-6 p-6 border-b border-dark-border">
                    <div>
                      <div className="text-sm text-dark-muted mb-1">Markets Created</div>
                      <div className="text-2xl font-bold text-white">
                        {createdMarkets.length}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-dark-muted mb-1">Available Fees</div>
                      <div className="text-2xl font-bold text-white">
                        {totalCreatorFees.toFixed(4)} SOL
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-dark-muted mb-1">Active Markets</div>
                      <div className="text-2xl font-bold text-white">{activeCreatedMarkets}</div>
                    </div>
                    <div>
                      <div className="text-sm text-dark-muted mb-1">Fees to Claim</div>
                      <div className="text-2xl font-bold text-white">{claimableCreatorFees}</div>
                    </div>
                  </div>

                  {/* Created Markets List */}
                  {createdMarkets.length === 0 ? (
                    <div className="p-12 text-center">
                      <div className="text-6xl mb-4">🎯</div>
                      <h3 className="text-xl font-semibold text-white mb-2">
                        No Markets Created
                      </h3>
                      <p className="text-dark-muted mb-6">
                        Create your first prediction market and earn fees from trading
                      </p>
                      <a
                        href="/create"
                        className="inline-block bg-white text-black px-6 py-3 rounded-lg font-semibold hover:bg-gray-200 transition"
                      >
                        Create Market
                      </a>
                    </div>
                  ) : (
                    <div className="divide-y divide-dark-border">
                      {createdMarkets.map((market, index) => (
                        <div key={index} className="p-6 hover:bg-dark-bg transition">
                          <div className="flex justify-between items-start mb-4">
                            <div className="flex-1">
                              <Link 
                                href={`/market/${market.marketAddress}`}
                                className="text-lg font-bold text-white hover:text-gray-300 transition"
                              >
                                {market.question}
                              </Link>
                              <div className="flex items-center space-x-3 mt-2 text-sm">
                                {market.isActive ? (
                                  <span className="flex items-center text-white">
                                    <span className="inline-block w-2 h-2 bg-white rounded-full mr-1 animate-pulse"></span>
                                    Active
                                  </span>
                                ) : market.resolved ? (
                                  <span className="flex items-center text-dark-muted">
                                    <span className="inline-block w-2 h-2 bg-gray-400 rounded-full mr-1"></span>
                                    Resolved
                                  </span>
                                ) : (
                                  <span className="flex items-center text-gray-400">
                                    <span className="inline-block w-2 h-2 bg-gray-500 rounded-full mr-1"></span>
                                    Ended
                                  </span>
                                )}
                                <span className="text-dark-muted">
                                  {market.endDate.toLocaleDateString()}
                                </span>
                                <span className="text-dark-muted">
                                  {market.numBettors} traders
                                </span>
                              </div>
                            </div>
                            
                            {/* Claim Fees Button */}
                            {market.resolved && market.availableCreatorFees > 0 ? (
                              <button
                                onClick={() => handleClaimCreatorFees(market.marketAddress)}
                                disabled={txLoading === market.marketAddress}
                                className="bg-white text-black px-4 py-2 rounded-lg font-semibold hover:bg-gray-200 transition text-sm disabled:opacity-50"
                              >
                                {txLoading === market.marketAddress
                                  ? 'Claiming...'
                                  : `Claim ${market.availableCreatorFees.toFixed(4)} SOL`
                                }
                              </button>
                            ) : market.creatorFeesDistributed > 0 ? (
                              <span className="bg-green-50 text-green-700 px-4 py-2 rounded-lg font-semibold text-sm">
                                ✓ Fees Claimed
                              </span>
                            ) : market.resolved ? (
                              <span className="bg-gray-50 text-gray-600 px-4 py-2 rounded-lg text-sm">
                                No Fees
                              </span>
                            ) : (
                              <Link
                                href={`/market/${market.marketAddress}`}
                                className="bg-white text-primary border-2 border-primary px-4 py-2 rounded-lg font-semibold hover:bg-gray-50 transition text-sm"
                              >
                                View Market
                              </Link>
                            )}
                          </div>

                          {/* Market Stats */}
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-gray-50 rounded-lg">
                            <div>
                              <div className="text-xs text-gray-600 mb-1">Total Pool</div>
                              <div className="font-semibold text-gray-900">
                                {market.totalPool.toFixed(4)} SOL
                              </div>
                            </div>
                            <div>
                              <div className="text-xs text-gray-600 mb-1">Total Volume</div>
                              <div className="font-semibold text-gray-900">
                                {market.totalVolume.toFixed(4)} SOL
                              </div>
                            </div>
                            <div>
                              <div className="text-xs text-gray-600 mb-1">Fee Pool</div>
                              <div className="font-semibold text-gray-900">
                                {market.feePool.toFixed(4)} SOL
                              </div>
                            </div>
                            <div>
                              <div className="text-xs text-gray-600 mb-1">Your Share (50%)</div>
                              <div className="font-semibold text-primary">
                                {market.availableCreatorFees.toFixed(4)} SOL
                              </div>
                            </div>
                          </div>

                          {/* Info Note */}
                          {market.resolved && market.availableCreatorFees > 0 && (
                            <div className="mt-3 p-3 bg-blue-50 rounded-lg">
                              <p className="text-xs text-blue-700">
                                💡 When you claim, protocol automatically receives their 50% share too
                              </p>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}