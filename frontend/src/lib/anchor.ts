import { Program, AnchorProvider } from '@coral-xyz/anchor';
import { Connection, PublicKey } from '@solana/web3.js';
import { AnchorWallet } from '@solana/wallet-adapter-react';
import { PROGRAM_ID, RPC_ENDPOINT } from './constants';
import { sha256 } from '@noble/hashes/sha2';
import { IDL } from './idl';

export function getProgram(wallet: AnchorWallet) {
  const connection = new Connection(RPC_ENDPOINT, 'confirmed');
  const provider = new AnchorProvider(connection, wallet, {
    commitment: 'confirmed',
  });
  
  // Anchor 0.30+ uses: new Program(IDL, provider)
  return new Program(IDL as any, provider);
}

export function getConnection() {
  return new Connection(RPC_ENDPOINT, 'confirmed');
}

// Helper to derive market PDA
export function getMarketPda(creator: PublicKey, question: string) {
  const questionSeed = sha256(new TextEncoder().encode(question));
  
  const [marketPda] = PublicKey.findProgramAddressSync(
    [
      Buffer.from('market'),
      creator.toBuffer(),
      Buffer.from(questionSeed),
    ],
    PROGRAM_ID
  );
  
  return { marketPda, questionSeed: Array.from(questionSeed) };
}

// Helper to derive position PDA
export function getPositionPda(market: PublicKey, user: PublicKey) {
  const [positionPda] = PublicKey.findProgramAddressSync(
    [
      Buffer.from('position'),
      market.toBuffer(),
      user.toBuffer(),
    ],
    PROGRAM_ID
  );
  
  return positionPda;
}

// Helper to derive treasury PDA
export function getTreasuryPda() {
  const [treasuryPda] = PublicKey.findProgramAddressSync(
    [Buffer.from('treasury')],
    PROGRAM_ID
  );
  
  return treasuryPda;
}