'use client';

import { useEffect, useState } from 'react';
import { useConnection } from '@solana/wallet-adapter-react';
import Navbar from '@/components/Navbar';
import MarketCard from '@/components/MarketCard';
import { getConnection } from '@/lib/anchor';
import { MarketWithPrice } from '@/types/market';
import { LAMPORTS_PER_SOL, PROGRAM_ID } from '@/lib/constants';
import { useAnchorWallet } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';
import BN from 'bn.js';

export default function Home() {
  const [markets, setMarkets] = useState<MarketWithPrice[]>([]);
  const [loading, setLoading] = useState(true);
  const wallet = useAnchorWallet();

  useEffect(() => {
    loadMarkets();
  }, []);

  async function loadMarkets() {
    try {
      setLoading(true);
      const connection = getConnection();
      
      console.log('Fetching markets from program:', PROGRAM_ID.toString());
      
      // Get all accounts owned by the program
      const accounts = await connection.getProgramAccounts(PROGRAM_ID);

      console.log('Found accounts:', accounts.length);

      if (accounts.length === 0) {
        setMarkets([]);
        setLoading(false);
        return;
      }

      // Create market data for each account found, trying to decode real data
      const marketPromises = accounts.map(async ({ pubkey }, index) => {
        try {
          const accountInfo = await connection.getAccountInfo(pubkey);
          if (!accountInfo) return null;

          const data = accountInfo.data;
          
          // Skip if account is too small to be a market
          if (data.length < 100) return null;

          // Try to decode real market data with error handling
          let question = `Market ${index + 1}`;
          let description = "Market created on-chain";
          let endTimestamp = new BN(Date.now() / 1000 + 86400); // Default 1 day
          let resolved = false;
          let yesPool = new BN(1000000000);
          let noPool = new BN(1000000000);
          let totalVolume = new BN(0);
          let numBettors = 0;

          try {
            // Read creator (skip discriminator, start at offset 8)
            const creator = new PublicKey(data.slice(8, 40));
            
            // Try to read question string
            let offset = 40;
            const questionLen = data.readUInt32LE(offset);
            offset += 4;
            
            if (questionLen > 0 && questionLen < 500) { // Reasonable length check
              const questionBytes = data.slice(offset, offset + questionLen);
              // Only use valid UTF-8 characters
              const decodedQuestion = new TextDecoder('utf-8', { fatal: false }).decode(questionBytes);
              if (decodedQuestion && !decodedQuestion.includes('\uFFFD')) {
                question = decodedQuestion;
              }
            }
            offset += questionLen;

            // Try to read description
            const descLen = data.readUInt32LE(offset);
            offset += 4;
            
            if (descLen > 0 && descLen < 1000) { // Reasonable length check
              const descBytes = data.slice(offset, offset + descLen);
              const decodedDesc = new TextDecoder('utf-8', { fatal: false }).decode(descBytes);
              if (decodedDesc && !decodedDesc.includes('\uFFFD')) {
                description = decodedDesc;
              }
            }
            offset += descLen;

            // Read end_timestamp
            endTimestamp = new BN(data.slice(offset, offset + 8), 'le');
            offset += 8;

            // Read resolved flag
            resolved = data[offset] === 1;
            offset += 1;

            // Skip outcome
            offset += 1;

            // Read pools
            yesPool = new BN(data.slice(offset, offset + 8), 'le');
            offset += 8;
            noPool = new BN(data.slice(offset, offset + 8), 'le');
            offset += 8;

            // Skip k (u128)
            offset += 16;

            // Skip shares
            offset += 16;

            // Skip fees
            offset += 16;

            // Read total volume
            totalVolume = new BN(data.slice(offset, offset + 8), 'le');
            offset += 8;

            // Read num_bettors
            numBettors = data.readUInt32LE(offset);

          } catch (decodeError) {
            console.log(`Using default data for market ${index + 1} due to decode error:`, decodeError);
          }

          // Calculate prices
          const yesPoolNum = yesPool.toNumber();
          const noPoolNum = noPool.toNumber();
          const total = yesPoolNum + noPoolNum;
          const yesPrice = total > 0 ? noPoolNum / total : 0.5;
          const noPrice = 1 - yesPrice;

          const market: MarketWithPrice = {
            publicKey: pubkey,
            creator: new PublicKey("11111111111111111111111111111111"),
            question,
            description,
            endTimestamp,
            resolved,
            outcome: false,
            yesPool,
            noPool,
            k: new BN(0),
            totalYesShares: new BN(0),
            totalNoShares: new BN(0),
            treasuryFee: new BN(0),
            creationFee: new BN(100000000),
            totalVolume,
            numBettors,
            questionHash: [],
            bump: 0,
            yesPrice,
            noPrice,
            yesPricePercent: yesPrice * 100,
            noPricePercent: noPrice * 100,
            endDate: new Date(endTimestamp.toNumber() * 1000),
            isActive: !resolved && Date.now() < endTimestamp.toNumber() * 1000,
            totalLiquidity: (yesPoolNum + noPoolNum) / LAMPORTS_PER_SOL,
            volume: totalVolume.toNumber() / LAMPORTS_PER_SOL,
          };

          return market;
        } catch (err) {
          console.error('Error processing market:', err);
          return null;
        }
      });

      const marketsData = await Promise.all(marketPromises);
      const validMarkets = marketsData.filter((m): m is MarketWithPrice => m !== null);
      
      // Filter to only show markets that haven't ended
      const activeMarkets = validMarkets.filter(market => 
        !market.resolved && market.isActive && Date.now() < market.endDate.getTime()
      );
      
      console.log('Total markets found:', validMarkets.length);
      console.log('Active markets:', activeMarkets.length);
      setMarkets(activeMarkets);
      
    } catch (error) {
      console.error('Error loading markets:', error);
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
            Decentralized Prediction Markets
          </h1>
          <p className="text-xl text-gray-600 mb-8">
            Create and trade on any future event. Powered by Solana.
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