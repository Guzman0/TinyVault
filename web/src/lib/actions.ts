import { erc20Abi, maxUint256, type Address, type WalletClient } from 'viem'
import { publicClient, waitFor } from './chain'
import { ADDR, mezoTestnet } from './config'
import { hintsFor } from './hints'
import { vaultAbi } from './vaultAbi'

type Step = (s: string) => void
const v = { address: ADDR.vault, abi: vaultAbi, chain: mezoTestnet } as const

async function send(wallet: WalletClient, account: Address, step: Step, label: string, req: Parameters<WalletClient['writeContract']>[0]) {
  step(`Confirm in your wallet: ${label}`)
  // A wallet that signs in the page (the demo) passes its own account; a browser wallet signs by address.
  const signer = wallet.account?.type === 'local' ? wallet.account : account
  // Mezo's re-sorting of troves can cost more by the time a transaction lands than when it was
  // estimated, so every transaction carries a 30% margin over the estimate.
  const call = { ...req, account: signer } as Parameters<WalletClient['writeContract']>[0]
  // Mezo's testnet node sometimes rejects a check for a moment; try once more before giving up.
  const estimate = () => publicClient.estimateContractGas({ ...(call as object), account: signer } as Parameters<typeof publicClient.estimateContractGas>[0])
  let est: bigint
  try {
    est = await estimate()
  } catch (first) {
    await new Promise((r) => setTimeout(r, 1500))
    try { est = await estimate() } catch { throw first }
  }
  let hash: `0x${string}`
  try {
    hash = await wallet.writeContract({ ...call, gas: (est * 13n) / 10n } as Parameters<WalletClient['writeContract']>[0])
  } catch (e) {
    // Mezo accepted this a moment ago, so a "reverted" now comes from the wallet's own check, not
    // from the chain. Some wallets (MetaMask mobile among them) refuse Mezo transactions this way.
    const msg = (e as { shortMessage?: string; message?: string })?.shortMessage ?? (e as Error)?.message ?? ''
    if (!/revert/i.test(msg) || /user rejected|denied/i.test(msg)) throw e
    // MetaMask's mobile app may refuse a transaction that arrives with its gas already set. Try
    // once more and let the wallet work out the gas itself.
    try {
      hash = await wallet.writeContract(call)
    } catch (e2) {
      const m2 = (e2 as { shortMessage?: string; message?: string })?.shortMessage ?? (e2 as Error)?.message ?? ''
      if (/user rejected|denied/i.test(m2)) throw e2
      throw new Error('WALLET_REFUSED')
    }
  }
  step('Waiting for Mezo to confirm')
  await waitFor(hash)
  return hash
}

async function ensureAllowance(wallet: WalletClient, account: Address, amount: bigint, step: Step) {
  const allowance = await publicClient.readContract({ address: ADDR.musd, abi: erc20Abi, functionName: 'allowance', args: [account, ADDR.vault] })
  if (allowance >= amount) return
  await send(wallet, account, step, 'let TinyVault take MUSD for repayments', {
    address: ADDR.musd, abi: erc20Abi, functionName: 'approve', args: [ADDR.vault, maxUint256], chain: mezoTestnet,
  } as never)
}

export async function deposit(w: WalletClient, a: Address, value: bigint, step: Step) {
  const [up, low] = await hintsFor(value, 0n)
  return send(w, a, step, 'deposit BTC', { ...v, functionName: 'deposit', args: [up, low], value } as never)
}

/** `fromTrove`: the part Mezo lends (the rest comes from MUSD the vault already holds). */
export async function borrow(w: WalletClient, a: Address, amount: bigint, fromTrove: bigint, step: Step) {
  const [up, low] = await hintsFor(0n, fromTrove + fromTrove / 1000n) // plus Mezo's 0.1% fee
  return send(w, a, step, 'borrow MUSD', { ...v, functionName: 'borrow', args: [amount, up, low] } as never)
}

export async function repay(w: WalletClient, a: Address, amount: bigint, debt: bigint, step: Step) {
  await ensureAllowance(w, a, amount > debt ? debt + debt / 100n : amount, step)
  const [up, low] = await hintsFor(0n, -(amount > debt ? debt : amount))
  return send(w, a, step, 'repay', { ...v, functionName: 'repay', args: [amount, up, low] } as never)
}

export async function withdraw(w: WalletClient, a: Address, amount: bigint, step: Step) {
  const [up, low] = await hintsFor(-amount, 0n)
  return send(w, a, step, 'withdraw BTC', { ...v, functionName: 'withdraw', args: [amount, up, low] } as never)
}

export const claimMusd = (w: WalletClient, a: Address, step: Step) =>
  send(w, a, step, 'claim MUSD', { ...v, functionName: 'claimMusd', args: [] } as never)

export const shutdown = (w: WalletClient, a: Address, step: Step) =>
  send(w, a, step, 'shut the vault to new loans', { ...v, functionName: 'shutdown', args: [] } as never)

/** Anyone can close the Mezo loan once nobody owes; the caller may top up a few wei of interest. */
export async function closeTrove(w: WalletClient, a: Address, step: Step) {
  await ensureAllowance(w, a, 10n ** 18n, step)
  return send(w, a, step, "close the vault's Mezo loan", { ...v, functionName: 'closeTrove', args: [] } as never)
}

/** `seize`: the BTC the closer is expected to receive (debt plus the bonus, at today's price). */
export async function closeAccount(w: WalletClient, a: Address, target: Address, debt: bigint, seize: bigint, step: Step) {
  await ensureAllowance(w, a, debt + debt / 100n, step)
  const [up, low] = await hintsFor(-seize, -debt)
  return send(w, a, step, 'close the account', { ...v, functionName: 'closeAccount', args: [target, up, low] } as never)
}
