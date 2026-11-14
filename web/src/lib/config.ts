import { defineChain, type Address } from 'viem'

export const mezoTestnet = defineChain({
  id: 31611,
  name: 'Mezo Testnet',
  nativeCurrency: { name: 'Bitcoin', symbol: 'BTC', decimals: 18 },
  rpcUrls: { default: { http: ['https://rpc.test.mezo.org'] } },
  blockExplorers: { default: { name: 'Mezo Explorer', url: 'https://explorer.test.mezo.org' } },
  testnet: true,
})

const env = import.meta.env

export const DEFAULT_VAULT = (env.VITE_VAULT_ADDRESS || '0x7e98760E75a14e0095A2BE38Ff99D5A231678c11') as Address
/** The Wave 1 vault, kept reachable so its accounts can repay and withdraw: open the app with ?vault=wave1. */
export const WAVE1_VAULT = '0x8724a13AfAF230311AC0f69e5979f42058EF248b' as Address

/**
 * The stress-test vault: same contract, tight settings (borrow to 116.5%, close below 115%), its
 * Mezo loan kept at the low end of Mezo's list so that keeper closes, refinances and Mezo
 * redemptions happen within hours on testnet. Open the app with ?vault=stress.
 */
export const STRESS_VAULT = (env.VITE_STRESS_VAULT || '0x41b230d37bB10cc005803CD780357d24Ae162731') as Address | ''
const STRESS_BLOCK = env.VITE_STRESS_BLOCK || '16781176'

const query = typeof window === 'undefined' ? new URLSearchParams() : new URLSearchParams(window.location.search)
const asked = query.get('vault')
const picked = asked === 'wave1' ? WAVE1_VAULT : asked === 'stress' && STRESS_VAULT ? STRESS_VAULT : asked && /^0x[0-9a-fA-F]{40}$/.test(asked) ? (asked as Address) : DEFAULT_VAULT

export const ADDR = {
  vault: picked,
  musd: '0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503' as Address,
  borrowerOps: '0xCdF7028ceAB81fA0C6971208e83fa7872994beE5' as Address,
  troveManager: '0xE47c80e8c23f6B4A1aE41c34837a0599D5D16bb0' as Address,
  sortedTroves: '0x722E4D24FD6Ff8b0AC679450F3D91294607268fA' as Address,
  hintHelpers: '0x4e4cBA3779d56386ED43631b4dCD6d8EacEcBCF6' as Address,
}

/** Block the vault was deployed in; event scans start here. */
export const IS_STRESS = !!STRESS_VAULT && picked.toLowerCase() === STRESS_VAULT.toLowerCase()
export const DEPLOY_BLOCK = picked.toLowerCase() === WAVE1_VAULT.toLowerCase()
  ? 16325664n
  : IS_STRESS ? BigInt(query.get('from') || STRESS_BLOCK)
  : BigInt(query.get('from') || env.VITE_DEPLOY_BLOCK || '16719053')
/** An old vault: repay and withdraw only. The stress vault takes deposits and loans like the main one. */
export const OTHER_VAULT = picked.toLowerCase() !== DEFAULT_VAULT.toLowerCase() && !IS_STRESS

export const ZERO = '0x0000000000000000000000000000000000000000' as Address
