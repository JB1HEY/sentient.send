'use client';

import Link from 'next/link';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useConnection } from '@solana/wallet-adapter-react';
import { useProgram } from '@/hooks/useProgram';
import { IDL } from '@/lib/idl';
import { LAMPORTS_PER_SOL } from '@/lib/constants';

interface SearchPreviewMarket {
  publicKey: string;
  question: string;
  numSides: number;
  isActive: boolean;
}

export default function Navbar() {
  const { publicKey } = useWallet();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchPreviewMarket[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [allMarkets, setAllMarkets] = useState<SearchPreviewMarket[]>([]);
  const searchRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const { connection } = useConnection();
  const program = useProgram();

  // Load markets for search
  useEffect(() => {
    loadMarketsForSearch();
  }, [connection]);

  // Handle click outside to close preview
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowPreview(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter markets as user types
  useEffect(() => {
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      const filtered = allMarkets.filter(market => 
        market.question.toLowerCase().includes(query)
      );
      setSearchResults(filtered.slice(0, 5)); // Show max 5 results
      setShowPreview(true);
    } else {
      setSearchResults([]);
      setShowPreview(false);
    }
  }, [searchQuery, allMarkets]);

  async function loadMarketsForSearch() {
    try {
      let programToUse = program;
      
      if (!programToUse) {
        const { AnchorProvider, Program } = await import('@coral-xyz/anchor');
        const { Keypair } = await import('@solana/web3.js');
        
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
      }

      // @ts-ignore
      const marketAccounts = await programToUse.account.market.all();
      
      const markets: SearchPreviewMarket[] = marketAccounts.map(({ publicKey, account }: any) => {
        const market = account as any;
        const endDate = new Date(market.endTimestamp.toNumber() * 1000);
        const isActive = !market.resolved && Date.now() < endDate.getTime();
        
        return {
          publicKey: publicKey.toString(),
          question: market.question,
          numSides: market.numSides,
          isActive,
        };
      }).filter((m: SearchPreviewMarket) => m.isActive);
      
      setAllMarkets(markets);
    } catch (error) {
      console.error('Error loading markets for search:', error);
    }
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/?search=${encodeURIComponent(searchQuery.trim())}`);
      setSearchQuery('');
      setShowPreview(false);
    }
  };

  const handleResultClick = (marketId: string) => {
    router.push(`/market/${marketId}`);
    setSearchQuery('');
    setShowPreview(false);
  };

  return (
    <nav className="bg-dark-card shadow-md border-b border-dark-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link 
            href="/" 
            className="flex items-center space-x-2 hover:opacity-80 transition"
          >
            <img src="/transparent.png" alt="sentient.send" className="h-8 w-8" />
            <span className="text-xl font-bold text-white">
              sentient.send
            </span>
          </Link>

          {/* Center: Search Bar */}
          <div className="hidden md:flex flex-1 max-w-md mx-8" ref={searchRef}>
            <form onSubmit={handleSearch} className="w-full relative">
              <div className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search markets..."
                  className="w-full px-4 py-2 bg-dark-bg border border-dark-border rounded-lg text-white placeholder-dark-muted focus:outline-none focus:border-white transition"
                />
                <button
                  type="submit"
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 text-dark-muted hover:text-white transition"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </button>
              </div>

              {/* Search Preview Dropdown */}
              {showPreview && searchResults.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-dark-card border border-dark-border rounded-lg shadow-xl z-50 max-h-96 overflow-y-auto">
                  {searchResults.map((market) => (
                    <button
                      key={market.publicKey}
                      onClick={() => handleResultClick(market.publicKey)}
                      className="w-full px-4 py-3 text-left hover:bg-dark-bg transition border-b border-dark-border last:border-b-0"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className="text-white font-medium line-clamp-2 text-sm">
                            {market.question}
                          </p>
                          <p className="text-dark-muted text-xs mt-1">
                            {market.numSides} options
                          </p>
                        </div>
                        <svg className="w-4 h-4 text-dark-muted ml-2 mt-1 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </button>
                  ))}
                  {allMarkets.filter(m => m.question.toLowerCase().includes(searchQuery.toLowerCase())).length > 5 && (
                    <button
                      onClick={handleSearch}
                      className="w-full px-4 py-3 text-center text-white hover:bg-dark-bg transition text-sm font-medium"
                    >
                      View all {allMarkets.filter(m => m.question.toLowerCase().includes(searchQuery.toLowerCase())).length} results →
                    </button>
                  )}
                </div>
              )}

              {showPreview && searchQuery.trim() && searchResults.length === 0 && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-dark-card border border-dark-border rounded-lg shadow-xl z-50 px-4 py-6 text-center">
                  <p className="text-dark-muted text-sm">No markets found</p>
                </div>
              )}
            </form>
          </div>

          {/* Right side: Menu Button + Wallet */}
          <div className="flex items-center space-x-4">
            {/* Hamburger Menu Button */}
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="p-2 rounded-lg hover:bg-dark-bg transition"
            >
              <svg 
                className="w-6 h-6 text-dark-text" 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                {isMenuOpen ? (
                  <path 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    strokeWidth={2} 
                    d="M6 18L18 6M6 6l12 12" 
                  />
                ) : (
                  <path 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    strokeWidth={2} 
                    d="M4 6h16M4 12h16M4 18h16" 
                  />
                )}
              </svg>
            </button>

            {/* Wallet Button */}
            <WalletMultiButton className="!bg-white !text-black !rounded-lg !font-semibold !px-4 !py-2 hover:!bg-gray-200 !transition" />
          </div>
        </div>

        {/* Dropdown Menu */}
        {isMenuOpen && (
          <div className="absolute right-4 mt-2 w-56 bg-dark-card rounded-lg shadow-lg border border-dark-border z-50">
            <div className="py-2">
              <Link
                href="/"
                onClick={() => setIsMenuOpen(false)}
                className="block px-4 py-3 text-dark-text hover:bg-dark-bg hover:text-white transition font-medium"
              >
                Markets
              </Link>
              <Link
                href="/create"
                onClick={() => setIsMenuOpen(false)}
                className="block px-4 py-3 text-dark-text hover:bg-dark-bg hover:text-white transition font-medium border-t border-dark-border"
              >
                Create Market
              </Link>
              {publicKey && (
                <Link
                  href="/portfolio"
                  onClick={() => setIsMenuOpen(false)}
                  className="block px-4 py-3 text-dark-text hover:bg-dark-bg hover:text-white transition font-medium border-t border-dark-border"
                >
                  Portfolio
                </Link>
              )}
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}