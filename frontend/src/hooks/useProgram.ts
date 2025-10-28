// frontend/src/hooks/useProgram.ts
import { useAnchorWallet, useConnection } from '@solana/wallet-adapter-react';
import { useMemo } from 'react';
import { Program, AnchorProvider } from '@coral-xyz/anchor';
import { PROGRAM_ID } from '../lib/constants';
import { IDL } from '../lib/idl';

export function useProgram() {
  const { connection } = useConnection();
  const wallet = useAnchorWallet();

  const program = useMemo(() => {
    if (!wallet) return null;

    const provider = new AnchorProvider(connection, wallet, {
      commitment: 'confirmed',
    });

    // Cast IDL to any to avoid TypeScript errors
    return new Program(IDL as any, provider);
  }, [connection, wallet]);

  return program;
}