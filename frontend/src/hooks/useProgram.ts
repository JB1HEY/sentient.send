'use client';

import { useMemo } from 'react';
import { AnchorProvider, Program } from '@coral-xyz/anchor';
import { useAnchorWallet, useConnection } from '@solana/wallet-adapter-react';
import { IDL } from '@/lib/idl';
import { PROGRAM_ID } from '@/lib/constants';

export function useProgram() {
  const { connection } = useConnection();
  const wallet = useAnchorWallet();

  return useMemo(() => {
    console.log('=== useProgram Called ===');
    console.log('1. Wallet exists?', !!wallet);
    console.log('2. Wallet publicKey?', wallet?.publicKey?.toString());
    console.log('3. Connection?', !!connection);
    
    if (!wallet) {
      console.log('❌ No wallet - returning null');
      return null;
    }

    if (!wallet.publicKey) {
      console.log('❌ Wallet has no publicKey - returning null');
      return null;
    }

    try {
      console.log('4. Creating AnchorProvider...');
      const provider = new AnchorProvider(
        connection,
        wallet,
        { commitment: 'confirmed' }
      );
      console.log('✅ Provider created');

      console.log('5. Creating Program with IDL...');
      console.log('   Program ID:', PROGRAM_ID.toString());
      
      // @ts-ignore - IDL typing is complex, using any for now
      const program = new Program(IDL, provider);
      console.log('✅ Program created successfully!');
      console.log('   Program ID from object:', program.programId.toString());

      return program;
    } catch (error) {
      console.error('❌ Error creating program:', error);
      return null;
    }
  }, [connection, wallet]);
}