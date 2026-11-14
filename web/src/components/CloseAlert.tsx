import { useEffect, useRef, useState } from 'react'
import type { Address } from 'viem'
import { sharedClosePrice, type AccountState, type Params, type VaultState } from '../lib/data'
import { fmtBtc, fmtMusd, fmtUsd, toNum } from '../lib/format'

/** Warn this far above the close line: at 140% BTC can still fall about 11% before 125%. */
export const WARN_MARGIN = 15n * 10n ** 16n

export function warnRatio(p: Params) {
  // A vault with a narrow band between its limits (the stress vault) warns within 60% of the band.
  const band = ((p.openRatio - p.closeRatio) * 6n) / 10n
  return p.closeRatio + (band < WARN_MARGIN ? band : WARN_MARGIN)
}

/** What it takes to bring an account back to the 150% borrowing limit. */
export function fixes(m: AccountState, p: Params, price: bigint) {
  const backedDebt = (m.coll * price) / p.openRatio // debt the BTC supports at 150%
  const repay = m.debt > backedDebt ? m.debt - backedDebt : 0n
  const needColl = (m.debt * p.openRatio + price - 1n) / price
  const add = needColl > m.coll ? needColl - m.coll : 0n
  return { repay: repay + repay / 100n, add: add + add / 100n } // 1% headroom for price moves
}

type Fix = (tab: 'repay' | 'deposit', amount: bigint) => void

/** Within 15% above the shared loan's line: every account that owes is at risk, whatever its ratio. */
export function sharedNear(v: VaultState) {
  const s = sharedClosePrice(v)
  return s > 0n && v.price < (s * 115n) / 100n
}

export function CloseAlert({ m, p, v, onFix }: { m: AccountState; p: Params; v: VaultState; onFix: Fix }) {
  if (m.debt === 0n || v.closed) return null
  if (m.ratio >= warnRatio(p)) {
    if (!sharedNear(v)) return null
    return (
      <div className="alert warn" role="alert">
        <strong>The shared loan is near Mezo's line.</strong>
        <p>If BTC falls to {fmtUsd(toNum(sharedClosePrice(v)))}, Mezo can close the whole loan, and every account that still owes loses its BTC, yours included. An account with no debt keeps its BTC.</p>
        <div className="alert-actions">
          <button className="btn small" onClick={() => onFix('repay', m.debt)}>Repay {fmtMusd(m.debt)}</button>
        </div>
      </div>
    )
  }
  const closable = m.ratio < p.closeRatio
  const fall = toNum(v.price) > 0 ? 1 - toNum(m.closePrice) / toNum(v.price) : 0
  const f = fixes(m, p, v.price)
  return (
    <div className={`alert ${closable ? 'bad' : 'warn'}`} role="alert">
      <strong>{closable ? 'Your account can be closed now.' : `Your account is near its close line.`}</strong>
      <p>
        {closable
          ? `It is at ${pct(m.ratio)}, below ${pct(p.closeRatio)}. Anyone can repay your ${fmtMusd(m.debt)} and take BTC worth it plus ${pct(p.closeBonus)}. The rest of your BTC stays yours.`
          : `It is at ${pct(m.ratio)}. Below ${pct(p.closeRatio)} anyone can close it and take BTC worth your debt plus ${pct(p.closeBonus)}. That happens if BTC falls to ${fmtUsd(toNum(m.closePrice))}, ${Math.round(fall * 100)}% below today.`}
      </p>
      <p className="alert-fix">Back to {pct(p.openRatio)} by either:</p>
      <div className="alert-actions">
        <button className="btn small" onClick={() => onFix('repay', f.repay)}>Repay {fmtMusd(f.repay)}</button>
        <button className="btn small ghost" onClick={() => onFix('deposit', f.add)}>Add {fmtBtc(f.add)}</button>
      </div>
    </div>
  )
}

const KEY = (a: Address) => `tinyvault.notify.${a.toLowerCase()}`

function read(a: Address) {
  try { return localStorage.getItem(KEY(a)) === '1' } catch { return false }
}
function write(a: Address, on: boolean) {
  try { on ? localStorage.setItem(KEY(a), '1') : localStorage.removeItem(KEY(a)) } catch { /* private mode */ }
}

/**
 * Browser notifications while this page is open in a tab, even in the background. The app
 * re-reads the vault every minute; a notification fires when the account crosses the warning
 * line or the close line, once per crossing.
 */
export function NotifyToggle({ account, m, p, v }: { account: Address; m: AccountState; p: Params; v?: VaultState }) {
  const supported = typeof window !== 'undefined' && 'Notification' in window
  const [on, setOn] = useState(() => supported && read(account) && Notification.permission === 'granted')
  const last = useRef<'ok' | 'warn' | 'close'>('ok')

  useEffect(() => { setOn(supported && read(account) && Notification.permission === 'granted') }, [account, supported])

  useEffect(() => {
    const level = m.debt === 0n ? 'ok' : m.ratio < p.closeRatio ? 'close' : m.ratio < warnRatio(p) || (v && sharedNear(v)) ? 'warn' : 'ok'
    if (on && level !== 'ok' && level !== last.current) {
      try {
        new Notification(level === 'close' ? 'TinyVault: your account can be closed' : 'TinyVault: your account is near its close line', {
          body: `It is at ${pct(m.ratio)}. Repay some MUSD or add BTC to get back to ${pct(p.openRatio)}.`,
          tag: 'tinyvault-health',
        })
      } catch { /* some mobile browsers only notify from a service worker */ }
    }
    last.current = level
  }, [on, m.ratio, m.debt, p, v])

  if (!supported || m.debt === 0n) return null
  const toggle = async () => {
    if (on) { write(account, false); setOn(false); return }
    const perm = await Notification.requestPermission()
    const ok = perm === 'granted'
    write(account, ok); setOn(ok)
  }
  return (
    <button className="notify" onClick={toggle} aria-pressed={on}>
      {on ? 'Alerts on in this browser' : 'Alert me before my account nears its close line'}
    </button>
  )
}

function pct(x: bigint) {
  return `${Math.round(toNum(x * 100n))}%`
}
