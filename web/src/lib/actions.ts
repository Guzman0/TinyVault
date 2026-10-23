import { erc20Abi, maxUint256, type Address, type WalletClient } from 'viem'
import { publicClient, waitFor } from './chain'
import { ADDR, ZERO, mezoTestnet } from './config'
import { vaultAbi } from './vaultAbi'

type Step = (s: string) => void
const v = { address: ADDR.vault, abi: vaultAbi, chain: mezoTestnet } as const

async function send(wallet: WalletClient, account: Address, step: Step, label: string, req: Parameters<WalletClient['writeContract']>[0]) {
  step(`Confirm in your wallet: ${label}`)
  const hash = await wallet.writeContract({ ...req, account } as Parameters<WalletClient['writeContract']>[0])
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

export const deposit = (w: WalletClient, a: Address, value: bigint, step: Step) =>
  send(w, a, step, 'deposit BTC', { ...v, functionName: 'deposit', args: [ZERO, ZERO], value } as never)

export const borrow = (w: WalletClient, a: Address, amount: bigint, step: Step) =>
  send(w, a, step, 'borrow MUSD', { ...v, functionName: 'borrow', args: [amount, ZERO, ZERO] } as never)

export async function repay(w: WalletClient, a: Address, amount: bigint, step: Step) {
  await ensureAllowance(w, a, amount, step)
  return send(w, a, step, 'repay', { ...v, functionName: 'repay', args: [amount, ZERO, ZERO] } as never)
}

export const withdraw = (w: WalletClient, a: Address, amount: bigint, step: Step) =>
  send(w, a, step, 'withdraw BTC', { ...v, functionName: 'withdraw', args: [amount, ZERO, ZERO] } as never)

export async function closeAccount(w: WalletClient, a: Address, target: Address, debt: bigint, step: Step) {
  await ensureAllowance(w, a, debt + debt / 100n, step)
  return send(w, a, step, 'close the account', { ...v, functionName: 'closeAccount', args: [target, ZERO, ZERO] } as never)
}
