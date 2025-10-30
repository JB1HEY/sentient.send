'use client';

import { useMemo } from 'react';
import type { Idl, Wallet } from '@coral-xyz/anchor';
import { AnchorProvider, Program } from '@coral-xyz/anchor';
import { useAnchorWallet, useConnection } from '@solana/wallet-adapter-react';
import { Keypair } from '@solana/web3.js';
import { IDL } from '@/lib/idl';                    // your generated IDL object
import { PROGRAM_ID } from '@/lib/constants';       // string like 'C3LR...' or PublicKey

export function useProgram() {
  const { connection } = useConnection();
  const wallet = useAnchorWallet();

  return useMemo(() => {
    // Require a real wallet for txs. (You can add a read-only path if you want.)
    if (!wallet?.publicKey) return null;

    // Build Provider
    const provider = new AnchorProvider(connection, wallet as Wallet, {
      commitment: 'confirmed',
    });

    // Your Program ctor expects (idl, provider). It reads programId from idl.address.
    // Ensure the IDL has `.address` set to your program id.
    const idlAny = IDL as any;
    if (!idlAny.address) {
      idlAny.address = typeof PROGRAM_ID === 'string' ? PROGRAM_ID : PROGRAM_ID.toBase58();
    }

    // Cast once to satisfy TS (your IDL is readonly; Anchor's Idl expects mutable arrays)
    const idl = idlAny as unknown as Idl;

    // ✅ Correct for your version: two-arg constructor (idl, provider)
    return new Program(idl, provider);
  }, [connection, wallet]);
}
