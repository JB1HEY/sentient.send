import { Program, AnchorProvider } from '@coral-xyz/anchor';
import { Connection, PublicKey } from '@solana/web3.js';
import { AnchorWallet } from '@solana/wallet-adapter-react';
import { PROGRAM_ID, RPC_ENDPOINT } from './constants';
import { IDL } from './idl';

export function getProgram(wallet: AnchorWallet) {
  const connection = new Connection(RPC_ENDPOINT, 'confirmed');
  const provider = new AnchorProvider(connection, wallet, {
    commitment: 'confirmed',
  });
  
  return new Program(IDL as any, provider);
}

export function getConnection() {
  return new Connection(RPC_ENDPOINT, 'confirmed');
}

// Helper to derive market PDA
export function getMarketPda(creator: PublicKey, question: string) {
  const [marketPda, bump] = PublicKey.findProgramAddressSync(
    [
      Buffer.from('market'),
      creator.toBuffer(),
      Buffer.from(question),
    ],
    PROGRAM_ID
  );
  
  return { marketPda, bump };
}

// Helper to derive position PDA
export function getPositionPda(market: PublicKey, user: PublicKey) {
  const [positionPda, bump] = PublicKey.findProgramAddressSync(
    [
      Buffer.from('position'),
      market.toBuffer(),
      user.toBuffer(),
    ],
    PROGRAM_ID
  );
  
  return { positionPda, bump };
}

// Helper to derive treasury PDA
export function getTreasuryPda() {
  const [treasuryPda, bump] = PublicKey.findProgramAddressSync(
    [Buffer.from('treasury')],
    PROGRAM_ID
  );
  
  return { treasuryPda, bump };
}

// Helper to decode side name from byte array
export function decodeSideName(nameBytes: number[], nameLen: number): string {
  const bytes = nameBytes.slice(0, nameLen);
  return new TextDecoder().decode(new Uint8Array(bytes));
}