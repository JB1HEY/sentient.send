'use client';

import { useEffect, useState } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { useProgram } from '@/hooks/useProgram';
import { getPositionPda, getTreasuryPda } from '@/lib/anchor';
import { PublicKey } from '@solana/web3.js';
import BN from 'bn.js';
import {
    MIN_BET_SOL,
    MAX_BET_SOL,
    LAMPORTS_PER_SOL,
    BET_FEE_BPS,
    PROTOCOL_AUTHORITY
} from '@/lib/constants';
import Navbar from '@/components/Navbar';
import { useParams } from 'next/navigation';
import { MarketWithPrices, UserPosition } from '@/types/market';
import { IDL } from '@/lib/idl';

export default function MarketDetailPage() {
    const params = useParams();
    const marketId = params?.id as string;
    const { publicKey } = useWallet();
    const { connection } = useConnection();
    const program = useProgram();

    const [market, setMarket] = useState<MarketWithPrices | null>(null);
    const [position, setPosition] = useState<UserPosition | null>(null);
    const [loading, setLoading] = useState(true);
    const [betAmount, setBetAmount] = useState('0.1');
    const [selectedSide, setSelectedSide] = useState<number>(0);
    const [txLoading, setTxLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [isCreator, setIsCreator] = useState(false);

    useEffect(() => {
        if (marketId) {
            loadMarket();
        }
    }, [marketId, publicKey, connection]);

    async function loadMarket() {
        try {
            setLoading(true);
            
            // Create a program instance (with or without wallet)
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

            const marketPubkey = new PublicKey(marketId);
            console.log('Loading market:', marketPubkey.toString());

            // Fetch market using Anchor
            // @ts-ignore
            const marketAccount = await programToUse.account.market.fetch(marketPubkey);

            if (!marketAccount) {
                setError('Market not found');
                setLoading(false);
                return;
            }

            const market = marketAccount as any;

            // Check if current user is creator
            if (publicKey) {
                setIsCreator(market.creator.toString() === publicKey.toString());
            }

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

            const marketWithPrice: MarketWithPrices = {
                publicKey: marketPubkey,
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

            setMarket(marketWithPrice);

            // Load user position if wallet connected
            if (publicKey && programToUse) {
                try {
                    const { positionPda } = getPositionPda(marketPubkey, publicKey);
                    // @ts-ignore
                    const positionData = await programToUse.account.userPosition.fetch(positionPda);
                    setPosition(positionData as any);
                } catch (err) {
                    // Position doesn't exist yet - that's ok
                    setPosition(null);
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
        if (amount < MIN_BET_SOL) {
            setError(`Minimum bet is ${MIN_BET_SOL} SOL`);
            return;
        }

        if (amount > MAX_BET_SOL) {
            setError(`Maximum bet is ${MAX_BET_SOL} SOL`);
            return;
        }

        try {
            setTxLoading(true);
            setError('');
            setSuccess('');

            const amountLamports = new BN(amount * LAMPORTS_PER_SOL);
            const { positionPda } = getPositionPda(market.publicKey, publicKey);

            console.log('Placing bet:', {
                market: market.publicKey.toString(),
                position: positionPda.toString(),
                sideIndex: selectedSide,
                amount: amount + ' SOL',
                lamports: amountLamports.toString(),
            });

            const tx = await program.methods
                .placeBet(selectedSide, amountLamports)
                .accounts({
                    market: market.publicKey,
                    position: positionPda,
                    user: publicKey,
                    systemProgram: PublicKey.default,
                })
                .rpc();

            setSuccess(`Bet placed successfully! Transaction: ${tx.slice(0, 8)}...`);

            // Reload market data
            await new Promise(resolve => setTimeout(resolve, 2000));
            await loadMarket();

            setBetAmount('0.1');
        } catch (err: any) {
            console.error('Error placing bet:', err);

            let errorMessage = 'Failed to place bet';
            if (err.message) {
                if (err.message.includes('insufficient')) {
                    errorMessage = 'Insufficient SOL balance';
                } else if (err.message.includes('MarketEnded')) {
                    errorMessage = 'Market has ended';
                } else if (err.message.includes('BetTooSmall')) {
                    errorMessage = `Minimum bet is ${MIN_BET_SOL} SOL`;
                } else if (err.message.includes('BetTooLarge')) {
                    errorMessage = `Maximum bet is ${MAX_BET_SOL} SOL`;
                } else {
                    errorMessage = err.message;
                }
            }

            setError(errorMessage);
        } finally {
            setTxLoading(false);
        }
    }

    async function handleClaimWinnings() {
        if (!publicKey || !program || !market || !position) {
            setError('Cannot claim');
            return;
        }

        try {
            setTxLoading(true);
            setError('');
            setSuccess('');

            const { positionPda } = getPositionPda(market.publicKey, publicKey);

            console.log('Claiming winnings:', {
                market: market.publicKey.toString(),
                position: positionPda.toString(),
            });

            const tx = await program.methods
                .claimWinnings()
                .accounts({
                    market: market.publicKey,
                    position: positionPda,
                    user: publicKey,
                })
                .rpc({
                    skipPreflight: true,
                    commitment: 'confirmed',
                    maxRetries: 3,
                });

            setSuccess(`Winnings claimed! Transaction: ${tx.slice(0, 8)}...`);

            // Reload market data
            await new Promise(resolve => setTimeout(resolve, 2000));
            await loadMarket();
        } catch (err: any) {
            console.error('Error claiming:', err);

            let errorMessage = 'Failed to claim winnings';
            if (err.message) {
                if (err.message.includes('NoWinnings')) {
                    errorMessage = 'You have no winnings to claim (you may have bet on the losing side)';
                } else if (err.message.includes('AlreadyClaimed')) {
                    errorMessage = 'You have already claimed your winnings';
                } else if (err.message.includes('MarketNotEnded')) {
                    errorMessage = 'Market has not ended yet';
                } else {
                    errorMessage = err.message;
                }
            }

            setError(errorMessage);
        } finally {
            setTxLoading(false);
        }
    }

    async function handleResolveMarket() {
        if (!publicKey || !program || !market) {
            setError('Please connect your wallet');
            return;
        }

        try {
            setTxLoading(true);
            setError('');
            setSuccess('');

            console.log('Resolving market:', market.publicKey.toString());

            // Call the new resolve_market instruction
            const tx = await program.methods
                .resolveMarket()
                .accounts({
                    market: market.publicKey,
                    resolver: publicKey,
                })
                .rpc();

            setSuccess(`Market resolved! Transaction: ${tx.slice(0, 8)}...`);

            // Reload market data
            await new Promise(resolve => setTimeout(resolve, 2000));
            await loadMarket();
        } catch (err: any) {
            console.error('Error resolving:', err);

            let errorMessage = 'Failed to resolve market';
            if (err.message) {
                if (err.message.includes('MarketNotEnded')) {
                    errorMessage = 'Market has not ended yet';
                } else {
                    errorMessage = err.message;
                }
            }
            setError(errorMessage);
        } finally {
            setTxLoading(false);
        }
    }

    async function handleClaimCreatorFees() {
        if (!publicKey || !program || !market) {
            setError('Cannot claim fees');
            return;
        }

        try {
            setTxLoading(true);
            setError('');
            setSuccess('');

            const { treasuryPda } = getTreasuryPda();

            console.log('Claiming creator fees:', {
                market: market.publicKey.toString(),
                treasury: treasuryPda.toString(),
                protocolAuthority: PROTOCOL_AUTHORITY.toString(),
            });

            const tx = await program.methods
                .claimCreatorFees()
                .accounts({
                    market: market.publicKey,
                    treasury: treasuryPda,
                    creator: publicKey,
                    protocolAuthority: PROTOCOL_AUTHORITY,
                })
                .rpc({
                    skipPreflight: true,
                    commitment: 'confirmed',
                    maxRetries: 3,
                });

            setSuccess(`Creator fees claimed! Transaction: ${tx.slice(0, 8)}...`);

            // Reload market data
            await new Promise(resolve => setTimeout(resolve, 2000));
            await loadMarket();
        } catch (err: any) {
            console.error('Error claiming creator fees:', err);

            let errorMessage = 'Failed to claim creator fees';
            if (err.message) {
                if (err.message.includes('MarketNotEnded')) {
                    errorMessage = 'Market has not ended yet';
                } else if (err.message.includes('NoFeesToClaim')) {
                    errorMessage = 'No fees available to claim';
                } else if (err.message.includes('FeesAlreadyClaimed')) {
                    errorMessage = 'Fees already claimed';
                } else if (err.message.includes('UnauthorizedCreator')) {
                    errorMessage = 'Only the market creator can claim fees';
                } else {
                    errorMessage = err.message;
                }
            }

            setError(errorMessage);
        } finally {
            setTxLoading(false);
        }
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-dark-bg">
                <Navbar />
                <div className="flex items-center justify-center h-screen">
                    <div className="text-center">
                        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
                        <p className="mt-4 text-dark-muted">Loading market...</p>
                    </div>
                </div>
            </div>
        );
    }

    if (!market) {
        return (
            <div className="min-h-screen bg-dark-bg">
                <Navbar />
                <div className="max-w-7xl mx-auto px-4 py-12">
                    <div className="text-center">
                        <h1 className="text-2xl font-bold text-white mb-4">Market Not Found</h1>
                        <p className="text-dark-muted mb-4">This market doesn't exist or failed to load.</p>
                        <a href="/" className="text-white hover:underline">← Back to Markets</a>
                    </div>
                </div>
            </div>
        );
    }

    const timeLeft = market.endDate.getTime() - Date.now();
    const daysLeft = Math.floor(timeLeft / (1000 * 60 * 60 * 24));
    const hoursLeft = Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutesLeft = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));

    const estimatedPayout = position && market.resolved ? (() => {
        const userBet = position.bets[market.winningSideIndex];
        if (!userBet || userBet.amount.toNumber() === 0) return 0;
        const winningSide = market.sides[market.winningSideIndex];
        if (winningSide.totalAmount.toNumber() === 0) return 0;
        return ((userBet.amount.toNumber() / winningSide.totalAmount.toNumber()) * market.totalPool.toNumber()) / LAMPORTS_PER_SOL;
    })() : 0;

    const creatorFeesAvailable = market.feePool.toNumber() / 2 - market.creatorFeesDistributed.toNumber();
    const hasClaimableCreatorFees = isCreator && market.resolved && creatorFeesAvailable > 0;

    const leadingSideIndex = market.sidePrices.indexOf(Math.max(...market.sidePrices));

    return (
        <div className="min-h-screen bg-dark-bg">
            <Navbar />
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                <a href="/" className="text-white hover:underline mb-6 inline-block">← Back to Markets</a>

                {/* Creator Badge */}
                {isCreator && (
                    <div className="bg-white text-black rounded-lg shadow-lg p-4 mb-6">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center">
                                <span className="text-2xl mr-3">🎯</span>
                                <div>
                                    <h3 className="font-bold text-lg">You Created This Market</h3>
                                    <p className="text-sm opacity-75">You earn 50% of all trading fees</p>
                                </div>
                            </div>
                            <div className="text-right">
                                <div className="text-sm opacity-75">Total Fees</div>
                                <div className="text-2xl font-bold">
                                    {(market.feePool.toNumber() / LAMPORTS_PER_SOL).toFixed(4)} SOL
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Error/Success Messages */}
                {error && (
                    <div className="bg-red-900/20 border-l-4 border-red-500 p-4 mb-6">
                        <p className="text-sm text-red-400">{error}</p>
                    </div>
                )}
                {success && (
                    <div className="bg-white/10 border-l-4 border-white p-4 mb-6">
                        <p className="text-sm text-white">{success}</p>
                    </div>
                )}

                {/* Market Header */}
                <div className="bg-dark-card rounded-lg shadow-lg p-8 mb-6 border border-dark-border">
                    <div className="flex justify-between items-start mb-6">
                        <div className="flex-1">
                            <h1 className="text-3xl font-bold text-white mb-2">{market.question}</h1>
                            {market.description && (
                                <p className="text-dark-muted mb-4">{market.description}</p>
                            )}
                            <div className="flex items-center space-x-4">
                                {market.isActive ? (
                                    <div className="flex items-center text-sm">
                                        <span className="inline-block w-2 h-2 bg-white rounded-full mr-2 animate-pulse"></span>
                                        <span className="text-dark-muted">
                                            Active • {daysLeft > 0 && `${daysLeft}d `}{hoursLeft}h {minutesLeft}m left
                                        </span>
                                    </div>
                                ) : market.resolved ? (
                                    <div className="flex items-center text-sm">
                                        <span className="inline-block w-2 h-2 bg-dark-muted rounded-full mr-2"></span>
                                        <span className="text-dark-muted">
                                            Resolved - Winner: {market.sideNames[market.winningSideIndex]}
                                        </span>
                                    </div>
                                ) : (
                                    <div className="flex items-center text-sm">
                                        <span className="inline-block w-2 h-2 bg-dark-muted rounded-full mr-2"></span>
                                        <span className="text-dark-muted">Market Ended (Awaiting Resolution)</span>
                                    </div>
                                )}
                                <span className="text-sm text-dark-muted">{market.numBettors} traders</span>
                                <span className="text-sm text-dark-muted">{market.volume.toFixed(2)} SOL volume</span>
                            </div>
                        </div>
                    </div>

                    {/* Sides Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                        {market.sideNames.map((name, idx) => {
                            const side = market.sides[idx];
                            const isLeading = idx === leadingSideIndex;
                            const isWinner = market.resolved && idx === market.winningSideIndex;
                            return (
                                <div
                                    key={idx}
                                    className={`p-4 rounded-lg border-2 ${isWinner
                                        ? 'border-white bg-white/10'
                                        : isLeading
                                            ? 'border-white bg-white/5'
                                            : 'border-dark-border bg-dark-bg'
                                        }`}
                                >
                                    <div className="flex justify-between items-start mb-2">
                                        <div className="font-semibold text-white">{name}</div>
                                        {isLeading && !market.resolved && (
                                            <span className="text-xs bg-white text-black px-2 py-1 rounded">Leading</span>
                                        )}
                                        {isWinner && (
                                            <span className="text-xs bg-white text-black px-2 py-1 rounded">Winner 🏆</span>
                                        )}
                                    </div>
                                    <div className="text-2xl font-bold text-white mb-1">
                                        {market.sidePrices[idx].toFixed(1)}%
                                    </div>
                                    <div className="text-sm text-dark-muted">
                                        {(side.totalAmount.toNumber() / LAMPORTS_PER_SOL).toFixed(2)} SOL
                                    </div>
                                    <div className="text-xs text-dark-muted mt-1">
                                        {side.numBettors} traders
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Info Box */}
                    <div className="bg-white/5 border-l-4 border-white p-4">
                        <div className="flex items-start gap-1.5">
                            <p className="text-sm text-white leading-tight">
                                <strong>Winner Takes All:</strong> When this market ends, the side with the most SOL wins.
                                Winners split the entire {market.totalLiquidity.toFixed(2)} SOL pool proportionally. Losers get nothing.
                            </p>
                        </div>
                    </div>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Left: Betting Interface or Claiming */}
                    <div className="lg:col-span-2">
                        <div className="bg-dark-card rounded-lg shadow-lg p-6 border border-dark-border">
                            {market.isActive ? (
                                <>
                                    <h2 className="text-2xl font-bold mb-6 text-white">Place Your Bet</h2>

                                    {/* Select Side */}
                                    <div className="mb-6">
                                        <label className="block text-sm font-semibold text-white mb-3">
                                            Select Option
                                        </label>
                                        <div className="grid grid-cols-1 gap-2">
                                            {market.sideNames.map((name, idx) => (
                                                <button
                                                    key={idx}
                                                    onClick={() => setSelectedSide(idx)}
                                                    className={`p-4 rounded-lg border-2 transition text-left ${selectedSide === idx
                                                        ? 'border-white bg-white/10'
                                                        : 'border-dark-border hover:border-white'
                                                        }`}
                                                >
                                                    <div className="flex justify-between items-center">
                                                        <div>
                                                            <div className="font-bold text-white">{name}</div>
                                                            <div className="text-sm text-dark-muted">
                                                                {market.sidePrices[idx].toFixed(1)}% of pool
                                                            </div>
                                                        </div>
                                                        {idx === leadingSideIndex && (
                                                            <span className="text-xs bg-white text-black px-2 py-1 rounded">
                                                                Leading
                                                            </span>
                                                        )}
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Bet Amount */}
                                    <div className="mb-6">
                                        <label className="block text-sm font-semibold text-white mb-2">
                                            Bet Amount (SOL)
                                        </label>
                                        <input
                                            type="number"
                                            value={betAmount}
                                            onChange={(e) => setBetAmount(e.target.value)}
                                            min={MIN_BET_SOL}
                                            max={MAX_BET_SOL}
                                            step="0.01"
                                            className="w-full px-4 py-3 border-2 border-dark-border bg-dark-bg text-white rounded-lg focus:border-white focus:outline-none transition"
                                            placeholder="0.1"
                                        />
                                        <div className="flex justify-between mt-2 text-sm text-dark-muted">
                                            <span>Min: {MIN_BET_SOL} SOL</span>
                                            <span>Max: {MAX_BET_SOL} SOL</span>
                                        </div>
                                        <div className="text-xs text-dark-muted mt-1">
                                            2% fee: {((parseFloat(betAmount) || 0) * (BET_FEE_BPS / 10000)).toFixed(4)} SOL
                                        </div>
                                    </div>

                                    {/* Quick Amount Buttons */}
                                    <div className="grid grid-cols-4 gap-2 mb-6">
                                        {['0.1', '0.25', '0.5', '1'].map((amount) => (
                                            <button
                                                key={amount}
                                                onClick={() => setBetAmount(amount)}
                                                className="px-4 py-2 border-2 border-dark-border rounded-lg hover:border-white transition text-sm font-medium text-white"
                                            >
                                                {amount}
                                            </button>
                                        ))}
                                    </div>

                                    {/* Place Bet Button */}
                                    <button
                                        onClick={handlePlaceBet}
                                        disabled={txLoading || !publicKey}
                                        className="w-full bg-white text-black py-4 rounded-lg font-bold text-lg hover:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed"
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
                                            `Bet ${betAmount} SOL on ${market.sideNames[selectedSide]}`
                                        )}
                                    </button>
                                </>
                            ) : (
                                <div className="text-center py-8">
                                    <div className="text-4xl mb-4">⏰</div>
                                    <h3 className="text-xl font-bold text-white mb-2">Trading Closed</h3>
                                    <p className="text-dark-muted mb-4">
                                        {market.resolved
                                            ? `Winner: ${market.sideNames[market.winningSideIndex]}`
                                            : 'Market has ended but not yet resolved'}
                                    </p>
                                    {!market.resolved && publicKey && (
                                        <>
                                            <p className="text-sm text-dark-muted mb-4">
                                                Click below to resolve this market and determine the winner
                                            </p>
                                            <button
                                                onClick={handleResolveMarket}
                                                disabled={txLoading}
                                                className="bg-white text-black px-6 py-3 rounded-lg font-semibold hover:opacity-90 transition disabled:opacity-50"
                                            >
                                                {txLoading ? 'Resolving...' : 'Resolve Market'}
                                            </button>
                                        </>
                                    )}
                                    {!market.resolved && !publicKey && (
                                        <p className="text-sm text-dark-muted">
                                            Connect wallet to resolve this market
                                        </p>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right: Position & Stats */}
                    <div className="space-y-6">
                        {/* Creator Fee Claiming */}
                        {isCreator && (
                            <div className="bg-dark-card text-white rounded-lg shadow-lg p-6 border border-dark-border">
                                <h3 className="text-xl font-bold mb-4 flex items-center">
                                    Creator Fees
                                </h3>
                                <div className="space-y-3 mb-4">
                                    <div className="flex justify-between items-center">
                                        <span className="opacity-75">Total Fee Pool</span>
                                        <span className="font-semibold">
                                            {(market.feePool.toNumber() / LAMPORTS_PER_SOL).toFixed(4)} SOL
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="opacity-75">Your Share (50%)</span>
                                        <span className="font-bold text-2xl">
                                            {(creatorFeesAvailable / LAMPORTS_PER_SOL).toFixed(4)} SOL
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="opacity-75">Protocol Share (50%)</span>
                                        <span>
                                            {(creatorFeesAvailable / LAMPORTS_PER_SOL).toFixed(4)} SOL
                                        </span>
                                    </div>
                                </div>

                                {hasClaimableCreatorFees ? (
                                    <>
                                        <button
                                            onClick={handleClaimCreatorFees}
                                            disabled={txLoading}
                                            className="w-full bg-black text-white py-3 rounded-lg font-semibold hover:bg-dark-card transition disabled:opacity-50 mb-3"
                                        >
                                            {txLoading ? 'Claiming...' : `Claim ${(creatorFeesAvailable / LAMPORTS_PER_SOL).toFixed(4)} SOL`}
                                        </button>
                                        <p className="text-xs opacity-75 text-center">
                                            Protocol automatically receives their 50% when you claim
                                        </p>
                                    </>
                                ) : market.creatorFeesDistributed.toNumber() > 0 ? (
                                    <div className="bg-black bg-opacity-10 rounded-lg p-3 text-center">
                                        <span className="font-semibold">✓ Fees Claimed</span>
                                    </div>
                                ) : market.resolved ? (
                                    <div className="bg-black bg-opacity-10 rounded-lg p-3 text-center">
                                        <span>No fees to claim</span>
                                    </div>
                                ) : (
                                    <div className="bg-black bg-opacity-10 rounded-lg p-3 text-center">
                                        <span>Available after market resolves</span>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* User Position */}
                        {position && (
                            <div className="bg-dark-card rounded-lg shadow-lg p-6 border border-dark-border">
                                <h3 className="text-xl font-bold mb-4 text-white">Your Position</h3>
                                <div className="space-y-3 mb-4">
                                    {position.bets.map((bet, idx) => {
                                        if (!bet.hasBet || bet.amount.toNumber() === 0) return null;
                                        const isWinningSide = market.resolved && idx === market.winningSideIndex;
                                        return (
                                            <div key={idx} className="flex justify-between items-center">
                                                <span className="text-dark-muted">
                                                    {market.sideNames[idx]}
                                                    {isWinningSide && <span className="ml-2">🏆</span>}
                                                </span>
                                                <span className="font-semibold text-white">
                                                    {(bet.amount.toNumber() / LAMPORTS_PER_SOL).toFixed(4)} SOL
                                                </span>
                                            </div>
                                        );
                                    })}
                                    <div className="border-t border-dark-border pt-3 flex justify-between items-center">
                                        <span className="text-dark-muted">Total Invested</span>
                                        <span className="font-semibold text-white">
                                            {(position.totalInvested.toNumber() / LAMPORTS_PER_SOL).toFixed(4)} SOL
                                        </span>
                                    </div>
                                    {market.resolved && estimatedPayout > 0 && (
                                        <div className="flex justify-between items-center">
                                            <span className="text-dark-muted">Your Payout</span>
                                            <span className="font-bold text-white text-xl">
                                                {estimatedPayout.toFixed(4)} SOL
                                            </span>
                                        </div>
                                    )}
                                </div>

                                {/* Claim Winnings Button */}
                                {market.resolved && !position.claimed && estimatedPayout > 0 && (
                                    <button
                                        onClick={handleClaimWinnings}
                                        disabled={txLoading}
                                        className="w-full bg-white text-black py-3 rounded-lg font-semibold hover:opacity-90 transition disabled:opacity-50"
                                    >
                                        {txLoading ? 'Claiming...' : `Claim ${estimatedPayout.toFixed(4)} SOL`}
                                    </button>
                                )}

                                {position.claimed && (
                                    <div className="bg-white/10 border border-white rounded-lg p-3 text-center">
                                        <span className="text-white font-semibold">✓ Winnings Claimed</span>
                                    </div>
                                )}

                                {market.resolved && estimatedPayout === 0 && !position.claimed && (
                                    <div className="bg-dark-bg border border-dark-border rounded-lg p-3 text-center">
                                        <span className="text-dark-muted">No winnings (bet on losing side)</span>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Market Stats */}
                        <div className="bg-dark-card rounded-lg shadow-lg p-6 border border-dark-border">
                            <h3 className="text-xl font-bold mb-4 text-white">Market Stats</h3>
                            <div className="space-y-3">
                                <div className="flex justify-between items-center">
                                    <span className="text-dark-muted">Total Pool</span>
                                    <span className="font-semibold text-white">
                                        {market.totalLiquidity.toFixed(4)} SOL
                                    </span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-dark-muted">Total Volume</span>
                                    <span className="font-semibold text-white">
                                        {market.volume.toFixed(4)} SOL
                                    </span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-dark-muted">Fee Pool</span>
                                    <span className="font-semibold text-white">
                                        {(market.feePool.toNumber() / LAMPORTS_PER_SOL).toFixed(4)} SOL
                                    </span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-dark-muted">Total Traders</span>
                                    <span className="font-semibold text-white">{market.numBettors}</span>
                                </div>
                                <div className="border-t border-dark-border pt-3 flex justify-between items-center">
                                    <span className="text-dark-muted">Ends</span>
                                    <span className="font-semibold text-sm text-white">
                                        {market.endDate.toLocaleDateString()}<br />
                                        {market.endDate.toLocaleTimeString()}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Bar Graph Visualization */}
                        <div className="bg-dark-card rounded-lg shadow-lg p-6 border border-dark-border">
                            <h3 className="text-xl font-bold mb-4 text-white">Distribution</h3>
                            <div className="space-y-3">
                                {market.sideNames.map((name, idx) => {
                                    const side = market.sides[idx];
                                    const percentage = market.sidePrices[idx];
                                    const isLeading = idx === leadingSideIndex;
                                    const isWinner = market.resolved && idx === market.winningSideIndex;
                                    
                                    return (
                                        <div key={idx}>
                                            <div className="flex justify-between items-center mb-1">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-sm font-semibold text-white">{name}</span>
                                                    {isWinner && <span className="text-xs">🏆</span>}
                                                    {isLeading && !market.resolved && (
                                                        <span className="text-xs bg-white text-black px-1.5 py-0.5 rounded">Leading</span>
                                                    )}
                                                </div>
                                                <span className="text-sm font-bold text-white">{percentage.toFixed(1)}%</span>
                                            </div>
                                            <div className="relative h-8 bg-dark-bg rounded-lg overflow-hidden border border-dark-border">
                                                <div
                                                    className={`h-full transition-all duration-500 ${
                                                        isWinner
                                                            ? 'bg-white'
                                                            : isLeading
                                                                ? 'bg-white/80'
                                                                : 'bg-white/40'
                                                    }`}
                                                    style={{ width: `${percentage}%` }}
                                                >
                                                    <div className="flex items-center justify-between h-full px-3 text-xs">
                                                        <span className={`font-medium ${percentage > 30 ? 'text-black' : 'text-transparent'}`}>
                                                            {(side.totalAmount.toNumber() / LAMPORTS_PER_SOL).toFixed(2)} SOL
                                                        </span>
                                                        <span className={`${percentage > 20 ? 'text-black/70' : 'text-transparent'}`}>
                                                            {side.numBettors} {side.numBettors === 1 ? 'trader' : 'traders'}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}