'use client';

import Link from 'next/link';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { useState } from 'react';

export default function Navbar() {
  const { publicKey } = useWallet();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

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
                  💼 Portfolio
                </Link>
              )}
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}