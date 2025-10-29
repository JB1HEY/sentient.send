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

interface MarketPosition {
  marketAddress: string;
  marketQuestion: string;
  marketEndDate: Date;
  marketResolved: boolean;
  winningSideIndex: number;
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

          // Get user's bets
          const userBets = position.bets
            .map((bet: any, index: number) => ({
              sideIndex: index,
              sideName: sides[index]?.name || `Side ${index}`,
              amount: bet.amount.toNumber() / LAMPORTS_PER_SOL,
              hasBet: bet.hasBet,
            }))
            .filter((bet: any) => bet.hasBet && bet.amount > 0);

          // Calculate estimated payout if market is resolved
          let estimatedPayout = 0;
          if (market.resolved && !position.claimed) {
            const winningSideIndex = market.winningSideIndex;
            const userBet = position.bets[winningSideIndex];
            
            if (userBet && userBet.hasBet && userBet.amount.toNumber() > 0) {
              const winningSide = market.sides[winningSideIndex];
              if (winningSide.totalAmount.toNumber() > 0) {
                estimatedPayout = 
                  (userBet.amount.toNumber() / winningSide.totalAmount.toNumber()) * 
                  market.totalPool.toNumber() / 
                  LAMPORTS_PER_SOL;
              }
            }
          }

          const endDate = new Date(market.endTimestamp.toNumber() * 1000);
          const isActive = !market.resolved && Date.now() < endDate.getTime();

