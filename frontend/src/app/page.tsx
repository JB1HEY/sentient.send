'use client';

import { useEffect, useState } from 'react';
import { useConnection } from '@solana/wallet-adapter-react';
import { useSearchParams } from 'next/navigation';
import Navbar from '@/components/Navbar';
import MarketCard from '@/components/MarketCard';
import { MarketWithPrices } from '@/types/market';
import { LAMPORTS_PER_SOL } from '@/lib/constants';
import { useProgram } from '@/hooks/useProgram';
import { IDL } from '@/lib/idl';
import Image from 'next/image';

type TabType = 'all' | 'trending' | 'new' | 'ending-soon' | 'high-volume';

export default function Home() {
  const [markets, setMarkets] = useState<MarketWithPrices[]>([]);
  const [filteredMarkets, setFilteredMarkets] = useState<MarketWithPrices[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const { connection } = useConnection();
  const program = useProgram();
  const searchParams = useSearchParams();
  const searchQuery = searchParams.get('search') || '';

  useEffect(() => {
    loadMarkets();
  }, [connection]);

  useEffect(() => {
    // Filter markets based on search and active tab
    let filtered = [...markets];

    // Apply search filter first
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(market => 
        market.question.toLowerCase().includes(query) ||
        market.description.toLowerCase().includes(query) ||
        market.sideNames.some(name => name.toLowerCase().includes(query))
      );
    }

    // Apply tab filter
    switch (activeTab) {
      case 'trending':
        // Sort by volume (high to low)
        filtered = filtered.sort((a, b) => b.volume - a.volume);
        break;
      
      case 'new':
        // Sort by creation time (newest first)
        // Using market address as proxy since newer markets have higher addresses typically
        filtered = filtered.sort((a, b) => {
          const aNum = parseInt(a.publicKey.toString().slice(0, 8), 16);
          const bNum = parseInt(b.publicKey.toString().slice(0, 8), 16);
          return bNum - aNum;
        });
        break;
      
      case 'ending-soon':
        // Sort by end time (soonest first)
        filtered = filtered.sort((a, b) => 
          a.endDate.getTime() - b.endDate.getTime()
        );
        break;
      
      case 'high-volume':
        // Filter markets with >1 SOL volume and sort
        filtered = filtered
          .filter(m => m.volume >= 1)
          .sort((a, b) => b.volume - a.volume);
        break;
      
      case 'all':
      default:
        // Sort by end time (soonest first) for "all"
        filtered = filtered.sort((a, b) => 
          a.endDate.getTime() - b.endDate.getTime()
        );
        break;
    }

    setFilteredMarkets(filtered);
  }, [searchQuery, markets, activeTab]);

  async function loadMarkets() {
    try {
      setLoading(true);
      setError('');
      
      let programToUse = program;
      
      if (!programToUse) {
        console.log('⚠️ No wallet connected, creating read-only program instance');
        const { AnchorProvider, Program } = await import('@coral-xyz/anchor');
        const { Keypair } = await import('@solana/web3.js');
        
        const dummyWallet = {
          publicKey: Keypair.generate().publicKey,
          signTransaction: async () => { throw new Error('Read-only'); },
          signAllTransactions: async () => { throw new Error('Read-only'); },
        };
        
        const provider = new AnchorProvider(
          connection,
          dummyWallet as any,
          { commitment: 'confirmed' }
        );
        
        // @ts-ignore
        programToUse = new Program(IDL, provider);
        console.log('✅ Read-only program created');
      }

      console.log('🔍 Fetching markets from program:', programToUse.programId.toString());
      
      // @ts-ignore
      const marketAccounts = await programToUse.account.market.all();
      
      console.log('✅ Found', marketAccounts.length, 'total market accounts');

      if (marketAccounts.length === 0) {
        console.log('ℹ️ No markets found on chain');
        setMarkets([]);
        setLoading(false);
        return;
      }

      const marketsWithPrices: MarketWithPrices[] = [];

      for (const { publicKey, account } of marketAccounts) {
        try {
          const market = account as any;
          
          // Calculate prices (% of total pool for each side)
          const totalPoolNum = market.totalPool.toNumber();
          const sidePrices = [];
          const sideNames = [];

          for (let i = 0; i < market.numSides; i++) {
            const side = market.sides[i];
            
            // Decode side name
            const nameBytes = side.name.slice(0, side.nameLen);
            const name = new TextDecoder('utf-8', { fatal: false }).decode(new Uint8Array(nameBytes));
            sideNames.push(name);
            
            // Calculate percentage
            const sidePercent = totalPoolNum > 0 
              ? (side.totalAmount.toNumber() / totalPoolNum) * 100 
              : 0;
            sidePrices.push(sidePercent);
          }

          const endDate = new Date(market.endTimestamp.toNumber() * 1000);
          const isActive = !market.resolved && Date.now() < endDate.getTime();

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
            endDate,
            isActive,
            totalLiquidity: totalPoolNum / LAMPORTS_PER_SOL,
            volume: market.totalVolume.toNumber() / LAMPORTS_PER_SOL,
            sidePrices,
            sideNames,
          };
          
          marketsWithPrices.push(marketWithPrices);
        } catch (err) {
          console.error('❌ Error processing market:', publicKey.toString(), err);
        }
      }

      // Filter to only show active markets
      const activeMarkets = marketsWithPrices.filter(m => m.isActive);
      
      console.log('📈 Total markets:', marketsWithPrices.length);
      console.log('✅ Active markets:', activeMarkets.length);
      
      setMarkets(activeMarkets);
      
    } catch (error: any) {
      console.error('❌ Error loading markets:', error);
      setError(error.message || 'Failed to load markets');
    } finally {
      setLoading(false);
    }
  }

  const tabs = [
    { id: 'all' as TabType, label: 'All Markets'},
    { id: 'trending' as TabType, label: 'Trending'},
    { id: 'new' as TabType, label: 'New'},
    { id: 'ending-soon' as TabType, label: 'Ending Soon'},
    { id: 'high-volume' as TabType, label: 'High Volume'},
  ];

  return (
    <div className="min-h-screen bg-dark-bg">
      <Navbar />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Hero Section */}
        <div className="text-center mb-12 flex flex-col items-center">
          <Image src="/transparent.png" alt="sentient.send" width={200} height={200} />
          <p className="text-xl text-dark-muted mb-8">
            Create markets with 2-10 options. Winner takes all. Powered by native SOL on Solana.
          </p>
          <div className="flex justify-center space-x-4">
            <a
              href="/create"
              className="bg-white text-black px-8 py-3 rounded-lg font-semibold hover:bg-gray-200 transition"
            >
              Create Market
            </a>
            <button
              onClick={loadMarkets}
              disabled={loading}
              className="bg-dark-card text-white border-2 border-white px-8 py-3 rounded-lg font-semibold hover:bg-dark-border transition disabled:opacity-50"
            >
              {loading ? 'Loading...' : 'Refresh Markets'}
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="mb-8">
          <div className="border-b border-dark-border">
            <nav className="flex space-x-8 overflow-x-auto">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`py-4 px-2 border-b-2 font-medium text-sm whitespace-nowrap transition ${
                    activeTab === tab.id
                      ? 'border-white text-white'
                      : 'border-transparent text-dark-muted hover:text-white hover:border-dark-border'
                  }`}
                >
                  <span className="mr-2">{tab.icon}</span>
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-8 bg-red-900/20 border-l-4 border-red-500 p-4">
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

        {/* Markets Grid */}
        <div className="mb-8">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-dark-text">
              {searchQuery ? `Search Results for "${searchQuery}"` : tabs.find(t => t.id === activeTab)?.label}
            </h2>
            {searchQuery && (
              <a 
                href="/" 
                className="text-sm text-dark-muted hover:text-white transition"
              >
                Clear Search
              </a>
            )}
          </div>
          
          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
              <p className="mt-4 text-dark-muted">Loading markets...</p>
            </div>
          ) : filteredMarkets.length === 0 && searchQuery ? (
            <div className="text-center py-12 bg-dark-card rounded-lg shadow border border-dark-border">
              <div className="text-6xl mb-4">🔍</div>
              <h3 className="text-xl font-semibold text-dark-text mb-2">No Markets Found</h3>
              <p className="text-dark-muted mb-6">No markets match your search query "{searchQuery}"</p>
              <a
                href="/"
                className="inline-block bg-white text-black px-6 py-2 rounded-lg font-semibold hover:bg-gray-200 transition"
              >
                View All Markets
              </a>
            </div>
          ) : filteredMarkets.length === 0 ? (
            <div className="text-center py-12 bg-dark-card rounded-lg shadow border border-dark-border">
              <div className="text-6xl mb-4">
                {activeTab === 'trending' && '📈'}
                {activeTab === 'new' && '✨'}
                {activeTab === 'ending-soon' && '⏰'}
                {activeTab === 'high-volume' && '💰'}
                {activeTab === 'all' && '📊'}
              </div>
              <h3 className="text-xl font-semibold text-dark-text mb-2">
                {activeTab === 'high-volume' && 'No High Volume Markets Yet'}
                {activeTab === 'trending' && 'No Trending Markets Yet'}
                {activeTab === 'new' && 'No New Markets'}
                {activeTab === 'ending-soon' && 'No Markets Ending Soon'}
                {activeTab === 'all' && 'No Active Markets'}
              </h3>
              <p className="text-dark-muted mb-6">Be the first to create a prediction market!</p>
              <a
                href="/create"
                className="inline-block bg-white text-black px-6 py-2 rounded-lg font-semibold hover:bg-gray-200 transition"
              >
                Create First Market
              </a>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredMarkets.map((market) => (
                  <MarketCard key={market.publicKey.toString()} market={market} />
                ))}
              </div>
              
              {/* Results count */}
              <div className="mt-6 text-center text-sm text-dark-muted">
                Showing {filteredMarkets.length} market{filteredMarkets.length !== 1 ? 's' : ''}
              </div>
            </>
          )}
        </div>

        {/* Stats Section */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12">
          <div className="bg-dark-card p-6 rounded-lg shadow border border-dark-border">
            <div className="text-3xl font-bold text-white mb-2">{markets.length}</div>
            <div className="text-dark-muted">Active Markets</div>
          </div>
          <div className="bg-dark-card p-6 rounded-lg shadow border border-dark-border">
            <div className="text-3xl font-bold text-white mb-2">
              {markets.reduce((acc, m) => acc + (m.volume || 0), 0).toFixed(2)}
            </div>
            <div className="text-dark-muted">Total Volume (SOL)</div>
          </div>
          <div className="bg-dark-card p-6 rounded-lg shadow border border-dark-border">
            <div className="text-3xl font-bold text-white mb-2">
              {markets.reduce((acc, m) => acc + (m.numBettors || 0), 0)}
            </div>
            <div className="text-dark-muted">Total Traders</div>
          </div>
        </div>
      </main>
    </div>
  );
}