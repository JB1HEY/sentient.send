'use client';

import { useEffect, useState } from 'react';
import { useConnection } from '@solana/wallet-adapter-react';
import Navbar from '@/components/Navbar';
import MarketCard from '@/components/MarketCard';
import { getConnection, decodeSideName } from '@/lib/anchor';
import { MarketWithPrices } from '@/types/market';
import { LAMPORTS_PER_SOL, PROGRAM_ID } from '@/lib/constants';
import { useAnchorWallet } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';
import BN from 'bn.js';

export default function Home() {
  const [markets, setMarkets] = useState<MarketWithPrices[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const wallet = useAnchorWallet();

  useEffect(() => {
    loadMarkets();
  }, []);

  async function loadMarkets() {
    try {
      setLoading(true);
      setError('');
      const connection = getConnection();
      
      console.log('Fetching markets from program:', PROGRAM_ID.toString());
      
      const accounts = await connection.getProgramAccounts(PROGRAM_ID, {
        filters: [
          {
            dataSize: 1500, // Approximate market account size (increased to catch all)
          }
        ]
      });

      console.log('Found accounts:', accounts.length);

      if (accounts.length === 0) {
        console.log('No markets found');
        setMarkets([]);
        setLoading(false);
        return;
      }

      const marketPromises = accounts.map(async ({ pubkey, account }) => {
        try {
          const data = account.data;
          
          // Check discriminator (first 8 bytes)
          const discriminator = Array.from(data.slice(0, 8));
          const marketDiscriminator = [219, 190, 213, 55, 0, 227, 198, 154];
          
          // Check if this is a Market account
          const isMarket = discriminator.every((val, idx) => val === marketDiscriminator[idx]);
          
          if (!isMarket) {
            console.log('Skipping non-market account:', pubkey.toString());
            return null;
          }

          console.log('Processing market account:', pubkey.toString());

          let offset = 8; // Skip discriminator

          // Read creator (32 bytes)
          const creator = new PublicKey(data.slice(offset, offset + 32));
          offset += 32;

          // Read question string (4 bytes length + string data)
          const questionLen = data.readUInt32LE(offset);
          offset += 4;
          
          if (questionLen > 500) {
            console.log('Invalid question length:', questionLen);
            return null;
          }
          
          const questionBytes = data.slice(offset, offset + questionLen);
          const question = new TextDecoder('utf-8', { fatal: false }).decode(questionBytes);
          offset += questionLen;

          // Read description string
          const descLen = data.readUInt32LE(offset);
          offset += 4;
          
          if (descLen > 1000) {
            console.log('Invalid description length:', descLen);
            return null;
          }
          
          const descBytes = data.slice(offset, offset + descLen);
          const description = new TextDecoder('utf-8', { fatal: false }).decode(descBytes);
          offset += descLen;

          // Read end_timestamp (i64)
          const endTimestamp = new BN(data.slice(offset, offset + 8), 'le');
          offset += 8;

          // Read resolved (bool)
          const resolved = data[offset] === 1;
          offset += 1;

          // Read winning_side_index (u8)
          const winningSideIndex = data[offset];
          offset += 1;

          // Read total_pool (u64)
          const totalPool = new BN(data.slice(offset, offset + 8), 'le');
          offset += 8;

          // Read num_sides (u8)
          const numSides = data[offset];
          offset += 1;

          if (numSides < 2 || numSides > 10) {
            console.log('Invalid num_sides:', numSides);
            return null;
          }

          // Read sides array (10 sides, each 63 bytes)
          const sides = [];
          const sideNames = [];
          for (let i = 0; i < numSides && i < 10; i++) {
            // name: [u8; 50]
            const nameBytes = Array.from(data.slice(offset, offset + 50));
            offset += 50;

            // name_len: u8
            const nameLen = data[offset];
            offset += 1;

            // total_amount: u64
            const totalAmount = new BN(data.slice(offset, offset + 8), 'le');
            offset += 8;

            // num_bettors: u32
            const numBettors = data.readUInt32LE(offset);
            offset += 4;

            const sideName = decodeSideName(nameBytes, nameLen);
            sideNames.push(sideName);

            sides.push({
              name: nameBytes,
              nameLen,
              totalAmount,
              numBettors,
            });
          }

          // Skip remaining empty sides
          offset += (10 - numSides) * 63;

          // Read fee_pool (u64)
          const feePool = new BN(data.slice(offset, offset + 8), 'le');
          offset += 8;

          // Read creator_fees_distributed (u64)
          const creatorFeesDistributed = new BN(data.slice(offset, offset + 8), 'le');
          offset += 8;

          // Read protocol_fees_distributed (u64)
          const protocolFeesDistributed = new BN(data.slice(offset, offset + 8), 'le');
          offset += 8;

          // Read total_volume (u64)
          const totalVolume = new BN(data.slice(offset, offset + 8), 'le');
          offset += 8;

          // Read num_bettors (u32)
          const numBettors = data.readUInt32LE(offset);
          offset += 4;

          // Read creation_amount (u64)
          const creationAmount = new BN(data.slice(offset, offset + 8), 'le');
          offset += 8;

          // Read bump (u8)
          const bump = data[offset];

          // Calculate prices (% of total pool)
          const totalPoolNum = totalPool.toNumber();
          const sidePrices = sides.map(side => {
            if (totalPoolNum === 0) return 0;
            return (side.totalAmount.toNumber() / totalPoolNum) * 100;
          });

          const market: MarketWithPrices = {
            publicKey: pubkey,
            creator,
            question,
            description,
            endTimestamp,
            resolved,
            winningSideIndex,
            totalPool,
            numSides,
            sides,
            feePool,
            creatorFeesDistributed,
            protocolFeesDistributed,
            totalVolume,
            numBettors,
            creationAmount,
            bump,
            endDate: new Date(endTimestamp.toNumber() * 1000),
            isActive: !resolved && Date.now() < endTimestamp.toNumber() * 1000,
            totalLiquidity: totalPoolNum / LAMPORTS_PER_SOL,
            volume: totalVolume.toNumber() / LAMPORTS_PER_SOL,
            sidePrices,
            sideNames,
          };

          console.log('✅ Successfully parsed market:', {
            question,
            numSides,
            sideNames,
            isActive: market.isActive,
            resolved,
          });

          return market;
        } catch (err) {
          console.error('Error processing account:', pubkey.toString(), err);
          return null;
        }
      });

      const marketsData = await Promise.all(marketPromises);
      const validMarkets = marketsData.filter((m): m is MarketWithPrices => m !== null);
      
      // Filter to only show active markets
      const activeMarkets = validMarkets.filter(market => 
        !market.resolved && market.isActive
      );
      
      console.log('Total markets found:', validMarkets.length);
      console.log('Active markets:', activeMarkets.length);
      
      if (activeMarkets.length === 0 && validMarkets.length > 0) {
        console.log('All markets are either resolved or ended');
      }
      
      setMarkets(activeMarkets);
      
    } catch (error: any) {
      console.error('Error loading markets:', error);
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
            Multi-Side Prediction Markets
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