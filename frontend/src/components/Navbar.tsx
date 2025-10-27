'use client';

import Link from 'next/link';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';

export default function Navbar() {
  return (
    <nav className="bg-gradient-main shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center space-x-2">
            <span className="text-2xl font-bold text-white">🎯 FuSwap</span>
          </Link>

          {/* Navigation Links */}
          <div className="hidden md:flex space-x-8">
            <Link 
              href="/" 
              className="text-white hover:text-gray-200 transition px-3 py-2 rounded-md text-sm font-medium"
            >
              Markets
            </Link>
            <Link 
              href="/create" 
              className="text-white hover:text-gray-200 transition px-3 py-2 rounded-md text-sm font-medium"
            >
              Create Market
            </Link>
            <Link 
              href="/portfolio" 
              className="text-white hover:text-gray-200 transition px-3 py-2 rounded-md text-sm font-medium"
            >
              Portfolio
            </Link>
          </div>

          {/* Wallet Button */}
          <div className="flex items-center">
            <WalletMultiButton className="!bg-white !text-primary hover:!bg-gray-100" />
          </div>
        </div>
      </div>

      {/* Mobile Navigation */}
      <div className="md:hidden px-4 pb-3 space-y-1">
        <Link 
          href="/" 
          className="block text-white hover:bg-white/10 px-3 py-2 rounded-md text-base font-medium"
        >
          Markets
        </Link>
        <Link 
          href="/create" 
          className="block text-white hover:bg-white/10 px-3 py-2 rounded-md text-base font-medium"
        >
          Create Market
        </Link>
        <Link 
          href="/portfolio" 
          className="block text-white hover:bg-white/10 px-3 py-2 rounded-md text-base font-medium"
        >
          Portfolio
        </Link>
      </div>
    </nav>
  );
}