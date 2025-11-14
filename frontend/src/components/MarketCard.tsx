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

  // Check if there's a tie at the top
  const maxPercent = Math.max(...market.sidePrices);
  const tiedSides = market.sideNames.filter((_, idx) => 
    Math.abs(market.sidePrices[idx] - maxPercent) < 0.1
  );
  const hasActiveTie = tiedSides.length > 1 && !market.resolved;

  return (
    <Link href={`/market/${market.publicKey.toString()}`}>
      <div className="bg-dark-card rounded-lg shadow hover:shadow-xl transition-all cursor-pointer overflow-hidden border border-dark-border">
        {/* Header */}
        <div className="p-6">
          <h3 className="text-lg font-bold text-dark-text mb-2 line-clamp-2">
            {market.question}
          </h3>
          <p className="text-sm text-dark-muted line-clamp-2 mb-4">
            {market.description}
          </p>

          {/* Leading Side or Tie Information */}
          <div className="mb-4 pb-4 border-b border-dark-border">
            {market.resolved && market.isTie ? (
              <>
                <div className="text-xs text-dark-muted mb-2">RESULT</div>
                <div className="text-lg font-bold text-white mb-1">
                  {market.numWinners}-Way Tie 🏆
                </div>
                <div className="text-sm text-dark-muted">
                  {market.winningNames.slice(0, 2).join(', ')}
                  {market.winningNames.length > 2 && ` +${market.winningNames.length - 2} more`}
                </div>
              </>
            ) : market.resolved ? (
              <>
                <div className="text-xs text-dark-muted mb-2">WINNER</div>
                <div className="text-2xl font-bold text-white mb-1">
                  {market.sideNames[market.winningSideIndex]}
                </div>
                <div className="text-sm text-dark-muted">
                  {market.sidePrices[market.winningSideIndex].toFixed(1)}% of pool
                </div>
              </>
            ) : hasActiveTie ? (
              <>
                <div className="text-xs text-dark-muted mb-2">CURRENTLY TIED</div>
                <div className="text-xl font-bold text-white mb-1">
                  {tiedSides.length} sides tied at {maxPercent.toFixed(1)}%
                </div>
                <div className="text-sm text-dark-muted">
                  {tiedSides.slice(0, 2).join(', ')}
                  {tiedSides.length > 2 && ` +${tiedSides.length - 2}`}
                </div>
              </>
            ) : (
              <>
                <div className="text-xs text-dark-muted mb-2">LEADING</div>
                <div className="text-2xl font-bold text-white mb-1">{leadingSide}</div>
                <div className="text-sm text-dark-muted">{leadingPercent.toFixed(1)}% of pool</div>
              </>
            )}
          </div>

          {/* All Sides Preview */}
          <div className="mb-4">
            <div className="text-xs font-semibold text-dark-text mb-2">
              {market.numSides} Options
            </div>
            <div className="space-y-1">
              {market.sideNames.slice(0, 3).map((name, idx) => {
                const isWinner = market.resolved && market.winningSides[idx];
                return (
                  <div key={idx} className="flex justify-between text-sm">
                    <span className="text-dark-text truncate flex items-center gap-1">
                      {name}
                      {isWinner && <span className="text-xs">🏆</span>}
                    </span>
                    <span className="text-dark-muted">{market.sidePrices[idx].toFixed(1)}%</span>
                  </div>
                );
              })}
              {market.numSides > 3 && (
                <div className="text-xs text-dark-muted">
                  +{market.numSides - 3} more options
                </div>
              )}
            </div>
          </div>

          {/* Stats */}
          <div className="flex justify-between text-sm text-dark-muted mb-2">
            <span>Volume: {market.volume.toFixed(2)} SOL</span>
            <span>{market.numBettors} traders</span>
          </div>

          {/* Status */}
          <div className="flex justify-between items-center">
            {market.resolved ? (
              <div className="flex items-center text-sm">
                <span className="inline-block w-2 h-2 bg-gray-400 rounded-full mr-2"></span>
                <span className="text-dark-muted">
                  {market.isTie 
                    ? `Resolved: ${market.numWinners}-way tie`
                    : `Resolved: ${market.sideNames[market.winningSideIndex]}`
                  }
                </span>
              </div>
            ) : market.isActive ? (
              <div className="flex items-center text-sm">
                <span className="inline-block w-2 h-2 bg-white rounded-full mr-2 animate-pulse"></span>
                <span className="text-dark-muted">
                  {daysLeft > 0 ? `${daysLeft}d ` : ''}{hoursLeft}h left
                  {hasActiveTie && ' • Tied'}
                </span>
              </div>
            ) : (
              <div className="flex items-center text-sm">
                <span className="inline-block w-2 h-2 bg-gray-500 rounded-full mr-2"></span>
                <span className="text-dark-muted">Ended</span>
              </div>
            )}

            <span className="text-white font-semibold text-sm">Trade →</span>
          </div>
        </div>
      </div>
    </Link>
  );
}