          userPositions.push({
            marketAddress: marketPubkey.toString(),
            marketQuestion: market.question,
            marketEndDate: endDate,
            marketResolved: market.resolved,
            winningSideIndex: market.winningSideIndex,
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
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-8 flex justify-between items-center">
          <div>
            <h1 className="text-4xl font-bold text-gray-900 mb-2">Your Portfolio</h1>
            <p className="text-lg text-gray-600">Track your positions and earnings</p>
          </div>
          {publicKey && (
            <button
              onClick={loadPortfolio}
              disabled={loading}
              className="bg-white text-primary border-2 border-primary px-6 py-2 rounded-lg font-semibold hover:bg-gray-50 transition disabled:opacity-50"
            >
              {loading ? 'Loading...' : 'Refresh'}
            </button>
          )}
        </div>

        {!publicKey ? (
          <div className="text-center py-16 bg-white rounded-lg shadow">
            <div className="text-6xl mb-4">👛</div>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              Connect Your Wallet
            </h2>
            <p className="text-gray-600 mb-6">
              Connect your wallet to view your portfolio
            </p>
            <WalletMultiButton />
          </div>
        ) : loading ? (
          <div className="text-center py-16 bg-white rounded-lg shadow">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4"></div>
            <p className="text-gray-600">Loading your positions...</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Tab Navigation */}
            <div className="bg-white rounded-lg shadow">
              <div className="border-b border-gray-200">
                <nav className="flex -mb-px">
                  <button
                    onClick={() => setActiveTab('positions')}
                    className={`px-6 py-4 font-semibold border-b-2 transition ${
                      activeTab === 'positions'
                        ? 'border-primary text-primary'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    Your Bets ({positions.length})
                  </button>
                  <button
                    onClick={() => setActiveTab('created')}
                    className={`px-6 py-4 font-semibold border-b-2 transition ${
                      activeTab === 'created'
                        ? 'border-primary text-primary'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    Markets You Created ({createdMarkets.length})
                  </button>
                </nav>
              </div>

              {/* Error Message */}
              {error && (
                <div className="m-6 bg-red-50 border-l-4 border-red-500 p-4">
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <svg className="h-5 w-5 text-red-500" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="ml-3">
                      <p className="text-sm text-red-700">{error}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Your Bets Tab */}
              {activeTab === 'positions' && (
                <>
                  {/* Stats Overview */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-6 p-6 border-b">
                    <div>
                      <div className="text-sm text-gray-600 mb-1">Total Invested</div>
                      <div className="text-2xl font-bold text-gray-900">
                        {totalInvested.toFixed(4)} SOL
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-600 mb-1">Potential Payout</div>
                      <div className="text-2xl font-bold text-green-600">
                        {totalPotentialPayout.toFixed(4)} SOL
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-600 mb-1">Active Positions</div>
                      <div className="text-2xl font-bold text-gray-900">{activePositions}</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-600 mb-1">Claimable</div>
                      <div className="text-2xl font-bold text-primary">{claimablePositions}</div>
                    </div>
                  </div>

                  {/* Positions List */}
                  {positions.length === 0 ? (
                    <div className="p-12 text-center">
                      <div className="text-6xl mb-4">📊</div>
                      <h3 className="text-xl font-semibold text-gray-900 mb-2">
                        No Positions Yet
                      </h3>
                      <p className="text-gray-600 mb-6">
                        Start trading on prediction markets to see your positions here
                      </p>
                      <a
                        href="/"
                        className="inline-block bg-gradient-main text-white px-6 py-3 rounded-lg font-semibold hover:opacity-90 transition"
                      >
                        Browse Markets
                      </a>
                    </div>
                  ) : (
                    <div className="divide-y">
                      {positions.map((position, index) => (
                        <div key={index} className="p-6 hover:bg-gray-50 transition">
                          <div className="flex justify-between items-start mb-4">
                            <div className="flex-1">
                              <Link 
                                href={`/market/${position.marketAddress}`}
                                className="text-lg font-bold text-gray-900 hover:text-primary transition"
                              >
                                {position.marketQuestion}
                              </Link>
                              <div className="flex items-center space-x-3 mt-2 text-sm">
                                {position.isActive ? (
                                  <span className="flex items-center text-green-600">
                                    <span className="inline-block w-2 h-2 bg-green-500 rounded-full mr-1 animate-pulse"></span>
                                    Active
                                  </span>
                                ) : position.marketResolved ? (
                                  <span className="flex items-center text-gray-600">
                                    <span className="inline-block w-2 h-2 bg-gray-400 rounded-full mr-1"></span>
                                    Resolved
                                  </span>
                                ) : (
                                  <span className="flex items-center text-yellow-600">
                                    <span className="inline-block w-2 h-2 bg-yellow-500 rounded-full mr-1"></span>
                                    Ended
                                  </span>
                                )}
                                <span className="text-gray-500">
                                  {position.marketEndDate.toLocaleDateString()}
                                </span>
                              </div>
                            </div>
                            
                            {/* Action Button */}
                            {position.marketResolved && !position.claimed && position.estimatedPayout > 0 ? (
                              <Link
                                href={`/market/${position.marketAddress}`}
                                className="bg-gradient-main text-white px-4 py-2 rounded-lg font-semibold hover:opacity-90 transition text-sm"
                              >
                                Claim {position.estimatedPayout.toFixed(4)} SOL
                              </Link>
                            ) : position.claimed ? (
                              <span className="bg-green-50 text-green-700 px-4 py-2 rounded-lg font-semibold text-sm">
                                ✓ Claimed
                              </span>
                            ) : position.isActive ? (
                              <Link
                                href={`/market/${position.marketAddress}`}
                                className="bg-white text-primary border-2 border-primary px-4 py-2 rounded-lg font-semibold hover:bg-gray-50 transition text-sm"
                              >
                                View Market
                              </Link>
                            ) : (
                              <span className="bg-gray-50 text-gray-600 px-4 py-2 rounded-lg text-sm">
                                No Winnings
                              </span>
                            )}
                          </div>

                          {/* Your Bets */}
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-3">
                            {position.userBets.map((bet, betIndex) => {
                              const isWinningSide = position.marketResolved && bet.sideIndex === position.winningSideIndex;
                              return (
                                <div
                                  key={betIndex}
                                  className={`p-3 rounded-lg border-2 ${
                                    isWinningSide
                                      ? 'border-green-500 bg-green-50'
                                      : 'border-gray-200 bg-gray-50'
                                  }`}
                                >
                                  <div className="flex justify-between items-center">
                                    <div>
                                      <div className="font-semibold text-sm text-gray-900">
                                        {bet.sideName}
                                      </div>
                                      <div className="text-xs text-gray-600">
                                        {bet.amount.toFixed(4)} SOL
                                      </div>
                                    </div>
                                    {isWinningSide && (
                                      <span className="text-green-600 text-xl">🏆</span>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>

                          {/* Stats */}
                          <div className="flex justify-between items-center text-sm pt-3 border-t">
                            <div className="flex space-x-4">
                              <span className="text-gray-600">
                                Total Invested: <span className="font-semibold text-gray-900">
                                  {position.totalInvested.toFixed(4)} SOL
                                </span>
                              </span>
                              {position.marketResolved && position.estimatedPayout > 0 && (
                                <span className="text-gray-600">
                                  Payout: <span className="font-semibold text-green-600">
                                    {position.estimatedPayout.toFixed(4)} SOL
                                  </span>
                                </span>
                              )}
                            </div>
                            {position.marketResolved && (
                              <span className="text-gray-500 text-xs">
                                Winner: {position.sides[position.winningSideIndex]?.name}
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
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-6 p-6 border-b">
                    <div>
                      <div className="text-sm text-gray-600 mb-1">Markets Created</div>
                      <div className="text-2xl font-bold text-gray-900">
                        {createdMarkets.length}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-600 mb-1">Available Fees</div>
                      <div className="text-2xl font-bold text-green-600">
                        {totalCreatorFees.toFixed(4)} SOL
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-600 mb-1">Active Markets</div>
                      <div className="text-2xl font-bold text-gray-900">{activeCreatedMarkets}</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-600 mb-1">Fees to Claim</div>
                      <div className="text-2xl font-bold text-primary">{claimableCreatorFees}</div>
                    </div>
                  </div>

                  {/* Created Markets List */}
                  {createdMarkets.length === 0 ? (
                    <div className="p-12 text-center">
                      <div className="text-6xl mb-4">🎯</div>
                      <h3 className="text-xl font-semibold text-gray-900 mb-2">
                        No Markets Created
                      </h3>
                      <p className="text-gray-600 mb-6">
                        Create your first prediction market and earn fees from trading
                      </p>
                      <a
                        href="/create"
                        className="inline-block bg-gradient-main text-white px-6 py-3 rounded-lg font-semibold hover:opacity-90 transition"
                      >
                        Create Market
                      </a>
                    </div>
                  ) : (
                    <div className="divide-y">
                      {createdMarkets.map((market, index) => (
                        <div key={index} className="p-6 hover:bg-gray-50 transition">
                          <div className="flex justify-between items-start mb-4">
                            <div className="flex-1">
                              <Link 
                                href={`/market/${market.marketAddress}`}
                                className="text-lg font-bold text-gray-900 hover:text-primary transition"
                              >
                                {market.question}
                              </Link>
                              <div className="flex items-center space-x-3 mt-2 text-sm">
                                {market.isActive ? (
                                  <span className="flex items-center text-green-600">
                                    <span className="inline-block w-2 h-2 bg-green-500 rounded-full mr-1 animate-pulse"></span>
                                    Active
                                  </span>
                                ) : market.resolved ? (
                                  <span className="flex items-center text-gray-600">
                                    <span className="inline-block w-2 h-2 bg-gray-400 rounded-full mr-1"></span>
                                    Resolved
                                  </span>
                                ) : (
                                  <span className="flex items-center text-yellow-600">
                                    <span className="inline-block w-2 h-2 bg-yellow-500 rounded-full mr-1"></span>
                                    Ended
                                  </span>
                                )}
                                <span className="text-gray-500">
                                  {market.endDate.toLocaleDateString()}
                                </span>
                                <span className="text-gray-500">
                                  {market.numBettors} traders
                                </span>
                              </div>
                            </div>
                            
                            {/* Claim Fees Button */}
                            {market.resolved && market.availableCreatorFees > 0 ? (
                              <button
                                onClick={() => handleClaimCreatorFees(market.marketAddress)}
                                disabled={txLoading === market.marketAddress}
                                className="bg-gradient-main text-white px-4 py-2 rounded-lg font-semibold hover:opacity-90 transition text-sm disabled:opacity-50"
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