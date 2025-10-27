'use client';

import { useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useProgram } from '@/hooks/useProgram';
import { getMarketPda, getTreasuryPda } from '@/lib/anchor';
import { SystemProgram } from '@solana/web3.js';
import BN from 'bn.js';
import { LAMPORTS_PER_SOL, CREATION_FEE, MIN_LIQUIDITY } from '@/lib/constants';
import Navbar from '@/components/Navbar';

export default function CreatePage() {
  const { publicKey } = useWallet();
  const program = useProgram();

  const [question, setQuestion] = useState('');
  const [description, setDescription] = useState('');
  const [endDate, setEndDate] = useState('');
  const [endTime, setEndTime] = useState('');
  const [liquidity, setLiquidity] = useState('2');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Get minimum date (tomorrow)
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const minDate = tomorrow.toISOString().split('T')[0];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!publicKey || !program) {
      setError('Please connect your wallet first');
      return;
    }

    // Validation
    if (question.length < 10) {
      setError('Question must be at least 10 characters');
      return;
    }

    if (question.length > 200) {
      setError('Question must be less than 200 characters');
      return;
    }

    if (description.length > 500) {
      setError('Description must be less than 500 characters');
      return;
    }

    if (!endDate || !endTime) {
      setError('Please select an end date and time');
      return;
    }

    const liquidityNum = parseFloat(liquidity);
    if (liquidityNum < MIN_LIQUIDITY) {
      setError(`Minimum liquidity is ${MIN_LIQUIDITY} SOL`);
      return;
    }

    try {
      setLoading(true);

      // Combine date and time
      const endDateTime = new Date(`${endDate}T${endTime}`);
      const endTimestamp = new BN(Math.floor(endDateTime.getTime() / 1000));

      // Check if date is in the future
      if (endDateTime.getTime() <= Date.now()) {
        setError('End date must be in the future');
        setLoading(false);
        return;
      }

      // Get PDAs
      const { marketPda, questionSeed } = getMarketPda(publicKey, question);
      const treasuryPda = getTreasuryPda();

      const liquidityLamports = new BN(liquidityNum * LAMPORTS_PER_SOL);

      console.log('Creating market...');
      console.log('Market PDA:', marketPda.toString());
      console.log('Question:', question);
      console.log('End timestamp:', endTimestamp.toString());

      // Create market
      const tx = await program.methods
        .createMarket(
          question,
          description,
          endTimestamp,
          liquidityLamports,
          questionSeed
        )
        .accounts({
          market: marketPda,
          treasury: treasuryPda,
          creator: publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      console.log('Transaction signature:', tx);

      setSuccess(`Market created successfully! Transaction: ${tx.slice(0, 8)}...`);
      
      // Reset form
      setQuestion('');
      setDescription('');
      setEndDate('');
      setEndTime('');
      setLiquidity('2');

      // Redirect to market page after 2 seconds
      setTimeout(() => {
        window.location.href = `/market/${marketPda.toString()}`;
      }, 2000);

    } catch (err: any) {
      console.error('Error creating market:', err);
      setError(err.message || 'Failed to create market. Check console for details.');
    } finally {
      setLoading(false);
    }
  }

  const totalCost = parseFloat(liquidity) + CREATION_FEE;

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Create Your Prediction Market
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Launch a prediction market on any future event. Users can bet YES or NO, 
            and you'll resolve it when the event concludes.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="max-w-2xl mx-auto">
          <div className="bg-white rounded-lg shadow-lg p-8">
            <h2 className="text-3xl font-bold mb-6 bg-gradient-main bg-clip-text text-transparent">
              Create Prediction Market
            </h2>

            {/* Question */}
            <div className="mb-6">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Question *
              </label>
              <input
                type="text"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="Will Bitcoin reach $100k by end of 2025?"
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-primary focus:outline-none transition"
                maxLength={200}
                required
              />
              <div className="text-xs text-gray-500 mt-1">
                {question.length}/200 characters
              </div>
            </div>

            {/* Description */}
            <div className="mb-6">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Description (optional)
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Resolves YES if BTC hits $100k before Dec 31, 2025..."
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-primary focus:outline-none transition resize-none"
                rows={4}
                maxLength={500}
              />
              <div className="text-xs text-gray-500 mt-1">
                {description.length}/500 characters
              </div>
            </div>

            {/* End Date & Time */}
            <div className="mb-6 grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  End Date *
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  min={minDate}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-primary focus:outline-none transition"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  End Time *
                </label>
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-primary focus:outline-none transition"
                  required
                />
              </div>
            </div>

            {/* Initial Liquidity */}
            <div className="mb-6">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Initial Liquidity (SOL) *
              </label>
              <input
                type="number"
                value={liquidity}
                onChange={(e) => setLiquidity(e.target.value)}
                min={MIN_LIQUIDITY}
                step="0.1"
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-primary focus:outline-none transition"
                required
              />
              <div className="text-xs text-gray-500 mt-1">
                Minimum {MIN_LIQUIDITY} SOL. This will be split 50/50 between YES and NO pools.
              </div>
            </div>

            {/* Cost Breakdown */}
            <div className="bg-gray-50 rounded-lg p-4 mb-6">
              <h3 className="font-semibold text-gray-900 mb-3">Cost Breakdown</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Initial Liquidity</span>
                  <span className="font-medium">{liquidity} SOL</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Creation Fee</span>
                  <span className="font-medium">{CREATION_FEE} SOL</span>
                </div>
                <div className="border-t pt-2 flex justify-between">
                  <span className="font-semibold text-gray-900">Total Cost</span>
                  <span className="font-bold text-primary">{totalCost.toFixed(1)} SOL</span>
                </div>
              </div>
            </div>

            {/* Info Box */}
            <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mb-6">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-blue-500" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm text-blue-700">
                    <strong>Note:</strong> Only you (the creator) can resolve this market after it ends. 
                    Make sure you'll be available to resolve it at the end date!
                  </p>
                </div>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-6">
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

            {/* Success Message */}
            {success && (
              <div className="bg-green-50 border-l-4 border-green-500 p-4 mb-6">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-green-500" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <p className="text-sm text-green-700">{success}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading || !publicKey}
              className="w-full bg-gradient-main text-white py-4 rounded-lg font-bold text-lg hover:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Creating Market...
                </span>
              ) : !publicKey ? (
                'Connect Wallet First'
              ) : (
                `Create Market (${totalCost.toFixed(1)} SOL)`
              )}
            </button>
          </div>
        </form>

        {/* How It Works */}
        <div className="max-w-2xl mx-auto mt-16">
          <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">
            How It Works
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="bg-gradient-main text-white w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold mx-auto mb-4">
                1
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">Create Market</h3>
              <p className="text-sm text-gray-600">
                Ask a yes/no question about a future event and set an end date
              </p>
            </div>
            <div className="text-center">
              <div className="bg-gradient-main text-white w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold mx-auto mb-4">
                2
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">Users Trade</h3>
              <p className="text-sm text-gray-600">
                People bet YES or NO. Prices adjust automatically based on demand
              </p>
            </div>
            <div className="text-center">
              <div className="bg-gradient-main text-white w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold mx-auto mb-4">
                3
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">Resolve & Payout</h3>
              <p className="text-sm text-gray-600">
                After the event, you resolve the market and winners get paid out
              </p>
            </div>
          </div>
        </div>

        {/* Tips */}
        <div className="max-w-2xl mx-auto mt-12 bg-white rounded-lg shadow p-6">
          <h3 className="font-semibold text-gray-900 mb-4">💡 Tips for Great Markets</h3>
          <ul className="space-y-2 text-sm text-gray-600">
            <li className="flex items-start">
              <span className="text-primary mr-2">•</span>
              <span><strong>Be specific:</strong> "Will Bitcoin reach $100k by Dec 31, 2025?" is better than "Will Bitcoin go up?"</span>
            </li>
            <li className="flex items-start">
              <span className="text-primary mr-2">•</span>
              <span><strong>Clear resolution:</strong> Make sure the outcome will be obvious and verifiable</span>
            </li>
            <li className="flex items-start">
              <span className="text-primary mr-2">•</span>
              <span><strong>Reasonable timeframe:</strong> Not too short (boring) or too long (people forget)</span>
            </li>
            <li className="flex items-start">
              <span className="text-primary mr-2">•</span>
              <span><strong>Add liquidity:</strong> More initial liquidity = better pricing = more traders</span>
            </li>
          </ul>
        </div>
      </main>
    </div>
  );
}