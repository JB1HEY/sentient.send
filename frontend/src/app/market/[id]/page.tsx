'use client';

import { useEffect, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useProgram } from '@/hooks/useProgram';
import { getPositionPda, getMarketVaultPda, decodeSideName } from '@/lib/anchor';
import { PublicKey } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddress } from '@solana/spl-token';
import BN from 'bn.js';
import { 
  MIN_BET_USDC, 
  MAX_BET_USDC, 
  USDC_MINT, 
  USDC_MULTIPLIER,
  BET_FEE_BPS 
} from '@/lib/constants';
import Navbar from '@/components/Navbar';
import { useParams } from 'next/navigation';
import { getConnection } from '@/lib/anchor';
import { MarketWithPrices, UserPosition } from '@/types/market';

export default function MarketDetailPage() {
    const params = useParams();
    const marketId = params?.id as string;
    const { publicKey } = useWallet();
    const program = useProgram();

    const [market, setMarket] = useState<MarketWithPrices | null>(null);
    const [position, setPosition] = useState<UserPosition | null>(null);
    const [loading, setLoading] = useState(true);
    const [betAmount, setBetAmount] = useState('10');
    const [selectedSide, setSelectedSide] = useState<number>(0);
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

            const data = accountInfo.data;
            let offset = 8;

            const creator = new PublicKey(data.slice(offset, offset + 32));
            offset += 32;

            const questionLen = data.readUInt32LE(offset);
            offset += 4;
            const questionBytes = data.slice(offset, offset + questionLen);
            const question = new TextDecoder().decode(questionBytes);
            offset += questionLen;

            const descLen = data.readUInt32LE(offset);
            offset += 4;
            const descBytes = data.slice(offset, offset + descLen);
            const description = new TextDecoder().decode(descBytes);
            offset += descLen;

            const endTimestamp = new BN(data.slice(offset, offset + 8), 'le');
            offset += 8;

            const resolved = data[offset] === 1;
            offset += 1;

            const winningSideIndex = data[offset];
            offset += 1;

            const totalPool = new BN(data.slice(offset, offset + 8), 'le');
            offset += 8;

            const numSides = data[offset];
            offset += 1;

            const sides = [];
            const sideNames = [];
            const sidePrices = [];

            for (let i = 0; i < numSides && i < 10; i++) {
                const nameBytes = Array.from(data.slice(offset, offset + 50));
                offset += 50;
                const nameLen = data[offset];
                offset += 1;
                const totalAmount = new BN(data.slice(offset, offset + 8), 'le');
                offset += 8;
                const numBettors = data.readUInt32LE(offset);
                offset += 4;

                const sideName = decodeSideName(nameBytes, nameLen);
                sideNames.push(sideName);

                const totalPoolNum = totalPool.toNumber();
                const sidePercent = totalPoolNum > 0 ? (totalAmount.toNumber() / totalPoolNum) * 100 : 0;
                sidePrices.push(sidePercent);

                sides.push({ name: nameBytes, nameLen, totalAmount, numBettors });
            }

            offset += (10 - numSides) * 63;

            const feePool = new BN(data.slice(offset, offset + 8), 'le');
            offset += 8;
            const creatorFeesDistributed = new BN(data.slice(offset, offset + 8), 'le');
            offset += 8;
            const protocolFeesDistributed = new BN(data.slice(offset, offset + 8), 'le');
            offset += 8;
            const totalVolume = new BN(data.slice(offset, offset + 8), 'le');
            offset += 8;
            const numBettors = data.readUInt32LE(offset);
            offset += 4;
            const creationAmount = new BN(data.slice(offset, offset + 8), 'le');
            offset += 8;
            const bump = data[offset];

            const marketWithPrice: MarketWithPrices = {
                publicKey: marketPubkey,
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
                totalLiquidity: totalPool.toNumber() / USDC_MULTIPLIER,
                volume: totalVolume.toNumber() / USDC_MULTIPLIER,
                sidePrices,
                sideNames,
            };

            setMarket(marketWithPrice);

            if (publicKey && program) {
                try {
                    const { positionPda } = getPositionPda(marketPubkey, publicKey);
                    const positionData = await (program.account as any).userPosition.fetch(positionPda);
                    setPosition(positionData);
                } catch (err) {
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
        if (amount < MIN_BET_USDC) {
            setError(`Minimum bet is ${MIN_BET_USDC} USDC`);
            return;
        }

        if (amount > MAX_BET_USDC) {
            setError(`Maximum bet is ${MAX_BET_USDC} USDC`);
            return;
        }

        try {
            setTxLoading(true);
            setError('');
            setSuccess('');

            const amountLamports = new BN(amount * USDC_MULTIPLIER);
            const { positionPda } = getPositionPda(market.publicKey, publicKey);
            const { vaultPda } = getMarketVaultPda(market.publicKey);
            const userTokenAccount = await getAssociatedTokenAddress(USDC_MINT, publicKey);

            const tx = await program.methods
                .placeBet(selectedSide, amountLamports)
                .accounts({
                    market: market.publicKey,
                    marketVault: vaultPda,
                    position: positionPda,
                    userTokenAccount,
                    user: publicKey,
                    tokenProgram: TOKEN_PROGRAM_ID,
                    systemProgram: PublicKey.default,
                })
                .rpc();

            setSuccess(`Bet placed successfully! Transaction: ${tx.slice(0, 8)}...`);
            await loadMarket();
            setBetAmount('10');
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

            const { positionPda } = getPositionPda(market.publicKey, publicKey);
            const { vaultPda } = getMarketVaultPda(market.publicKey);
            const userTokenAccount = await getAssociatedTokenAddress(USDC_MINT, publicKey);

            const tx = await program.methods
                .claimWinnings()
                .accounts({
                    market: market.publicKey,
                    marketVault: vaultPda,
                    position: positionPda,
                    userTokenAccount,
                    user: publicKey,
                    tokenProgram: TOKEN_PROGRAM_ID,
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

    const estimatedPayout = position && market.resolved ? (() => {
        const userBet = position.bets[market.winningSideIndex];
        if (!userBet || userBet.amount.toNumber() === 0) return 0;
        const winningSide = market.sides[market.winningSideIndex];
        if (winningSide.totalAmount.toNumber() === 0) return 0;
        return ((userBet.amount.toNumber() / winningSide.totalAmount.toNumber()) * market.totalPool.toNumber()) / USDC_MULTIPLIER;
    })() : 0;

    const leadingSideIndex = market.sidePrices.indexOf(Math.max(...market.sidePrices));

    return (
        <div className="min-h-screen bg-gray-50">
            <Navbar />
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                <a href="/" className="text-primary hover:underline mb-6 inline-block">← Back to Markets</a>
                <div className="bg-white rounded-lg shadow-lg p-8 mb-6">
                    <div className="flex justify-between items-start mb-6">
                        <div className="flex-1">
                            <h1 className="text-3xl font-bold text-gray-900 mb-2">{market.question}</h1>
                            <p className="text-gray-600 mb-4">{market.description}</p>
                            <div className="flex items-center space-x-4">
                                {market.isActive ? (
                                    <div className="flex items-center text-sm">
                                        <span className="inline-block w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse"></span>
                                        <span className="text-gray-600">Active • {daysLeft > 0 && `${daysLeft}d `}{hoursLeft}h {minutesLeft}m left</span>
                                    </div>
                                ) : market.resolved ? (
                                    <div className="flex items-center text-sm">
                                        <span className="inline-block w-2 h-2 bg-gray-400 rounded-full mr-2"></span>
                                        <span className="text-gray-600">Resolved - Winner: {market.sideNames[market.winningSideIndex]}</span>
                                    </div>
                                ) : (
                                    <div className="flex items-center text-sm">
                                        <span className="inline-block w-2 h-2 bg-yellow-500 rounded-full mr-2"></span>
                                        <span className="text-gray-600">Market Ended</span>
                                    </div>
                                )}
                                <span className="text-sm text-gray-500">{market.numBettors} traders</span>
                                <span className="text-sm text-gray-500">{market.volume.toFixed(2)} USDC volume</span>
                            </div>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                        {market.sideNames.map((name, idx) => {
                            const side = market.sides[idx];
                            const isLeading = idx === leadingSideIndex;
                            const isWinner = market.resolved && idx === market.winningSideIndex;
                            return (
                                <div key={idx} className={`p-4 rounded-lg border-2 ${isWinner ? 'border-green-500 bg-green-50' : isLeading ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white'}`}>
                                    <div className="flex justify-between items-start mb-2">
                                        <div className="font-semibold text-gray-900">{name}</div>
                                        {isLeading && !market.resolved && <span className="text-xs bg-blue-500 text-white px-2 py-1 rounded">Leading</span>}
                                        {isWinner && <span className="text-xs bg-green-500 text-white px-2 py-1 rounded">Winner</span>}
                                    </div>
                                    <div className="text-2xl font-bold text-primary mb-1">{market.sidePrices[idx].toFixed(1)}%</div>
                                    <div className="text-sm text-gray-600">{(side.totalAmount.toNumber() / USDC_MULTIPLIER).toFixed(2)} USDC</div>
                                    <div className="text-xs text-gray-500 mt-1">{side.numBettors} traders</div>
                                </div>
                            );
                        })}
                    </div>
                    <div className="bg-purple-50 border-l-4 border-purple-500 p-4">
                        <div className="flex">
                            <div className="flex-shrink-0">
                                <svg className="h-5 w-5 text-purple-500" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                                </svg>
                            </div>
                            <div className="ml-3">
                                <p className="text-sm text-purple-700"><strong>Winner Takes All:</strong> When this market ends, the side with the most USDC wins. Winners split the entire {market.totalLiquidity.toFixed(2)} USDC pool proportionally. Losers get nothing.</p>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2">
                        <div className="bg-white rounded-lg shadow-lg p-6">
                            <h2 className="text-2xl font-bold mb-6">Place Your Bet</h2>
                            {market.isActive ? (
                                <>
                                    <div className="mb-6">
                                        <label className="block text-sm font-semibold text-gray-700 mb-3">Select Option</label>
                                        <div className="grid grid-cols-1 gap-2">
                                            {market.sideNames.map((name, idx) => (
                                                <button key={idx} onClick={() => setSelectedSide(idx)} className={`p-4 rounded-lg border-2 transition text-left ${selectedSide === idx ? 'border-primary bg-purple-50' : 'border-gray-200 hover:border-primary'}`}>
                                                    <div className="flex justify-between items-center">
                                                        <div>
                                                            <div className="font-bold text-gray-900">{name}</div>
                                                            <div className="text-sm text-gray-600">{market.sidePrices[idx].toFixed(1)}% of pool</div>
                                                        </div>
                                                        {idx === leadingSideIndex && <span className="text-xs bg-blue-500 text-white px-2 py-1 rounded">Leading</span>}
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="mb-6">
                                        <label className="block text-sm font-semibold text-gray-700 mb-2">Bet Amount (USDC)</label>
                                        <input type="number" value={betAmount} onChange={(e) => setBetAmount(e.target.value)} min={MIN_BET_USDC} max={MAX_BET_USDC} step="1" className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-primary focus:outline-none transition" placeholder="10" />
                                        <div className="flex justify-between mt-2 text-sm text-gray-600">
                                            <span>Min: {MIN_BET_USDC} USDC</span>
                                            <span>Max: {MAX_BET_USDC} USDC</span>
                                        </div>
                                        <div className="text-xs text-gray-500 mt-1">2% fee: {((parseFloat(betAmount) || 0) * (BET_FEE_BPS / 10000)).toFixed(2)} USDC</div>
                                    </div>
                                    <div className="grid grid-cols-4 gap-2 mb-6">
                                        {['10', '25', '50', '100'].map((amount) => (
                                            <button key={amount} onClick={() => setBetAmount(amount)} className="px-4 py-2 border-2 border-gray-200 rounded-lg hover:border-primary transition text-sm font-medium">{amount}</button>
                                        ))}
                                    </div>
                                    {error && <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-4"><p className="text-sm text-red-700">{error}</p></div>}
                                    {success && <div className="bg-green-50 border-l-4 border-green-500 p-4 mb-4"><p className="text-sm text-green-700">{success}</p></div>}
                                    <button onClick={handlePlaceBet} disabled={txLoading || !publicKey} className="w-full bg-gradient-main text-white py-4 rounded-lg font-bold text-lg hover:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed">
                                        {txLoading ? <span className="flex items-center justify-center"><svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>Processing...</span> : !publicKey ? 'Connect Wallet to Bet' : `Bet ${betAmount} USDC on ${market.sideNames[selectedSide]}`}
                                    </button>
                                </>
                            ) : (
                                <div className="text-center py-8">
                                    <div className="text-4xl mb-4">⏰</div>
                                    <h3 className="text-xl font-bold text-gray-900 mb-2">Trading Closed</h3>
                                    <p className="text-gray-600 mb-4">{market.resolved ? `Winner: ${market.sideNames[market.winningSideIndex]}` : 'Market has ended. Claim your winnings if you won.'}</p>
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="space-y-6">
                        {position && (
                            <div className="bg-white rounded-lg shadow-lg p-6">
                                <h3 className="text-xl font-bold mb-4">Your Position</h3>
                                <div className="space-y-3 mb-4">
                                    {position.bets.map((bet, idx) => {
                                        if (!bet.hasBet || bet.amount.toNumber() === 0) return null;
                                        return (
                                            <div key={idx} className="flex justify-between items-center">
                                                <span className="text-gray-600">{market.sideNames[idx]}</span>
                                                <span className="font-semibold">{(bet.amount.toNumber() / USDC_MULTIPLIER).toFixed(2)} USDC</span>
                                            </div>
                                        );
                                    })}
                                    <div className="border-t pt-3 flex justify-between items-center">
                                        <span className="text-gray-600">Total Invested</span>
                                        <span className="font-semibold">{(position.totalInvested.toNumber() / USDC_MULTIPLIER).toFixed(2)} USDC</span>
                                    </div>
                                    {market.resolved && estimatedPayout > 0 && (
                                        <div className="flex justify-between items-center">
                                            <span className="text-gray-600">Your Payout</span>
                                            <span className="font-bold text-green-600">{estimatedPayout.toFixed(2)} USDC</span>
                                        </div>
                                    )}
                                </div>
                                {market.resolved && !position.claimed && estimatedPayout > 0 && (
                                    <button onClick={handleClaim} disabled={txLoading} className="w-full bg-gradient-main text-white py-3 rounded-lg font-semibold hover:opacity-90 transition disabled:opacity-50">{txLoading ? 'Claiming...' : 'Claim Winnings'}</button>
                                )}
                                {position.claimed && <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center"><span className="text-green-700 font-semibold">✓ Claimed</span></div>}
                                {market.resolved && estimatedPayout === 0 && <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-center"><span className="text-gray-700">No winnings (bet on losing side)</span></div>}
                            </div>
                        )}
                        <div className="bg-white rounded-lg shadow-lg p-6">
                            <h3 className="text-xl font-bold mb-4">Market Stats</h3>
                            <div className="space-y-3">
                                <div className="flex justify-between items-center"><span className="text-gray-600">Total Pool</span><span className="font-semibold">{market.totalLiquidity.toFixed(2)} USDC</span></div>
                                <div className="flex justify-between items-center"><span className="text-gray-600">Total Volume</span><span className="font-semibold">{market.volume.toFixed(2)} USDC</span></div>
                                <div className="flex justify-between items-center"><span className="text-gray-600">Fee Pool</span><span className="font-semibold">{(market.feePool.toNumber() / USDC_MULTIPLIER).toFixed(2)} USDC</span></div>
                                <div className="flex justify-between items-center"><span className="text-gray-600">Total Traders</span><span className="font-semibold">{market.numBettors}</span></div>
                                <div className="border-t pt-3 flex justify-between items-center"><span className="text-gray-600">Ends</span><span className="font-semibold text-sm">{market.endDate.toLocaleDateString()} {market.endDate.toLocaleTimeString()}</span></div>
                            </div>
                        </div>
                        <div className="bg-gradient-main text-white rounded-lg shadow-lg p-6">
                            <h3 className="text-lg font-bold mb-3">🏆 Winner Takes All</h3>
                            <ul className="space-y-2 text-sm">
                                <li>• Side with most USDC wins</li>
                                <li>• Winners split entire pool</li>
                                <li>• Losers get nothing</li>
                                <li>• Auto-resolves when market ends</li>
                            </ul>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}