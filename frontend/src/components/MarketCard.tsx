'use client';

import Link from 'next/link';
import { MarketWithPrice } from '@/types/market';

interface MarketCardProps {
  market: MarketWithPrice;
}

export default function MarketCard({ market }: MarketCardProps) {
  const timeLeft = market.endDate.getTime() - Date.now();
  const daysLeft = Math.floor(timeLeft / (1000 * 60 * 60 * 24));
  const hoursLeft = Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

  return (
    <Link href={`/market/${market.publicKey.toString()}`}>
      <div className="bg-white rounded-lg shadow hover:shadow-xl transition-all cursor-pointer overflow-hidden">
        {/* Header */}
        <div className="p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-2 line-clamp-2">
            {market.question}
          </h3>
          <p className="text-sm text-gray-600 line-clamp-2 mb-4">
            {market.description}
          </p>

          {/* Prices */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="bg-gradient-to-r from-green-400 to-green-600 text-white p-4 rounded-lg">
              <div className="text-xs opacity-90 mb-1">YES</div>
              <div className="text-2xl font-bold">{market.yesPricePercent.toFixed(1)}%</div>
            </div>
            <div className="bg-gradient-to-r from-red-400 to-red-600 text-white p-4 rounded-lg">
              <div className="text-xs opacity-90 mb-1">NO</div>
              <div className="text-2xl font-bold">{market.noPricePercent.toFixed(1)}%</div>
            </div>
          </div>

          {/* Stats */}
          <div className="flex justify-between text-sm text-gray-600 mb-2">
            <span>Volume: {market.volume.toFixed(2)} SOL</span>
            <span>{market.numBettors} traders</span>
          </div>

          {/* Status */}
          <div className="flex justify-between items-center">
            {market.resolved ? (
              <div className="flex items-center text-sm">
                <span className="inline-block w-2 h-2 bg-gray-400 rounded-full mr-2"></span>
                <span className="text-gray-600">
                  Resolved: {market.outcome ? 'YES' : 'NO'}
                </span>
              </div>
            ) : market.isActive ? (
              <div className="flex items-center text-sm">
                <span className="inline-block w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse"></span>
                <span className="text-gray-600">
                  {daysLeft > 0 ? `${daysLeft}d ` : ''}{hoursLeft}h left
                </span>
              </div>
            ) : (
              <div className="flex items-center text-sm">
                <span className="inline-block w-2 h-2 bg-yellow-500 rounded-full mr-2"></span>
                <span className="text-gray-600">Ended</span>
              </div>
            )}

            <span className="text-primary font-semibold text-sm">Trade →</span>
          </div>
        </div>
      </div>
    </Link>
  );
}