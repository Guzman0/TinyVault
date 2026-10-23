import { createPublicClient, createWalletClient, custom, http, type Address, type Hash, type WalletClient } from 'viem'
import { mezoTestnet } from './config'

export const publicClient = createPublicClient({ chain: mezoTestnet, transport: http() })

type Eip1193 = { request: (args: { method: string; params?: unknown[] }) => Promise<unknown>; on?: (e: string, cb: (...a: unknown[]) => void) => void }

function provider(): Eip1193 | undefined {
  return (window as unknown as { ethereum?: Eip1193 }).ethereum
}

export function hasWallet() {
  return !!provider()
}

export function onWalletChange(cb: () => void) {
  const p = provider()
  p?.on?.('accountsChanged', cb)
  p?.on?.('chainChanged', cb)
}

export async function connectWallet(): Promise<{ account: Address; wallet: WalletClient }> {
  const p = provider()
  if (!p) throw new Error('No wallet found. Install MetaMask or Rabby, then reload this page.')
  const accounts = (await p.request({ method: 'eth_requestAccounts' })) as Address[]
  await ensureMezo(p)
  return { account: accounts[0], wallet: createWalletClient({ chain: mezoTestnet, transport: custom(p), account: accounts[0] }) }
}

export async function existingAccount(): Promise<{ account: Address; wallet: WalletClient } | null> {
  const p = provider()
  if (!p) return null
  const accounts = (await p.request({ method: 'eth_accounts' })) as Address[]
  if (!accounts.length) return null
  return { account: accounts[0], wallet: createWalletClient({ chain: mezoTestnet, transport: custom(p), account: accounts[0] }) }
}

async function ensureMezo(p: Eip1193) {
  const hexId = `0x${mezoTestnet.id.toString(16)}`
  const current = (await p.request({ method: 'eth_chainId' })) as string
  if (current?.toLowerCase() === hexId) return
  try {
    await p.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: hexId }] })
  } catch {
    await p.request({
      method: 'wallet_addEthereumChain',
      params: [{
        chainId: hexId,
        chainName: mezoTestnet.name,
        nativeCurrency: mezoTestnet.nativeCurrency,
        rpcUrls: mezoTestnet.rpcUrls.default.http,
        blockExplorerUrls: [mezoTestnet.blockExplorers.default.url],
      }],
    })
  }
}

export async function waitFor(hash: Hash) {
  const receipt = await publicClient.waitForTransactionReceipt({ hash })
  if (receipt.status !== 'success') throw new Error('The transaction failed on chain.')
  return receipt
}

export const explorerTx = (h: string) => `${mezoTestnet.blockExplorers.default.url}/tx/${h}`
export const explorerAddress = (a: string) => `${mezoTestnet.blockExplorers.default.url}/address/${a}`
