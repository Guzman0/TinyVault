import { useEffect, useState } from 'react'
import { useApp } from '../state'
import { explorerAddress, explorerTx } from '../lib/chain'
import { DEMO_ADDRESS, demoBalances, runDemo, type DemoStep } from '../lib/demo'
import { OTHER_VAULT } from '../lib/config'
import { errorText, fmtBtc, fmtMusd, shortAddr } from '../lib/format'

/**
 * A real loan anyone can watch without a wallet: the demo wallet adds BTC, borrows, repays and
 * takes its BTC back on Mezo testnet, and every step links to its transaction.
 */
export function Demo() {
  const { refresh } = useApp()
  const [steps, setSteps] = useState<DemoStep[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [secs, setSecs] = useState(0)
  const [bal, setBal] = useState<{ btc: bigint; musd: bigint } | null>(null)

  useEffect(() => { demoBalances().then(setBal).catch(() => {}) }, [busy])
  if (OTHER_VAULT) return null

  const start = async () => {
    setBusy(true); setErr(''); setSteps(null)
    const t = Date.now()
    try {
      await runDemo(setSteps)
      setSecs(Math.round((Date.now() - t) / 1000))
    } catch (e) {
      setErr(errorText(e))
    } finally {
      setBusy(false)
      refresh()
    }
  }
  const done = !!steps && steps.every((s) => s.state === 'done')

  return (
    <section className="panel demo" id="demo">
      <div className="panel-head">
        <span />
        <a className="small-link" href={explorerAddress(DEMO_ADDRESS)} target="_blank" rel="noreferrer">Demo wallet {shortAddr(DEMO_ADDRESS)}</a>
      </div>
      <p className="muted">
        A demo wallet runs one small loan through the vault on Mezo testnet: it adds 0.001 BTC, borrows 10 MUSD, repays it with the fees and takes its BTC back. Each step is a real transaction you can open.
      </p>
      {steps && (
        <ol className="demo-steps">
          {steps.map((s, i) => (
            <li key={i} className={s.state}>
              <span className="demo-dot" aria-hidden="true" />
              <span className="demo-label">{s.label}</span>
              <span className="demo-meta">
                {s.hash ? <a href={explorerTx(s.hash)} target="_blank" rel="noreferrer" className="mono">{s.hash.slice(0, 10)}…</a> : s.state === 'running' ? (s.note || 'Sending') : s.state === 'failed' ? 'Stopped' : ''}
              </span>
            </li>
          ))}
        </ol>
      )}
      {done && <p className="good">Done: four transactions in {secs < 2 ? 'a couple of seconds' : `${secs} seconds`}. The demo account is back to zero, as yours would be.</p>}
      {err && <p className="bad">{err.includes('nonce') || err.includes('replacement') ? 'Someone else is running the demo right now. Try again in a minute.' : err}</p>}
      <div className="connect-row">
        <button className="btn" disabled={busy} onClick={start}>{busy ? 'Running on Mezo testnet' : done ? 'Run it again' : 'Run a real loan'}</button>
        {bal && <small className="muted">Demo wallet: {fmtBtc(bal.btc)} · {fmtMusd(bal.musd, 2)}</small>}
      </div>
    </section>
  )
}
