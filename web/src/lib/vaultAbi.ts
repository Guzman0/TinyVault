// Generated from out/TinyVault.sol/TinyVault.json
export const vaultAbi = [
 {
  "type": "function",
  "name": "MAX_RESERVE_FEE_BPS",
  "inputs": [],
  "outputs": [
   {
    "name": "",
    "type": "uint16",
    "internalType": "uint16"
   }
  ],
  "stateMutability": "view"
 },
 {
  "type": "function",
  "name": "acceptOwnership",
  "inputs": [],
  "outputs": [],
  "stateMutability": "nonpayable"
 },
 {
  "type": "function",
  "name": "accountOf",
  "inputs": [
   {
    "name": "account",
    "type": "address",
    "internalType": "address"
   }
  ],
  "outputs": [
   {
    "name": "v",
    "type": "tuple",
    "internalType": "struct TinyVault.AccountView",
    "components": [
     {
      "name": "coll",
      "type": "uint256",
      "internalType": "uint256"
     },
     {
      "name": "debt",
      "type": "uint256",
      "internalType": "uint256"
     },
     {
      "name": "ratio",
      "type": "uint256",
      "internalType": "uint256"
     },
     {
      "name": "maxBorrow",
      "type": "uint256",
      "internalType": "uint256"
     },
     {
      "name": "closePrice",
      "type": "uint256",
      "internalType": "uint256"
     }
    ]
   }
  ],
  "stateMutability": "view"
 },
 {
  "type": "function",
  "name": "anchor",
  "inputs": [],
  "outputs": [
   {
    "name": "",
    "type": "address",
    "internalType": "address"
   }
  ],
  "stateMutability": "view"
 },
 {
  "type": "function",
  "name": "borrow",
  "inputs": [
   {
    "name": "amount",
    "type": "uint256",
    "internalType": "uint256"
   },
   {
    "name": "upperHint",
    "type": "address",
    "internalType": "address"
   },
   {
    "name": "lowerHint",
    "type": "address",
    "internalType": "address"
   }
  ],
  "outputs": [],
  "stateMutability": "nonpayable"
 },
 {
  "type": "function",
  "name": "borrowerOps",
  "inputs": [],
  "outputs": [
   {
    "name": "",
    "type": "address",
    "internalType": "contract IBorrowerOperations"
   }
  ],
  "stateMutability": "view"
 },
 {
  "type": "function",
  "name": "closeAccount",
  "inputs": [
   {
    "name": "account",
    "type": "address",
    "internalType": "address"
   },
   {
    "name": "upperHint",
    "type": "address",
    "internalType": "address"
   },
   {
    "name": "lowerHint",
    "type": "address",
    "internalType": "address"
   }
  ],
  "outputs": [],
  "stateMutability": "nonpayable"
 },
 {
  "type": "function",
  "name": "closeBonus",
  "inputs": [],
  "outputs": [
   {
    "name": "",
    "type": "uint256",
    "internalType": "uint256"
   }
  ],
  "stateMutability": "view"
 },
 {
  "type": "function",
  "name": "closeRatio",
  "inputs": [],
  "outputs": [
   {
    "name": "",
    "type": "uint256",
    "internalType": "uint256"
   }
  ],
  "stateMutability": "view"
 },
 {
  "type": "function",
  "name": "closed",
  "inputs": [],
  "outputs": [
   {
    "name": "",
    "type": "bool",
    "internalType": "bool"
   }
  ],
  "stateMutability": "view"
 },
 {
  "type": "function",
  "name": "deposit",
  "inputs": [
   {
    "name": "upperHint",
    "type": "address",
    "internalType": "address"
   },
   {
    "name": "lowerHint",
    "type": "address",
    "internalType": "address"
   }
  ],
  "outputs": [],
  "stateMutability": "payable"
 },
 {
  "type": "function",
  "name": "gainPerShare",
  "inputs": [],
  "outputs": [
   {
    "name": "",
    "type": "uint256",
    "internalType": "uint256"
   }
  ],
  "stateMutability": "view"
 },
 {
  "type": "function",
  "name": "idle",
  "inputs": [],
  "outputs": [
   {
    "name": "",
    "type": "uint256",
    "internalType": "uint256"
   }
  ],
  "stateMutability": "view"
 },
 {
  "type": "function",
  "name": "lossPerShare",
  "inputs": [],
  "outputs": [
   {
    "name": "",
    "type": "uint256",
    "internalType": "uint256"
   }
  ],
  "stateMutability": "view"
 },
 {
  "type": "function",
  "name": "minBorrow",
  "inputs": [],
  "outputs": [
   {
    "name": "",
    "type": "uint256",
    "internalType": "uint256"
   }
  ],
  "stateMutability": "view"
 },
 {
  "type": "function",
  "name": "musd",
  "inputs": [],
  "outputs": [
   {
    "name": "",
    "type": "address",
    "internalType": "contract IERC20"
   }
  ],
  "stateMutability": "view"
 },
 {
  "type": "function",
  "name": "openAnchor",
  "inputs": [
   {
    "name": "debt",
    "type": "uint256",
    "internalType": "uint256"
   },
   {
    "name": "upperHint",
    "type": "address",
    "internalType": "address"
   },
   {
    "name": "lowerHint",
    "type": "address",
    "internalType": "address"
   }
  ],
  "outputs": [],
  "stateMutability": "payable"
 },
 {
  "type": "function",
  "name": "openRatio",
  "inputs": [],
  "outputs": [
   {
    "name": "",
    "type": "uint256",
    "internalType": "uint256"
   }
  ],
  "stateMutability": "view"
 },
 {
  "type": "function",
  "name": "owner",
  "inputs": [],
  "outputs": [
   {
    "name": "",
    "type": "address",
    "internalType": "address"
   }
  ],
  "stateMutability": "view"
 },
 {
  "type": "function",
  "name": "pendingOwner",
  "inputs": [],
  "outputs": [
   {
    "name": "",
    "type": "address",
    "internalType": "address"
   }
  ],
  "stateMutability": "view"
 },
 {
  "type": "function",
  "name": "priceFeed",
  "inputs": [],
  "outputs": [
   {
    "name": "",
    "type": "address",
    "internalType": "contract IPriceFeed"
   }
  ],
  "stateMutability": "view"
 },
 {
  "type": "function",
  "name": "renounceOwnership",
  "inputs": [],
  "outputs": [],
  "stateMutability": "nonpayable"
 },
 {
  "type": "function",
  "name": "repay",
  "inputs": [
   {
    "name": "amount",
    "type": "uint256",
    "internalType": "uint256"
   },
   {
    "name": "upperHint",
    "type": "address",
    "internalType": "address"
   },
   {
    "name": "lowerHint",
    "type": "address",
    "internalType": "address"
   }
  ],
  "outputs": [],
  "stateMutability": "nonpayable"
 },
 {
  "type": "function",
  "name": "reserve",
  "inputs": [],
  "outputs": [
   {
    "name": "",
    "type": "uint256",
    "internalType": "uint256"
   }
  ],
  "stateMutability": "view"
 },
 {
  "type": "function",
  "name": "reserveFeeBps",
  "inputs": [],
  "outputs": [
   {
    "name": "",
    "type": "uint16",
    "internalType": "uint16"
   }
  ],
  "stateMutability": "view"
 },
 {
  "type": "function",
  "name": "setReserveFee",
  "inputs": [
   {
    "name": "bps",
    "type": "uint16",
    "internalType": "uint16"
   }
  ],
  "outputs": [],
  "stateMutability": "nonpayable"
 },
 {
  "type": "function",
  "name": "sync",
  "inputs": [],
  "outputs": [],
  "stateMutability": "nonpayable"
 },
 {
  "type": "function",
  "name": "totalShares",
  "inputs": [],
  "outputs": [
   {
    "name": "",
    "type": "uint256",
    "internalType": "uint256"
   }
  ],
  "stateMutability": "view"
 },
 {
  "type": "function",
  "name": "trackedColl",
  "inputs": [],
  "outputs": [
   {
    "name": "",
    "type": "uint256",
    "internalType": "uint256"
   }
  ],
  "stateMutability": "view"
 },
 {
  "type": "function",
  "name": "transferOwnership",
  "inputs": [
   {
    "name": "newOwner",
    "type": "address",
    "internalType": "address"
   }
  ],
  "outputs": [],
  "stateMutability": "nonpayable"
 },
 {
  "type": "function",
  "name": "troveManager",
  "inputs": [],
  "outputs": [
   {
    "name": "",
    "type": "address",
    "internalType": "contract ITroveManager"
   }
  ],
  "stateMutability": "view"
 },
 {
  "type": "function",
  "name": "vaultDebt",
  "inputs": [],
  "outputs": [
   {
    "name": "",
    "type": "uint256",
    "internalType": "uint256"
   }
  ],
  "stateMutability": "view"
 },
 {
  "type": "function",
  "name": "vaultState",
  "inputs": [],
  "outputs": [
   {
    "name": "v",
    "type": "tuple",
    "internalType": "struct TinyVault.VaultView",
    "components": [
     {
      "name": "troveColl",
      "type": "uint256",
      "internalType": "uint256"
     },
     {
      "name": "troveDebt",
      "type": "uint256",
      "internalType": "uint256"
     },
     {
      "name": "vaultDebt",
      "type": "uint256",
      "internalType": "uint256"
     },
     {
      "name": "ratio",
      "type": "uint256",
      "internalType": "uint256"
     },
     {
      "name": "price",
      "type": "uint256",
      "internalType": "uint256"
     },
     {
      "name": "idle",
      "type": "uint256",
      "internalType": "uint256"
     },
     {
      "name": "reserve",
      "type": "uint256",
      "internalType": "uint256"
     },
     {
      "name": "minNetDebt",
      "type": "uint256",
      "internalType": "uint256"
     },
     {
      "name": "closed",
      "type": "bool",
      "internalType": "bool"
     },
     {
      "name": "anchor",
      "type": "address",
      "internalType": "address"
     }
    ]
   }
  ],
  "stateMutability": "view"
 },
 {
  "type": "function",
  "name": "withdraw",
  "inputs": [
   {
    "name": "amount",
    "type": "uint256",
    "internalType": "uint256"
   },
   {
    "name": "upperHint",
    "type": "address",
    "internalType": "address"
   },
   {
    "name": "lowerHint",
    "type": "address",
    "internalType": "address"
   }
  ],
  "outputs": [],
  "stateMutability": "nonpayable"
 },
 {
  "type": "event",
  "name": "AccountClosed",
  "inputs": [
   {
    "name": "account",
    "type": "address",
    "indexed": true,
    "internalType": "address"
   },
   {
    "name": "closer",
    "type": "address",
    "indexed": true,
    "internalType": "address"
   },
   {
    "name": "debt",
    "type": "uint256",
    "indexed": false,
    "internalType": "uint256"
   },
   {
    "name": "paid",
    "type": "uint256",
    "indexed": false,
    "internalType": "uint256"
   },
   {
    "name": "collSeized",
    "type": "uint256",
    "indexed": false,
    "internalType": "uint256"
   },
   {
    "name": "reserveUsed",
    "type": "uint256",
    "indexed": false,
    "internalType": "uint256"
   },
   {
    "name": "shared",
    "type": "uint256",
    "indexed": false,
    "internalType": "uint256"
   }
  ],
  "anonymous": false
 },
 {
  "type": "event",
  "name": "AnchorOpened",
  "inputs": [
   {
    "name": "anchor",
    "type": "address",
    "indexed": true,
    "internalType": "address"
   },
   {
    "name": "coll",
    "type": "uint256",
    "indexed": false,
    "internalType": "uint256"
   },
   {
    "name": "debt",
    "type": "uint256",
    "indexed": false,
    "internalType": "uint256"
   }
  ],
  "anonymous": false
 },
 {
  "type": "event",
  "name": "Borrowed",
  "inputs": [
   {
    "name": "account",
    "type": "address",
    "indexed": true,
    "internalType": "address"
   },
   {
    "name": "amount",
    "type": "uint256",
    "indexed": false,
    "internalType": "uint256"
   },
   {
    "name": "debtAdded",
    "type": "uint256",
    "indexed": false,
    "internalType": "uint256"
   },
   {
    "name": "reserveFee",
    "type": "uint256",
    "indexed": false,
    "internalType": "uint256"
   }
  ],
  "anonymous": false
 },
 {
  "type": "event",
  "name": "Deposited",
  "inputs": [
   {
    "name": "account",
    "type": "address",
    "indexed": true,
    "internalType": "address"
   },
   {
    "name": "amount",
    "type": "uint256",
    "indexed": false,
    "internalType": "uint256"
   }
  ],
  "anonymous": false
 },
 {
  "type": "event",
  "name": "OwnershipTransferStarted",
  "inputs": [
   {
    "name": "previousOwner",
    "type": "address",
    "indexed": true,
    "internalType": "address"
   },
   {
    "name": "newOwner",
    "type": "address",
    "indexed": true,
    "internalType": "address"
   }
  ],
  "anonymous": false
 },
 {
  "type": "event",
  "name": "OwnershipTransferred",
  "inputs": [
   {
    "name": "previousOwner",
    "type": "address",
    "indexed": true,
    "internalType": "address"
   },
   {
    "name": "newOwner",
    "type": "address",
    "indexed": true,
    "internalType": "address"
   }
  ],
  "anonymous": false
 },
 {
  "type": "event",
  "name": "Redeemed",
  "inputs": [
   {
    "name": "collRemoved",
    "type": "uint256",
    "indexed": false,
    "internalType": "uint256"
   },
   {
    "name": "debtShares",
    "type": "uint256",
    "indexed": false,
    "internalType": "uint256"
   }
  ],
  "anonymous": false
 },
 {
  "type": "event",
  "name": "Redistributed",
  "inputs": [
   {
    "name": "collAdded",
    "type": "uint256",
    "indexed": false,
    "internalType": "uint256"
   },
   {
    "name": "debtShares",
    "type": "uint256",
    "indexed": false,
    "internalType": "uint256"
   }
  ],
  "anonymous": false
 },
 {
  "type": "event",
  "name": "Repaid",
  "inputs": [
   {
    "name": "account",
    "type": "address",
    "indexed": true,
    "internalType": "address"
   },
   {
    "name": "amount",
    "type": "uint256",
    "indexed": false,
    "internalType": "uint256"
   }
  ],
  "anonymous": false
 },
 {
  "type": "event",
  "name": "ReserveFeeUpdated",
  "inputs": [
   {
    "name": "bps",
    "type": "uint16",
    "indexed": false,
    "internalType": "uint16"
   }
  ],
  "anonymous": false
 },
 {
  "type": "event",
  "name": "VaultClosed",
  "inputs": [
   {
    "name": "surplus",
    "type": "uint256",
    "indexed": false,
    "internalType": "uint256"
   }
  ],
  "anonymous": false
 },
 {
  "type": "event",
  "name": "Withdrawn",
  "inputs": [
   {
    "name": "account",
    "type": "address",
    "indexed": true,
    "internalType": "address"
   },
   {
    "name": "amount",
    "type": "uint256",
    "indexed": false,
    "internalType": "uint256"
   }
  ],
  "anonymous": false
 },
 {
  "type": "error",
  "name": "AlreadyOpen",
  "inputs": []
 },
 {
  "type": "error",
  "name": "BadParams",
  "inputs": []
 },
 {
  "type": "error",
  "name": "BelowMinBorrow",
  "inputs": []
 },
 {
  "type": "error",
  "name": "FeeTooHigh",
  "inputs": []
 },
 {
  "type": "error",
  "name": "Healthy",
  "inputs": []
 },
 {
  "type": "error",
  "name": "InsufficientCollateral",
  "inputs": []
 },
 {
  "type": "error",
  "name": "IsClosed",
  "inputs": []
 },
 {
  "type": "error",
  "name": "NoDebt",
  "inputs": []
 },
 {
  "type": "error",
  "name": "NotOpen",
  "inputs": []
 },
 {
  "type": "error",
  "name": "OwnableInvalidOwner",
  "inputs": [
   {
    "name": "owner",
    "type": "address",
    "internalType": "address"
   }
  ]
 },
 {
  "type": "error",
  "name": "OwnableUnauthorizedAccount",
  "inputs": [
   {
    "name": "account",
    "type": "address",
    "internalType": "address"
   }
  ]
 },
 {
  "type": "error",
  "name": "ReentrancyGuardReentrantCall",
  "inputs": []
 },
 {
  "type": "error",
  "name": "SafeERC20FailedOperation",
  "inputs": [
   {
    "name": "token",
    "type": "address",
    "internalType": "address"
   }
  ]
 },
 {
  "type": "error",
  "name": "TransferFailed",
  "inputs": []
 },
 {
  "type": "error",
  "name": "Unhealthy",
  "inputs": []
 },
 {
  "type": "error",
  "name": "ZeroAmount",
  "inputs": []
 }
] as const
