'use client';

import { useMemo } from 'react';
import { AnchorProvider, Program, Idl } from '@coral-xyz/anchor';
import { useAnchorWallet, useConnection } from '@solana/wallet-adapter-react';
import { PROGRAM_ID } from '@/lib/constants';

// Import IDL as raw JSON
const IDL_JSON = {
  "address": "2Z7sJer7qW1DJcoZQHJ5i96Gw4LxQqRSpPfd33yVhRVZ",
  "metadata": {
    "name": "prediction_market",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Multi-side winner-takes-all prediction market on Solana"
  },
  "instructions": [
    {
      "name": "initialize_treasury",
      "discriminator": [89, 180, 138, 148, 17, 190, 197, 119],
      "accounts": [
        { "name": "treasury", "writable": true },
        { "name": "authority", "writable": true, "signer": true },
        { "name": "system_program", "address": "11111111111111111111111111111111" }
      ],
      "args": []
    },
    {
      "name": "create_market",
      "discriminator": [103, 226, 97, 235, 200, 188, 251, 254],
      "accounts": [
        { "name": "market", "writable": true },
        { "name": "market_vault", "writable": true },
        { "name": "treasury", "writable": true },
        { "name": "creator_token_account", "writable": true },
        { "name": "usdc_mint" },
        { "name": "creator", "writable": true, "signer": true },
        { "name": "token_program" },
        { "name": "system_program", "address": "11111111111111111111111111111111" },
        { "name": "rent", "address": "SysvarRent111111111111111111111111111111111" }
      ],
      "args": [
        { "name": "question", "type": "string" },
        { "name": "description", "type": "string" },
        { "name": "end_timestamp", "type": "i64" },
        { "name": "side_names", "type": { "vec": "string" } },
        { "name": "initial_amount", "type": "u64" }
      ]
    },
    {
      "name": "place_bet",
      "discriminator": [222, 62, 67, 220, 63, 166, 126, 33],
      "accounts": [
        { "name": "market", "writable": true },
        { "name": "market_vault", "writable": true },
        { "name": "position", "writable": true },
        { "name": "user_token_account", "writable": true },
        { "name": "user", "writable": true, "signer": true },
        { "name": "token_program" },
        { "name": "system_program", "address": "11111111111111111111111111111111" }
      ],
      "args": [
        { "name": "side_index", "type": "u8" },
        { "name": "amount", "type": "u64" }
      ]
    },
    {
      "name": "claim_winnings",
      "discriminator": [161, 215, 24, 59, 14, 236, 242, 221],
      "accounts": [
        { "name": "market", "writable": true },
        { "name": "market_vault", "writable": true },
        { "name": "position", "writable": true },
        { "name": "user_token_account", "writable": true },
        { "name": "user", "writable": true, "signer": true },
        { "name": "token_program" }
      ],
      "args": []
    }
  ],
  "accounts": [
    { "name": "Market", "discriminator": [219, 190, 213, 55, 0, 227, 198, 154] },
    { "name": "Treasury", "discriminator": [238, 239, 123, 238, 89, 1, 168, 253] },
    { "name": "UserPosition", "discriminator": [251, 248, 209, 245, 83, 234, 17, 27] }
  ],
  "errors": [
    { "code": 6000, "name": "MarketEnded", "msg": "Market has ended, trading is closed" },
    { "code": 6001, "name": "MarketNotEnded", "msg": "Market has not ended yet" },
    { "code": 6002, "name": "MarketAlreadyResolved", "msg": "Market has already been resolved" },
    { "code": 6003, "name": "QuestionTooLong", "msg": "Question is too long (max 200 characters)" },
    { "code": 6004, "name": "DescriptionTooLong", "msg": "Description is too long (max 500 characters)" },
    { "code": 6005, "name": "InvalidEndTimestamp", "msg": "End timestamp must be in the future" },
    { "code": 6006, "name": "BetTooSmall", "msg": "Bet amount is below minimum (1 USDC)" },
    { "code": 6007, "name": "BetTooLarge", "msg": "Bet amount exceeds maximum (200 USDC)" },
    { "code": 6008, "name": "NoWinnings", "msg": "No winnings to claim" },
    { "code": 6009, "name": "AlreadyClaimed", "msg": "Winnings already claimed" },
    { "code": 6010, "name": "MathOverflow", "msg": "Math overflow occurred" }
  ],
  "types": [
    {
      "name": "Market",
      "type": {
        "kind": "struct",
        "fields": [
          { "name": "creator", "type": "pubkey" },
          { "name": "question", "type": "string" },
          { "name": "description", "type": "string" },
          { "name": "end_timestamp", "type": "i64" },
          { "name": "resolved", "type": "bool" },
          { "name": "winning_side_index", "type": "u8" },
          { "name": "total_pool", "type": "u64" },
          { "name": "num_sides", "type": "u8" },
          { "name": "sides", "type": { "array": [{ "defined": "Side" }, 10] } },
          { "name": "fee_pool", "type": "u64" },
          { "name": "creator_fees_distributed", "type": "u64" },
          { "name": "protocol_fees_distributed", "type": "u64" },
          { "name": "total_volume", "type": "u64" },
          { "name": "num_bettors", "type": "u32" },
          { "name": "creation_amount", "type": "u64" },
          { "name": "bump", "type": "u8" }
        ]
      }
    },
    {
      "name": "Side",
      "type": {
        "kind": "struct",
        "fields": [
          { "name": "name", "type": { "array": ["u8", 50] } },
          { "name": "name_len", "type": "u8" },
          { "name": "total_amount", "type": "u64" },
          { "name": "num_bettors", "type": "u32" }
        ]
      }
    },
    {
      "name": "UserPosition",
      "type": {
        "kind": "struct",
        "fields": [
          { "name": "user", "type": "pubkey" },
          { "name": "market", "type": "pubkey" },
          { "name": "bets", "type": { "array": [{ "defined": "SideBet" }, 10] } },
          { "name": "total_invested", "type": "u64" },
          { "name": "claimed", "type": "bool" },
          { "name": "bump", "type": "u8" }
        ]
      }
    },
    {
      "name": "SideBet",
      "type": {
        "kind": "struct",
        "fields": [
          { "name": "amount", "type": "u64" },
          { "name": "has_bet", "type": "bool" }
        ]
      }
    }
  ]
} as const;

export function useProgram() {
  const { connection } = useConnection();
  const wallet = useAnchorWallet();

  return useMemo(() => {
    if (!wallet) {
      return null;
    }

    try {
      const provider = new AnchorProvider(connection, wallet, {
        commitment: 'confirmed',
      });

      // Create program with explicit type casting
      const program = new Program(
        IDL_JSON as Idl,
        provider
      );

      return program;
    } catch (error) {
      console.error('Error creating program:', error);
      return null;
    }
  }, [connection, wallet]);
}