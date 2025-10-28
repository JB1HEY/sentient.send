export const IDL = {
  "address": "2Z7sJer7qW1DJcoZQHJ5i96Gw4LxQqRSpPfd33yVhRVZ",
  "metadata": {
    "name": "prediction_market",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Decentralized sentiment-based prediction market on Solana"
  },
  "instructions": [
    {
      "name": "add_liquidity",
      "discriminator": [181, 157, 89, 67, 143, 182, 52, 72],
      "accounts": [
        { "name": "market", "writable": true },
        { "name": "liquidity_provider", "writable": true, "signer": true },
        { "name": "system_program", "address": "11111111111111111111111111111111" }
      ],
      "args": [
        { "name": "amount", "type": "u64" }
      ]
    },
    {
      "name": "claim_winnings",
      "discriminator": [161, 215, 24, 59, 14, 236, 242, 221],
      "accounts": [
        { "name": "market", "writable": true },
        { "name": "position", "writable": true },
        { "name": "user", "writable": true, "signer": true },
        { "name": "system_program", "address": "11111111111111111111111111111111" }
      ],
      "args": []
    },
    {
      "name": "create_market",
      "discriminator": [103, 226, 97, 235, 200, 188, 251, 254],
      "accounts": [
        { "name": "market", "writable": true },
        { "name": "treasury", "writable": true },
        { "name": "creator", "writable": true, "signer": true },
        { "name": "system_program", "address": "11111111111111111111111111111111" }
      ],
      "args": [
        { "name": "question", "type": "string" },
        { "name": "description", "type": "string" },
        { "name": "end_timestamp", "type": "i64" },
        { "name": "initial_liquidity", "type": "u64" },
        { "name": "question_seed", "type": { "array": ["u8", 32] } }
      ]
    },
    {
      "name": "place_bet",
      "discriminator": [222, 62, 67, 220, 63, 166, 126, 33],
      "accounts": [
        { "name": "market", "writable": true },
        { "name": "position", "writable": true },
        { "name": "user", "writable": true, "signer": true },
        { "name": "system_program", "address": "11111111111111111111111111111111" }
      ],
      "args": [
        { "name": "amount", "type": "u64" },
        { "name": "is_yes", "type": "bool" }
      ]
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
    { "code": 6003, "name": "InsufficientFunds", "msg": "Insufficient funds for this bet" },
    { "code": 6004, "name": "QuestionTooLong", "msg": "Question is too long (max 200 characters)" },
    { "code": 6005, "name": "DescriptionTooLong", "msg": "Description is too long (max 500 characters)" },
    { "code": 6006, "name": "InvalidEndTimestamp", "msg": "End timestamp must be in the future" },
    { "code": 6007, "name": "BetTooSmall", "msg": "Bet amount is too small (minimum 0.01 SOL)" },
    { "code": 6008, "name": "NoWinnings", "msg": "No winnings to claim" },
    { "code": 6009, "name": "AlreadyClaimed", "msg": "Winnings already claimed" },
    { "code": 6010, "name": "MathOverflow", "msg": "Math overflow occurred" },
    { "code": 6011, "name": "LiquidityTooSmall", "msg": "Initial liquidity too small (minimum 1 SOL)" },
    { "code": 6012, "name": "InvalidPoolState", "msg": "Invalid pool state" }
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
          { "name": "outcome", "type": "bool" },
          { "name": "yes_pool", "type": "u64" },
          { "name": "no_pool", "type": "u64" },
          { "name": "k", "type": "u128" },
          { "name": "total_yes_shares", "type": "u64" },
          { "name": "total_no_shares", "type": "u64" },
          { "name": "treasury_fee", "type": "u64" },
          { "name": "creation_fee", "type": "u64" },
          { "name": "total_volume", "type": "u64" },
          { "name": "num_bettors", "type": "u32" },
          { "name": "bump", "type": "u8" },
          { "name": "question_hash", "type": { "array": ["u8", 32] } }
        ]
      }
    },
    {
      "name": "Treasury",
      "type": {
        "kind": "struct",
        "fields": [
          { "name": "authority", "type": "pubkey" },
          { "name": "total_fees", "type": "u64" },
          { "name": "total_markets", "type": "u32" },
          { "name": "total_volume", "type": "u64" },
          { "name": "bump", "type": "u8" }
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
          { "name": "yes_shares", "type": "u64" },
          { "name": "no_shares", "type": "u64" },
          { "name": "amount_invested", "type": "u64" },
          { "name": "claimed", "type": "bool" },
          { "name": "bump", "type": "u8" }
        ]
      }
    }
  ]
} as const;