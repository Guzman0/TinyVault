import { createPublicClient, createWalletClient, custom, http, type Address, type Hash, type WalletClient } from 'viem'
import { mezoTestnet } from './config'

// Contract reads made together go through Multicall3 as one request: on a phone, one round trip
// instead of thirty is most of the wait. Log scans stay separate requests, which Mezo's RPC
// answers in parallel; batched into one, it answers them one after another.
export const publicClient = createPublicClient({
  chain: mezoTestnet,
  transport: http(),
  batch: { multicall: { wait: 16 } },
})

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
  if (!p) throw new Error('No wallet found. On a computer, install MetaMask or Rabby and reload. On a phone, open this page in your wallet app\'s browser.')
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

/** One tap: switch the wallet to Mezo Testnet, adding the network first if the wallet lacks it. */
export async function addMezo() {
  const p = provider()
  if (!p) throw new Error('No wallet found. On a computer, install MetaMask or Rabby and reload. On a phone, open this page in your wallet app\'s browser.')
  await ensureMezo(p)
}

/** True when the wallet is on Mezo Testnet, false when on another network, null with no wallet. */
export async function onMezo(): Promise<boolean | null> {
  const p = provider()
  if (!p) return null
  try {
    const id = (await p.request({ method: 'eth_chainId' })) as string
    return id?.toLowerCase() === `0x${mezoTestnet.id.toString(16)}`
  } catch {
    return null
  }
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
