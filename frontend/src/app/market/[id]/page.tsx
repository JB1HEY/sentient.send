'use client';

import { useEffect, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useProgram } from '@/hooks/useProgram';
import { getPositionPda } from '@/lib/anchor';
import { SystemProgram, PublicKey } from '@solana/web3.js';
import BN from 'bn.js';
import { LAMPORTS_PER_SOL } from '@/lib/constants';
import Navbar from '@/components/Navbar';
import { useParams } from 'next/navigation';
import { getConnection } from '@/lib/anchor';
import { MarketWithPrice } from '@/types/market';

export default function MarketDetailPage() {
    const params = useParams();
    const marketId = params?.id as string;
    const { publicKey } = useWallet();
    const program = useProgram();

    const [market, setMarket] = useState<MarketWithPrice | null>(null);
    const [position, setPosition] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [betAmount, setBetAmount] = useState('0.1');
    const [betSide, setBetSide] = useState<'YES' | 'NO'>('YES');
    const [txLoading, setTxLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    useEffect(() => {
        if (marketId) {
            loadMarket();
        }
    }, [marketId, publicKey]);

    async function loadMarket() {
        try {
            setLoading(true);
            const connection = getConnection();
            const marketPubkey = new PublicKey(marketId);

            const accountInfo = await connection.getAccountInfo(marketPubkey);
            if (!accountInfo) {
                setError('Market not found');
                setLoading(false);
                return;
            }

            // Fetch market data
            if (program) {
                const marketData = await (program.account as any).market.fetch(marketPubkey);

                // Calculate prices
                const yesPoolNum = marketData.yesPool.toNumber();
                const noPoolNum = marketData.noPool.toNumber();
                const total = yesPoolNum + noPoolNum;
                const yesPrice = total > 0 ? noPoolNum / total : 0.5;
                const noPrice = 1 - yesPrice;

                const marketWithPrice: MarketWithPrice = {
                    publicKey: marketPubkey,
                    creator: marketData.creator,
                    question: marketData.question,
                    description: marketData.description,
                    endTimestamp: marketData.endTimestamp,
                    resolved: marketData.resolved,
                    outcome: marketData.outcome,
                    yesPool: marketData.yesPool,
                    noPool: marketData.noPool,
                    k: marketData.k,
                    totalYesShares: marketData.totalYesShares,
                    totalNoShares: marketData.totalNoShares,
                    treasuryFee: marketData.treasuryFee,
                    creationFee: marketData.creationFee,
                    totalVolume: marketData.totalVolume,
                    numBettors: marketData.numBettors,
                    questionHash: marketData.questionHash,
                    bump: marketData.bump,
                    yesPrice,
                    noPrice,
                    yesPricePercent: yesPrice * 100,
                    noPricePercent: noPrice * 100,
                    endDate: new Date(marketData.endTimestamp.toNumber() * 1000),
                    isActive: Date.now() < marketData.endTimestamp.toNumber() * 1000,
                    totalLiquidity: (yesPoolNum + noPoolNum) / LAMPORTS_PER_SOL,
                    volume: marketData.totalVolume.toNumber() / LAMPORTS_PER_SOL,
                };

                setMarket(marketWithPrice);

                // Load user position if connected
                if (publicKey && program) {
                    try {
                        const positionPda = getPositionPda(marketPubkey, publicKey);
                        const positionData = await (program.account as any).userPosition.fetch(positionPda);
                        setPosition(positionData);
                    } catch (err) {
                        console.log('No position found for user');
                        setPosition(null);
                    }
                }
            }
        } catch (err) {
            console.error('Error loading market:', err);
            setError('Failed to load market');
        } finally {
            setLoading(false);
        }
    }

    async function handlePlaceBet() {
        if (!publicKey || !program || !market) {
            setError('Please connect your wallet');
            return;
        }

        const amount = parseFloat(betAmount);
        if (amount < 0.01) {
            setError('Minimum bet is 0.01 SOL');
            return;
        }

        try {
            setTxLoading(true);
            setError('');
            setSuccess('');

            const amountLamports = new BN(amount * LAMPORTS_PER_SOL);
            const positionPda = getPositionPda(market.publicKey, publicKey);

            const tx = await program.methods
                .placeBet(amountLamports, betSide === 'YES')
                .accounts({
                    market: market.publicKey,
                    position: positionPda,
                    user: publicKey,
                    systemProgram: SystemProgram.programId,
                })
                .rpc();

            setSuccess(`Bet placed successfully! Transaction: ${tx.slice(0, 8)}...`);

            // Reload market and position
            await loadMarket();
            setBetAmount('0.1');
        } catch (err: any) {
            console.error('Error placing bet:', err);
            setError(err.message || 'Failed to place bet');
        } finally {
            setTxLoading(false);
        }
    }

    async function handleClaim() {
        if (!publicKey || !program || !market || !position) {
            setError('Cannot claim');
            return;
        }

        try {
            setTxLoading(true);
            setError('');
            setSuccess('');

            const positionPda = getPositionPda(market.publicKey, publicKey);

            const tx = await program.methods
                .claimWinnings()
                .accounts({
                    market: market.publicKey,
                    position: positionPda,
                    user: publicKey,
                    systemProgram: SystemProgram.programId,
                })
                .rpc();

            setSuccess(`Winnings claimed! Transaction: ${tx.slice(0, 8)}...`);
            await loadMarket();
        } catch (err: any) {
            console.error('Error claiming:', err);
            setError(err.message || 'Failed to claim winnings');
        } finally {
            setTxLoading(false);
        }
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50">
                <Navbar />
                <div className="flex items-center justify-center h-screen">
                    <div className="text-center">
                        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
                        <p className="mt-4 text-gray-600">Loading market...</p>
                    </div>
                </div>
            </div>
        );
    }

    if (!market) {
        return (
            <div className="min-h-screen bg-gray-50">
                <Navbar />
                <div className="max-w-7xl mx-auto px-4 py-12">
                    <div className="text-center">
                        <h1 className="text-2xl font-bold text-gray-900 mb-4">Market Not Found</h1>
                        <a href="/" className="text-primary hover:underline">← Back to Markets</a>
                    </div>
                </div>
            </div>
        );
    }

    const timeLeft = market.endDate.getTime() - Date.now();
    const daysLeft = Math.floor(timeLeft / (1000 * 60 * 60 * 24));
    const hoursLeft = Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutesLeft = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));

    // Calculate estimated payout for current position
    const estimatedPayout = position ? (() => {
        const yesShares = position.yesShares.toNumber();
        const noShares = position.noShares.toNumber();

        if (market.totalYesShares.toNumber() === 0 || market.totalNoShares.toNumber() === 0) {
            return 0;
        }

        const yesPayout = (yesShares / market.totalYesShares.toNumber()) * market.yesPool.toNumber();
        const noPayout = (noShares / market.totalNoShares.toNumber()) * market.noPool.toNumber();

        return (yesPayout + noPayout) / LAMPORTS_PER_SOL;
    })() : 0;

    return (
        <div className="min-h-screen bg-gray-50">
            <Navbar />

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                {/* Back Button */}
                <a href="/" className="text-primary hover:underline mb-6 inline-block">
                    ← Back to Markets
                </a>

                {/* Market Header */}
                <div className="bg-white rounded-lg shadow-lg p-8 mb-6">
                    <div className="flex justify-between items-start mb-6">
                        <div className="flex-1">
                            <h1 className="text-3xl font-bold text-gray-900 mb-2">
                                {market.question}
                            </h1>
                            <p className="text-gray-600 mb-4">{market.description}</p>

                            {/* Status Badge */}
                            <div className="flex items-center space-x-4">
                                {market.isActive ? (
                                    <div className="flex items-center text-sm">
                                        <span className="inline-block w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse"></span>
                                        <span className="text-gray-600">
                                            Active • {daysLeft > 0 && `${daysLeft}d `}{hoursLeft}h {minutesLeft}m left
                                        </span>
                                    </div>
                                ) : (
                                    <div className="flex items-center text-sm">
                                        <span className="inline-block w-2 h-2 bg-yellow-500 rounded-full mr-2"></span>
                                        <span className="text-gray-600">Market Ended</span>
                                    </div>
                                )}

                                <span className="text-sm text-gray-500">
                                    {market.numBettors} traders
                                </span>
                                <span className="text-sm text-gray-500">
                                    {market.volume.toFixed(2)} SOL volume
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Price Display */}
                    <div className="grid grid-cols-2 gap-6 mb-6">
                        <div className="bg-gradient-to-r from-green-400 to-green-600 text-white p-6 rounded-lg">
                            <div className="text-sm opacity-90 mb-2">YES Price</div>
                            <div className="text-4xl font-bold">{market.yesPricePercent.toFixed(1)}%</div>
                            <div className="text-sm opacity-75 mt-2">
                                Pool: {(market.yesPool.toNumber() / LAMPORTS_PER_SOL).toFixed(2)} SOL
                            </div>
                        </div>
                        <div className="bg-gradient-to-r from-red-400 to-red-600 text-white p-6 rounded-lg">
                            <div className="text-sm opacity-90 mb-2">NO Price</div>
                            <div className="text-4xl font-bold">{market.noPricePercent.toFixed(1)}%</div>
                            <div className="text-sm opacity-75 mt-2">
                                Pool: {(market.noPool.toNumber() / LAMPORTS_PER_SOL).toFixed(2)} SOL
                            </div>
                        </div>
                    </div>

                    {/* Sentiment-Based Info */}
                    <div className="bg-blue-50 border-l-4 border-blue-500 p-4">
                        <div className="flex">
                            <div className="flex-shrink-0">
                                <svg className="h-5 w-5 text-blue-500" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                                </svg>
                            </div>
                            <div className="ml-3">
                                <p className="text-sm text-blue-700">
                                    <strong>Sentiment-Based Market:</strong> This market uses proportional payouts. Everyone gets paid based on their share of their pool when the market ends. The side with more sentiment (larger pool) gets more per share. No manual resolution needed!
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Trading Panel */}
                    <div className="lg:col-span-2">
                        <div className="bg-white rounded-lg shadow-lg p-6">
                            <h2 className="text-2xl font-bold mb-6">Place Your Bet</h2>

                            {market.isActive ? (
                                <>
                                    {/* Bet Side Selection */}
                                    <div className="grid grid-cols-2 gap-4 mb-6">
                                        <button
                                            onClick={() => setBetSide('YES')}
                                            className={`p-4 rounded-lg border-2 transition ${betSide === 'YES'
                                                    ? 'border-green-500 bg-green-50'
                                                    : 'border-gray-200 hover:border-green-300'
                                                }`}
                                        >
                                            <div className="text-lg font-bold text-green-600">YES</div>
                                            <div className="text-sm text-gray-600">{market.yesPricePercent.toFixed(1)}%</div>
                                        </button>
                                        <button
                                            onClick={() => setBetSide('NO')}
                                            className={`p-4 rounded-lg border-2 transition ${betSide === 'NO'
                                                    ? 'border-red-500 bg-red-50'
                                                    : 'border-gray-200 hover:border-red-300'
                                                }`}
                                        >
                                            <div className="text-lg font-bold text-red-600">NO</div>
                                            <div className="text-sm text-gray-600">{market.noPricePercent.toFixed(1)}%</div>
                                        </button>
                                    </div>

                                    {/* Amount Input */}
                                    <div className="mb-6">
                                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                                            Bet Amount (SOL)
                                        </label>
                                        <input
                                            type="number"
                                            value={betAmount}
                                            onChange={(e) => setBetAmount(e.target.value)}
                                            min="0.01"
                                            step="0.01"
                                            className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-primary focus:outline-none transition"
                                            placeholder="0.1"
                                        />
                                        <div className="flex justify-between mt-2 text-sm text-gray-600">
                                            <span>Minimum: 0.01 SOL</span>
                                            <span>2% platform fee</span>
                                        </div>
                                    </div>

                                    {/* Quick Amount Buttons */}
                                    <div className="grid grid-cols-4 gap-2 mb-6">
                                        {['0.1', '0.5', '1', '5'].map((amount) => (
                                            <button
                                                key={amount}
                                                onClick={() => setBetAmount(amount)}
                                                className="px-4 py-2 border-2 border-gray-200 rounded-lg hover:border-primary transition text-sm font-medium"
                                            >
                                                {amount} SOL
                                            </button>
                                        ))}
                                    </div>

                                    {/* Error/Success Messages */}
                                    {error && (
                                        <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-4">
                                            <p className="text-sm text-red-700">{error}</p>
                                        </div>
                                    )}

                                    {success && (
                                        <div className="bg-green-50 border-l-4 border-green-500 p-4 mb-4">
                                            <p className="text-sm text-green-700">{success}</p>
                                        </div>
                                    )}

                                    {/* Place Bet Button */}
                                    <button
                                        onClick={handlePlaceBet}
                                        disabled={txLoading || !publicKey}
                                        className={`w-full py-4 rounded-lg font-bold text-lg transition ${betSide === 'YES'
                                                ? 'bg-gradient-to-r from-green-400 to-green-600 hover:opacity-90'
                                                : 'bg-gradient-to-r from-red-400 to-red-600 hover:opacity-90'
                                            } text-white disabled:opacity-50 disabled:cursor-not-allowed`}
                                    >
                                        {txLoading ? (
                                            <span className="flex items-center justify-center">
                                                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                </svg>
                                                Processing...
                                            </span>
                                        ) : !publicKey ? (
                                            'Connect Wallet to Bet'
                                        ) : (
                                            `Bet ${betAmount} SOL on ${betSide}`
                                        )}
                                    </button>
                                </>
                            ) : (
                                <div className="text-center py-8">
                                    <div className="text-4xl mb-4">⏰</div>
                                    <h3 className="text-xl font-bold text-gray-900 mb-2">Trading Closed</h3>
                                    <p className="text-gray-600 mb-4">This market has ended. Claim your proportional payout below.</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Position Panel */}
                    <div className="space-y-6">
                        {/* Your Position */}
                        {position && (
                            <div className="bg-white rounded-lg shadow-lg p-6">
                                <h3 className="text-xl font-bold mb-4">Your Position</h3>

                                <div className="space-y-3 mb-4">
                                    <div className="flex justify-between items-center">
                                        <span className="text-gray-600">YES Shares</span>
                                        <span className="font-semibold">{position.yesShares.toNumber()}</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-gray-600">NO Shares</span>
                                        <span className="font-semibold">{position.noShares.toNumber()}</span>
                                    </div>
                                    <div className="border-t pt-3 flex justify-between items-center">
                                        <span className="text-gray-600">Invested</span>
                                        <span className="font-semibold">
                                            {(position.amountInvested.toNumber() / LAMPORTS_PER_SOL).toFixed(4)} SOL
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-gray-600">Est. Payout</span>
                                        <span className="font-bold text-primary">
                                            {estimatedPayout.toFixed(4)} SOL
                                        </span>
                                    </div>
                                </div>

                                {!market.isActive && !position.claimed && (
                                    <button
                                        onClick={handleClaim}
                                        disabled={txLoading}
                                        className="w-full bg-gradient-main text-white py-3 rounded-lg font-semibold hover:opacity-90 transition disabled:opacity-50"
                                    >
                                        {txLoading ? 'Claiming...' : 'Claim Winnings'}
                                    </button>
                                )}

                                {position.claimed && (
                                    <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
                                        <span className="text-green-700 font-semibold">✓ Claimed</span>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Market Stats */}
                        <div className="bg-white rounded-lg shadow-lg p-6">
                            <h3 className="text-xl font-bold mb-4">Market Stats</h3>

                            <div className="space-y-3">
                                <div className="flex justify-between items-center">
                                    <span className="text-gray-600">Total Liquidity</span>
                                    <span className="font-semibold">{market.totalLiquidity.toFixed(2)} SOL</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-gray-600">Total Volume</span>
                                    <span className="font-semibold">{market.volume.toFixed(2)} SOL</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-gray-600">Total Traders</span>
                                    <span className="font-semibold">{market.numBettors}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-gray-600">YES Shares</span>
                                    <span className="font-semibold">{market.totalYesShares.toNumber()}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-gray-600">NO Shares</span>
                                    <span className="font-semibold">{market.totalNoShares.toNumber()}</span>
                                </div>
                                <div className="border-t pt-3 flex justify-between items-center">
                                    <span className="text-gray-600">Ends</span>
                                    <span className="font-semibold text-sm">
                                        {market.endDate.toLocaleDateString()} {market.endDate.toLocaleTimeString()}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* How It Works */}
                        <div className="bg-gradient-main text-white rounded-lg shadow-lg p-6">
                            <h3 className="text-lg font-bold mb-3">💡 How Payouts Work</h3>
                            <ul className="space-y-2 text-sm">
                                <li>• Everyone gets paid based on their share</li>
                                <li>• Larger pool = more per share</li>
                                <li>• No one loses everything</li>
                                <li>• No manual resolution needed</li>
                            </ul>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}