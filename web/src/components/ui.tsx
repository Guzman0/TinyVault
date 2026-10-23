import { useState } from 'react'
import { useApp } from '../state'
import { explorerTx } from '../lib/chain'
import { errorText, toNum } from '../lib/format'

export function TxButton({ label, run, disabled, done }: {
  label: string
  run: (step: (s: string) => void) => Promise<string | void>
  disabled?: boolean
  done?: string
}) {
  const { refresh } = useApp()
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [hash, setHash] = useState('')

  async function go() {
    setBusy(true); setError(''); setHash(''); setStatus('')
    try {
      const h = await run(setStatus)
      if (h) setHash(h)
      setStatus(done ?? 'Done.')
      await refresh()
    } catch (e) {
      setStatus('')
      setError(errorText(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="tx">
      <button className="btn wide" onClick={go} disabled={disabled || busy}>{busy ? 'Working…' : label}</button>
      <div className="progress" aria-live="polite">
        {error ? <span className="bad">{error}</span> : status}
        {hash && <a href={explorerTx(hash)} target="_blank" rel="noreferrer">View transaction</a>}
      </div>
    </div>
  )
}

const LO = 1.0
const HI = 3.0
const pos = (r: number) => `${((Math.min(Math.max(r, LO), HI) - LO) / (HI - LO)) * 100}%`

/** Health of one account: where its ratio sits against the close line and the borrow limit. */
export function Gauge({ ratio, closeRatio, openRatio, compact = false }: { ratio: bigint; closeRatio: bigint; openRatio: bigint; compact?: boolean }) {
  const r = ratio >= 10n ** 30n ? HI : toNum(ratio)
  const c = toNum(closeRatio)
  const o = toNum(openRatio)
  const zone = r < c ? 'bad' : r < o ? 'warn' : 'good'
  return (
    <div className={`gauge ${compact ? 'compact' : ''}`} role="img" aria-label={`Ratio ${Math.round(r * 100)}%, closes below ${Math.round(c * 100)}%, borrow limit ${Math.round(o * 100)}%`}>
      <div className="gauge-track">
        <div className="gauge-zone z-bad" style={{ width: pos(c) }} />
        <div className="gauge-zone z-warn" style={{ left: pos(c), width: `calc(${pos(o)} - ${pos(c)})` }} />
        <div className={`gauge-dot ${zone}`} style={{ left: pos(r) }} />
        <div className="gauge-mark" style={{ left: pos(c) }} />
        <div className="gauge-mark" style={{ left: pos(o) }} />
      </div>
      {!compact && (
        <div className="gauge-labels">
          <span className="l-close" style={{ left: pos(c) }}>Closes {Math.round(c * 100)}%</span>
          <span className="l-limit" style={{ left: pos(o) }}>Limit {Math.round(o * 100)}%</span>
        </div>
      )}
    </div>
  )
}

export function Stat({ k, v, sub }: { k: string; v: string; sub?: string }) {
  return (
    <div className="stat">
      <div className="stat-k">{k}</div>
      <div className="stat-v">{v}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  )
}
