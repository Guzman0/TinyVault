import { formatUnits, parseUnits } from 'viem'

export const toNum = (wei: bigint) => Number(formatUnits(wei, 18))

export function fmtNum(n: number, max = 2) {
  return n.toLocaleString('en-GB', { maximumFractionDigits: max })
}

export function fmtMusd(wei: bigint, max = 2) {
  return `${fmtNum(toNum(wei), max)} MUSD`
}

export function fmtBtc(wei: bigint) {
  const n = toNum(wei)
  return `${n === 0 ? '0' : n < 0.001 ? n.toFixed(6) : fmtNum(n, 5)} BTC`
}

export function fmtUsd(n: number) {
  return '$' + n.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/** A ratio in 1e18 (1e18 = 100%). */
export function fmtRatio(r: bigint) {
  if (r >= 10n ** 30n) return 'No debt'
  return `${Math.round(toNum(r) * 100)}%`
}

export const shortAddr = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`

export function toWei(s: string) {
  const clean = s.replace(/,/g, '').trim()
  if (!clean || isNaN(Number(clean)) || Number(clean) <= 0) return null
  try {
    return parseUnits(clean, 18)
  } catch {
    return null
  }
}

/** One plain sentence for a wallet or contract error. */
export function errorText(e: unknown): string {
  const msg = (e as { shortMessage?: string; message?: string })?.shortMessage ?? (e as Error)?.message ?? String(e)
  if (/user rejected|denied/i.test(msg)) return 'You cancelled the request in your wallet.'
  const known: Record<string, string> = {
    Unhealthy: 'That would take your account below the 150% limit. Borrow or withdraw less, or add BTC.',
    BelowMinBorrow: 'The smallest loan is 10 MUSD.',
    Healthy: 'This account is healthy and cannot be closed.',
    NoDebt: 'This account has no debt.',
    InsufficientCollateral: 'You do not have that much BTC in the vault.',
    IsClosed: 'The shared Mezo loan was closed. You can only withdraw.',
    NotOpen: 'The vault has not opened its Mezo loan yet.',
    ZeroAmount: 'Enter an amount.',
  }
  for (const [k, v] of Object.entries(known)) if (msg.includes(k)) return v
  if (/insufficient funds/i.test(msg)) return 'Not enough BTC in this wallet for that amount plus gas.'
  if (/ERC20InsufficientBalance|transfer amount exceeds balance/i.test(msg)) return 'Not enough MUSD in this wallet.'
  return msg.split('\n')[0]
}
