'use client';

import { useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useProgram } from '@/hooks/useProgram';
import { getMarketPda, getPositionPda, getTreasuryPda } from '@/lib/anchor';
import { SystemProgram } from '@solana/web3.js';
import BN from 'bn.js';
import { 
  MIN_MARKET_CREATION_SOL, 
  CREATION_FEE_PERCENT, 
  MIN_SIDES,
  MAX_SIDES,
  MAX_SIDE_NAME_LENGTH,
  LAMPORTS_PER_SOL
} from '@/lib/constants';
import Navbar from '@/components/Navbar';

export default function CreatePage() {
  const { publicKey } = useWallet();
  const program = useProgram();

  const [question, setQuestion] = useState('');
  const [description, setDescription] = useState('');
  const [endDate, setEndDate] = useState('');
  const [endTime, setEndTime] = useState('');
  const [initialAmount, setInitialAmount] = useState(MIN_MARKET_CREATION_SOL.toString());
  const [sideNames, setSideNames] = useState<string[]>(['', '']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const minDate = tomorrow.toISOString().split('T')[0];

  function addSide() {
    if (sideNames.length < MAX_SIDES) {
      setSideNames([...sideNames, '']);
    }
  }

  function removeSide(index: number) {
    if (sideNames.length > MIN_SIDES) {
      setSideNames(sideNames.filter((_, i) => i !== index));
    }
  }

  function updateSideName(index: number, value: string) {
    const newSideNames = [...sideNames];
    newSideNames[index] = value;
    setSideNames(newSideNames);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSuccess('');

    console.log('Debug - publicKey:', publicKey?.toString());
    console.log('Debug - program:', program);

    if (!publicKey) {
      setError('Please connect your wallet first');
      return;
    }

    if (!program) {
      setError('Program not initialized. Please reconnect your wallet.');
      return;
    }

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

    const amountNum = parseFloat(initialAmount);
    if (amountNum < MIN_MARKET_CREATION_SOL) {
      setError(`Minimum initial amount is ${MIN_MARKET_CREATION_SOL} SOL`);
      return;
    }

    const validSideNames = sideNames.filter(name => name.trim().length > 0);
    if (validSideNames.length < MIN_SIDES) {
      setError(`You need at least ${MIN_SIDES} options`);
      return;
    }

    for (const name of validSideNames) {
      if (name.length > MAX_SIDE_NAME_LENGTH) {
        setError(`Side name "${name}" is too long (max ${MAX_SIDE_NAME_LENGTH} characters)`);
        return;
      }
    }

    const uniqueNames = new Set(validSideNames.map(n => n.toLowerCase()));
    if (uniqueNames.size !== validSideNames.length) {
      setError('Side names must be unique');
      return;
    }

    try {
      setLoading(true);

      const endDateTime = new Date(`${endDate}T${endTime}`);
      const endTimestamp = new BN(Math.floor(endDateTime.getTime() / 1000));

      if (endDateTime.getTime() <= Date.now()) {
        setError('End date must be in the future');
        setLoading(false);
        return;
      }

      const { marketPda } = getMarketPda(publicKey, question);
      const { positionPda } = getPositionPda(marketPda, publicKey);
      const { treasuryPda } = getTreasuryPda();

      const amountLamports = new BN(amountNum * LAMPORTS_PER_SOL);

      console.log('Creating market...');
      console.log('Market PDA:', marketPda.toString());
      console.log('Position PDA:', positionPda.toString());
      console.log('Question:', question);
      console.log('Side names:', validSideNames);
      console.log('Amount (lamports):', amountLamports.toString());

      const tx = await program.methods
        .createMarket(
          question,
          description,
          endTimestamp,
          validSideNames,
          amountLamports
        )
        .accounts({
          market: marketPda,
          position: positionPda,
          treasury: treasuryPda,
          creator: publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      console.log('Transaction signature:', tx);

      setSuccess(`Market created successfully! Transaction: ${tx.slice(0, 8)}...`);
      
      setQuestion('');
      setDescription('');
      setEndDate('');
      setEndTime('');
      setInitialAmount(MIN_MARKET_CREATION_SOL.toString());
      setSideNames(['', '']);

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

  const creationFee = parseFloat(initialAmount) * (CREATION_FEE_PERCENT / 100);
  const totalCost = parseFloat(initialAmount);

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Create Your Prediction Market
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Create a multi-option market where the side with the most SOL wins everything.
            2-10 options allowed. Winner takes all.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="max-w-2xl mx-auto">
          <div className="bg-white rounded-lg shadow-lg p-8">
            <h2 className="text-3xl font-bold mb-6 bg-gradient-main bg-clip-text text-transparent">
              Create Multi-Side Market
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
                placeholder="Who will win the 2024 election?"
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
                placeholder="Market resolves automatically when it ends. The side with the most SOL wins."
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-primary focus:outline-none transition resize-none"
                rows={4}
                maxLength={500}
              />
              <div className="text-xs text-gray-500 mt-1">
                {description.length}/500 characters
              </div>
            </div>

            {/* Side Names */}
            <div className="mb-6">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Options ({sideNames.length}/{MAX_SIDES}) *
              </label>
              <div className="space-y-2">
                {sideNames.map((name, index) => (
                  <div key={index} className="flex gap-2">
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => updateSideName(index, e.target.value)}
                      placeholder={`Option ${index + 1} (e.g., "Donald Trump")`}
                      className="flex-1 px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-primary focus:outline-none transition"
                      maxLength={MAX_SIDE_NAME_LENGTH}
                      required
                    />
                    {sideNames.length > MIN_SIDES && (
                      <button
                        type="button"
                        onClick={() => removeSide(index)}
                        className="px-4 py-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                ))}
              </div>
              {sideNames.length < MAX_SIDES && (
                <button
                  type="button"
                  onClick={addSide}
                  className="mt-2 px-4 py-2 bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200 transition text-sm font-semibold"
                >
                  + Add Option
                </button>
              )}
              <div className="text-xs text-gray-500 mt-2">
                Each option can be up to {MAX_SIDE_NAME_LENGTH} characters. Names must be unique.
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

            {/* Initial Amount */}
            <div className="mb-6">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Initial Amount (SOL) *
              </label>
              <input
                type="number"
                value={initialAmount}
                onChange={(e) => setInitialAmount(e.target.value)}
                min={MIN_MARKET_CREATION_SOL}
                step="0.1"
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-primary focus:outline-none transition"
                required
              />
              <div className="text-xs text-gray-500 mt-1">
                Minimum {MIN_MARKET_CREATION_SOL} SOL. This will be added to the total pool.
              </div>
            </div>

            {/* Cost Breakdown */}
            <div className="bg-gray-50 rounded-lg p-4 mb-6">
              <h3 className="font-semibold text-gray-900 mb-3">Cost Breakdown</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Initial Amount</span>
                  <span className="font-medium">{initialAmount} SOL</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Creation Fee (2%)</span>
                  <span className="font-medium">{creationFee.toFixed(4)} SOL</span>
                </div>
                <div className="flex justify-between text-xs text-gray-500">
                  <span>Goes to Pool</span>
                  <span>{(parseFloat(initialAmount) - creationFee).toFixed(4)} SOL</span>
                </div>
                <div className="border-t pt-2 flex justify-between">
                  <span className="font-semibold text-gray-900">Total Cost</span>
                  <span className="font-bold text-primary">{totalCost} SOL</span>
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
                    <strong>Winner Takes All:</strong> This market automatically resolves when it ends. 
                    The side with the most SOL wins, and winners split the entire pool proportionally. 
                    Fees are distributed 50/50 between you and the protocol.
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
                `Create Market (${totalCost} SOL)`
              )}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}