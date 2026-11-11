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

export const ADDR = {
  vault: (env.VITE_VAULT_ADDRESS || '0x7e98760E75a14e0095A2BE38Ff99D5A231678c11') as Address,
  musd: '0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503' as Address,
  borrowerOps: '0xCdF7028ceAB81fA0C6971208e83fa7872994beE5' as Address,
}

/** Block the vault was deployed in; event scans start here. */
export const DEPLOY_BLOCK = BigInt(env.VITE_DEPLOY_BLOCK || '16719053')

export const ZERO = '0x0000000000000000000000000000000000000000' as Address
