'use client';

import Link from 'next/link';
import { MarketWithPrices } from '@/types/market';

interface MarketCardProps {
  market: MarketWithPrices;
}

export default function MarketCard({ market }: MarketCardProps) {
  const timeLeft = market.endDate.getTime() - Date.now();
  const daysLeft = Math.floor(timeLeft / (1000 * 60 * 60 * 24));
  const hoursLeft = Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

  // Find the leading side
  const leadingSideIndex = market.sidePrices.indexOf(Math.max(...market.sidePrices));
  const leadingSide = market.sideNames[leadingSideIndex];
  const leadingPercent = market.sidePrices[leadingSideIndex];

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

          {/* Leading Side */}
          <div className="bg-gradient-to-r from-green-400 to-green-600 text-white p-4 rounded-lg mb-4">
            <div className="text-xs opacity-90 mb-1">Currently Leading</div>
            <div className="text-xl font-bold">{leadingSide}</div>
            <div className="text-sm opacity-75">{leadingPercent.toFixed(1)}% of pool</div>
          </div>

          {/* All Sides Preview */}
          <div className="mb-4">
            <div className="text-xs font-semibold text-gray-700 mb-2">
              {market.numSides} Options
            </div>
            <div className="space-y-1">
              {market.sideNames.slice(0, 3).map((name, idx) => (
                <div key={idx} className="flex justify-between text-sm">
                  <span className="text-gray-700 truncate">{name}</span>
                  <span className="text-gray-500">{market.sidePrices[idx].toFixed(1)}%</span>
                </div>
              ))}
              {market.numSides > 3 && (
                <div className="text-xs text-gray-500">
                  +{market.numSides - 3} more options
                </div>
              )}
            </div>
          </div>

          {/* Stats */}
          <div className="flex justify-between text-sm text-gray-600 mb-2">
            <span>Volume: {market.volume.toFixed(2)} USDC</span>
            <span>{market.numBettors} traders</span>
          </div>

          {/* Status */}
          <div className="flex justify-between items-center">
            {market.resolved ? (
              <div className="flex items-center text-sm">
                <span className="inline-block w-2 h-2 bg-gray-400 rounded-full mr-2"></span>
                <span className="text-gray-600">
                  Resolved: {market.sideNames[market.winningSideIndex]}
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