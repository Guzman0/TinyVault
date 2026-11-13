import { createWalletClient, http, type Hash } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { ADDR, mezoTestnet } from './config'
import { publicClient } from './chain'
import { loadAccount, loadParams, loadVault } from './data'
import { borrow, deposit, repay, withdraw } from './actions'

// A testnet-only demo wallet, public on purpose: this site has no server, so the page signs the
// demo's transactions itself. It only ever holds a few dollars of testnet BTC and MUSD. If someone
// empties it, the demo stops until it is topped up; nothing else is at risk.
const DEMO_KEY = '0x14cf497398ce4f30ab9ba5420836d082715ecb710d2a783fec0a3dfea3bdfef6'
export const demoAccount = privateKeyToAccount(DEMO_KEY)
export const DEMO_ADDRESS = demoAccount.address
const demoWallet = createWalletClient({ account: demoAccount, chain: mezoTestnet, transport: http() })

export const DEMO_BTC = 10n ** 15n // 0.001 BTC
export const DEMO_MUSD = 10n * 10n ** 18n // the vault's smallest loan

export type DemoStep = { label: string; state: 'waiting' | 'running' | 'done' | 'failed'; note?: string; hash?: Hash }

const erc20 = [{ type: 'function', name: 'balanceOf', stateMutability: 'view', inputs: [{ name: 'a', type: 'address' }], outputs: [{ type: 'uint256' }] }] as const

export async function demoBalances() {
  const [btc, musd] = await Promise.all([
    publicClient.getBalance({ address: DEMO_ADDRESS }),
    publicClient.readContract({ address: ADDR.musd, abi: erc20, functionName: 'balanceOf', args: [DEMO_ADDRESS] }),
  ])
  return { btc, musd }
}

/**
 * One full loan from the demo wallet: add BTC, borrow MUSD, repay everything, take the BTC back.
 * If an earlier run stopped half way (a closed tab), it is finished first.
 */
export async function runDemo(update: (steps: DemoStep[]) => void) {
  const steps: DemoStep[] = [
    { label: 'Add 0.001 BTC to the vault', state: 'waiting' },
    { label: 'Borrow 10 MUSD against it', state: 'waiting' },
    { label: 'Repay the loan and its fees', state: 'waiting' },
    { label: 'Take the 0.001 BTC back', state: 'waiting' },
  ]
  const show = () => update(steps.map((s) => ({ ...s })))
  const run = async (i: number, f: (note: (s: string) => void) => Promise<Hash>) => {
    steps[i].state = 'running'; show()
    try {
      steps[i].hash = await f((s) => { steps[i].note = s.replace('Confirm in your wallet: ', 'Signing: '); show() })
      steps[i].state = 'done'; steps[i].note = undefined; show()
    } catch (e) {
      steps[i].state = 'failed'; show()
      throw e
    }
  }

  const { btc, musd } = await demoBalances()
  if (btc < DEMO_BTC * 12n / 10n || musd < 10n ** 18n) {
    throw new Error('The demo wallet needs a top-up of testnet BTC or MUSD. Try again later.')
  }
  const a = DEMO_ADDRESS
  const before = await loadAccount(a)
  if (before.debt > 0n) await repay(demoWallet, a, 2n ** 255n, before.debt, () => {})
  if (before.coll > 0n) await withdraw(demoWallet, a, (await loadAccount(a)).coll, () => {})

  await run(0, (n) => deposit(demoWallet, a, DEMO_BTC, n))
  const [p, v] = await Promise.all([loadParams(), loadVault()])
  const need = DEMO_MUSD + DEMO_MUSD * BigInt(p.reserveFeeBps) / 10_000n
  await run(1, (n) => borrow(demoWallet, a, DEMO_MUSD, need > v.idle ? need - v.idle : 0n, n))
  const owed = (await loadAccount(a)).debt
  steps[2].label = `Repay the loan and its fees, ${(Number(owed) / 1e18).toFixed(2)} MUSD`
  await run(2, (n) => repay(demoWallet, a, 2n ** 255n, owed, n))
  await run(3, async (n) => withdraw(demoWallet, a, (await loadAccount(a)).coll, n))
  return steps
}
