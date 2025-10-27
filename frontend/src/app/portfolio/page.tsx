'use client';

import { useWallet } from '@solana/wallet-adapter-react';
import Navbar from '@/components/Navbar';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';

export default function PortfolioPage() {
  const { publicKey } = useWallet();

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Your Portfolio</h1>
          <p className="text-lg text-gray-600">Track your positions and earnings</p>
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
        ) : (
          <div className="space-y-6">
            {/* Stats Overview */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="bg-white p-6 rounded-lg shadow">
                <div className="text-sm text-gray-600 mb-1">Total Invested</div>
                <div className="text-2xl font-bold text-gray-900">0.00 SOL</div>
              </div>
              <div className="bg-white p-6 rounded-lg shadow">
                <div className="text-sm text-gray-600 mb-1">Current Value</div>
                <div className="text-2xl font-bold text-gray-900">0.00 SOL</div>
              </div>
              <div className="bg-white p-6 rounded-lg shadow">
                <div className="text-sm text-gray-600 mb-1">Total P&L</div>
                <div className="text-2xl font-bold text-green-600">+0.00 SOL</div>
              </div>
              <div className="bg-white p-6 rounded-lg shadow">
                <div className="text-sm text-gray-600 mb-1">Active Positions</div>
                <div className="text-2xl font-bold text-gray-900">0</div>
              </div>
            </div>

            {/* Positions List */}
            <div className="bg-white rounded-lg shadow">
              <div className="p-6 border-b">
                <h2 className="text-xl font-bold text-gray-900">Your Positions</h2>
              </div>
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
            </div>
          </div>
        )}
      </main>
    </div>
  );
}