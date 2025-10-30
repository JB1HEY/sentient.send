'use client';

import { useEffect, useState } from 'react';
import { useConnection } from '@solana/wallet-adapter-react';
import Navbar from '@/components/Navbar';
import MarketCard from '@/components/MarketCard';
import { MarketWithPrices } from '@/types/market';
import { LAMPORTS_PER_SOL } from '@/lib/constants';
import { useProgram } from '@/hooks/useProgram';
import { IDL } from '@/lib/idl';

export default function Home() {
  const [markets, setMarkets] = useState<MarketWithPrices[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { connection } = useConnection();
  const program = useProgram();

  useEffect(() => {
    // Load markets even without wallet connected
    loadMarkets();
  }, [connection]);

  async function loadMarkets() {
    try {
      setLoading(true);
      setError('');
      
      // Create a temporary program instance if wallet not connected
      let programToUse = program;
      
      if (!programToUse) {
        console.log('⚠️ No wallet connected, creating read-only program instance');
        const { AnchorProvider, Program } = await import('@coral-xyz/anchor');
        const { Keypair } = await import('@solana/web3.js');
        
        // Create a dummy wallet for read-only access
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
      
      // Use Anchor's built-in account fetcher instead of manual parsing
      // This is much more reliable and handles all the complexity
      // @ts-ignore - TypeScript doesn't know about the market account type
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
          
          console.log('📊 Processing market:', publicKey.toString());
          console.log('   Question:', market.question);
          console.log('   Resolved:', market.resolved);
          console.log('   End timestamp:', new Date(market.endTimestamp.toNumber() * 1000).toLocaleString());

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

          console.log('   Status:', isActive ? '✅ Active' : '❌ Inactive/Resolved');
          console.log('   Sides:', sideNames.join(', '));
          
          marketsWithPrices.push(marketWithPrices);
        } catch (err) {
          console.error('❌ Error processing market:', publicKey.toString(), err);
        }
      }

      // Filter to only show active markets
      const activeMarkets = marketsWithPrices.filter(m => m.isActive);
      
      console.log('📈 Total markets:', marketsWithPrices.length);
      console.log('✅ Active markets:', activeMarkets.length);
      
      if (activeMarkets.length === 0 && marketsWithPrices.length > 0) {
        console.log('ℹ️ All markets are either resolved or ended');
      }
      
      setMarkets(activeMarkets);
      
    } catch (error: any) {
      console.error('❌ Error loading markets:', error);
      console.error('Error details:', {
        message: error.message,
        code: error.code,
        logs: error.logs,
      });
      setError(error.message || 'Failed to load markets');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold bg-gradient-main bg-clip-text text-transparent mb-4">
            Sentient
          </h1>
          <p className="text-xl text-gray-600 mb-8">
            Create markets with 2-10 options. Winner takes all. Powered by native SOL on Solana.
          </p>
          <div className="flex justify-center space-x-4">
            <a
              href="/create"
              className="bg-gradient-main text-white px-8 py-3 rounded-lg font-semibold hover:opacity-90 transition"
            >
              Create Market
            </a>
            <button
              onClick={loadMarkets}
              disabled={loading}
              className="bg-white text-primary border-2 border-primary px-8 py-3 rounded-lg font-semibold hover:bg-gray-50 transition disabled:opacity-50"
            >
              {loading ? 'Loading...' : 'Refresh Markets'}
            </button>
          </div>
          
          {/* Debug Info - removed as markets now load without wallet */}
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-8 bg-red-50 border-l-4 border-red-500 p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-500" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-red-700">{error}</p>
                <p className="text-xs text-red-600 mt-1">Check the browser console for more details</p>
              </div>
            </div>
          </div>
        )}

        {/* Markets Grid */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Active Markets</h2>
          
          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
              <p className="mt-4 text-gray-600">Loading markets...</p>
              <p className="mt-2 text-sm text-gray-500">This may take a few seconds</p>
            </div>
          ) : markets.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-lg shadow">
              <div className="text-6xl mb-4">📊</div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">No Active Markets</h3>
              <p className="text-gray-600 mb-6">Be the first to create a prediction market!</p>
              <a
                href="/create"
                className="inline-block bg-gradient-main text-white px-6 py-2 rounded-lg font-semibold hover:opacity-90 transition"
              >
                Create First Market
              </a>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {markets.map((market) => (
                <MarketCard key={market.publicKey.toString()} market={market} />
              ))}
            </div>
          )}
        </div>

        {/* Stats Section */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12">
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="text-3xl font-bold text-primary mb-2">{markets.length}</div>
            <div className="text-gray-600">Active Markets</div>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="text-3xl font-bold text-primary mb-2">
              {markets.reduce((acc, m) => acc + (m.volume || 0), 0).toFixed(2)}
            </div>
            <div className="text-gray-600">Total Volume (SOL)</div>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="text-3xl font-bold text-primary mb-2">
              {markets.reduce((acc, m) => acc + (m.numBettors || 0), 0)}
            </div>
            <div className="text-gray-600">Total Traders</div>
          </div>
        </div>
      </main>
    </div>
  );
}