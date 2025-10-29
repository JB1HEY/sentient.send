export const IDL = {
  "address": "C3LRoEztvLPioY3ruddYGTT9qxzvqBivHzgmpGJuQ9CT",
  "metadata": {
    "name": "prediction_market",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Decentralized prediction market on Solana"
  },
  "instructions": [
    {
      "name": "claim_winnings",
      "discriminator": [161, 215, 24, 59, 14, 236, 242, 221],
      "accounts": [
        {
          "name": "market",
          "writable": true
        },
        {
          "name": "position",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [112, 111, 115, 105, 116, 105, 111, 110]
              },
              {
                "kind": "account",
                "path": "market"
              },
              {
                "kind": "account",
                "path": "user"
              }
            ]
          }
        },
        {
          "name": "user",
          "writable": true,
          "signer": true
        }
      ],
      "args": []
    },
    {
      "name": "create_market",
      "discriminator": [103, 226, 97, 235, 200, 188, 251, 254],
      "accounts": [
        {
          "name": "market",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [109, 97, 114, 107, 101, 116]
              },
              {
                "kind": "account",
                "path": "creator"
              },
              {
                "kind": "arg",
                "path": "question"
              }
            ]
          }
        },
        {
          "name": "position",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [112, 111, 115, 105, 116, 105, 111, 110]
              },
              {
                "kind": "account",
                "path": "market"
              },
              {
                "kind": "account",
                "path": "creator"
              }
            ]
          }
        },
        {
          "name": "treasury",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [116, 114, 101, 97, 115, 117, 114, 121]
              }
            ]
          }
        },
        {
          "name": "creator",
          "writable": true,
          "signer": true
        },
        {
          "name": "system_program",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "question",
          "type": "string"
        },
        {
          "name": "description",
          "type": "string"
        },
        {
          "name": "end_timestamp",
          "type": "i64"
        },
        {
          "name": "side_names",
          "type": {
            "vec": "string"
          }
        },
        {
          "name": "initial_amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "initialize_treasury",
      "discriminator": [124, 186, 211, 195, 85, 165, 129, 166],
      "accounts": [
        {
          "name": "treasury",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [116, 114, 101, 97, 115, 117, 114, 121]
              }
            ]
          }
        },
        {
          "name": "authority",
          "writable": true,
          "signer": true
        },
        {
          "name": "system_program",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "place_bet",
      "discriminator": [222, 62, 67, 220, 63, 166, 126, 33],
      "accounts": [
        {
          "name": "market",
          "writable": true
        },
        {
          "name": "position",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [112, 111, 115, 105, 116, 105, 111, 110]
              },
              {
                "kind": "account",
                "path": "market"
              },
              {
                "kind": "account",
                "path": "user"
              }
            ]
          }
        },
        {
          "name": "user",
          "writable": true,
          "signer": true
        },
        {
          "name": "system_program",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "side_index",
          "type": "u8"
        },
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "withdraw_creator_fees",
      "discriminator": [8, 30, 213, 18, 121, 105, 129, 222],
      "accounts": [
        {
          "name": "market",
          "writable": true
        },
        {
          "name": "treasury",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [116, 114, 101, 97, 115, 117, 114, 121]
              }
            ]
          }
        },
        {
          "name": "creator",
          "writable": true,
          "signer": true
        }
      ],
      "args": []
    },
    {
      "name": "withdraw_protocol_fees",
      "discriminator": [11, 68, 165, 98, 18, 208, 134, 73],
      "accounts": [
        {
          "name": "market",
          "writable": true
        },
        {
          "name": "treasury",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [116, 114, 101, 97, 115, 117, 114, 121]
              }
            ]
          }
        },
        {
          "name": "protocol_authority",
          "writable": true,
          "signer": true
        }
      ],
      "args": []
    }
  ],
  "accounts": [
    {
      "name": "Market",
      "discriminator": [219, 190, 213, 55, 0, 227, 198, 154]
    },
    {
      "name": "Treasury",
      "discriminator": [238, 239, 123, 238, 89, 1, 168, 253]
    },
    {
      "name": "UserPosition",
      "discriminator": [251, 248, 209, 245, 83, 234, 17, 27]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "MarketEnded",
      "msg": "Market has ended, trading is closed"
    },
    {
      "code": 6001,
      "name": "MarketNotEnded",
      "msg": "Market has not ended yet"
    },
    {
      "code": 6002,
      "name": "MarketAlreadyResolved",
      "msg": "Market has already been resolved"
    },
    {
      "code": 6003,
      "name": "QuestionTooLong",
      "msg": "Question is too long (max 200 characters)"
    },
    {
      "code": 6004,
      "name": "DescriptionTooLong",
      "msg": "Description is too long (max 500 characters)"
    },
    {
      "code": 6005,
      "name": "InvalidEndTimestamp",
      "msg": "End timestamp must be in the future"
    },
    {
      "code": 6006,
      "name": "BetTooSmall",
      "msg": "Bet amount is below minimum (0.01 SOL)"
    },
    {
      "code": 6007,
      "name": "BetTooLarge",
      "msg": "Bet amount exceeds maximum (1 SOL)"
    },
    {
      "code": 6008,
      "name": "NoWinnings",
      "msg": "No winnings to claim"
    },
    {
      "code": 6009,
      "name": "AlreadyClaimed",
      "msg": "Winnings already claimed"
    },
    {
      "code": 6010,
      "name": "MathOverflow",
      "msg": "Math overflow occurred"
    },
    {
      "code": 6011,
      "name": "CreationAmountTooSmall",
      "msg": "Market creation amount too small (minimum 1 SOL)"
    },
    {
      "code": 6012,
      "name": "InvalidSideIndex",
      "msg": "Invalid side index"
    },
    {
      "code": 6013,
      "name": "InvalidSideCount",
      "msg": "Invalid number of sides (must be 2-10)"
    },
    {
      "code": 6014,
      "name": "SideNameTooLong",
      "msg": "Side name is too long (max 50 characters)"
    },
    {
      "code": 6015,
      "name": "DuplicateSideName",
      "msg": "Duplicate side names not allowed"
    },
    {
      "code": 6016,
      "name": "UnauthorizedResolver",
      "msg": "Only market creator can resolve"
    }
  ],
  "types": [
    {
      "name": "Market",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "creator",
            "type": "pubkey"
          },
          {
            "name": "question",
            "type": "string"
          },
          {
            "name": "description",
            "type": "string"
          },
          {
            "name": "end_timestamp",
            "type": "i64"
          },
          {
            "name": "resolved",
            "type": "bool"
          },
          {
            "name": "winning_side_index",
            "type": "u8"
          },
          {
            "name": "total_pool",
            "type": "u64"
          },
          {
            "name": "num_sides",
            "type": "u8"
          },
          {
            "name": "sides",
            "type": {
              "array": [
                {
                  "defined": {
                    "name": "Side"
                  }
                },
                10
              ]
            }
          },
          {
            "name": "fee_pool",
            "type": "u64"
          },
          {
            "name": "creator_fees_distributed",
            "type": "u64"
          },
          {
            "name": "protocol_fees_distributed",
            "type": "u64"
          },
          {
            "name": "total_volume",
            "type": "u64"
          },
          {
            "name": "num_bettors",
            "type": "u32"
          },
          {
            "name": "creation_amount",
            "type": "u64"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "Side",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "name",
            "type": {
              "array": ["u8", 50]
            }
          },
          {
            "name": "name_len",
            "type": "u8"
          },
          {
            "name": "total_amount",
            "type": "u64"
          },
          {
            "name": "num_bettors",
            "type": "u32"
          }
        ]
      }
    },
    {
      "name": "SideBet",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "has_bet",
            "type": "bool"
          }
        ]
      }
    },
    {
      "name": "Treasury",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "authority",
            "type": "pubkey"
          },
          {
            "name": "total_protocol_fees",
            "type": "u64"
          },
          {
            "name": "total_creator_fees",
            "type": "u64"
          },
          {
            "name": "total_markets",
            "type": "u32"
          },
          {
            "name": "total_volume",
            "type": "u64"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "UserPosition",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "user",
            "type": "pubkey"
          },
          {
            "name": "market",
            "type": "pubkey"
          },
          {
            "name": "bets",
            "type": {
              "array": [
                {
                  "defined": {
                    "name": "SideBet"
                  }
                },
                10
              ]
            }
          },
          {
            "name": "total_invested",
            "type": "u64"
          },
          {
            "name": "claimed",
            "type": "bool"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    }
  ]
} as const;

export type PredictionMarketIDL = typeof IDL;