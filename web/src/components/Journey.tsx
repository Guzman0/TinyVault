import { useEffect, useState } from 'react'
import { useApp } from '../state'
import type { Tab } from './AccountPanel'
import { OTHER_VAULT } from '../lib/config'
import { errorText, fmtBtc, fmtMusd, fmtRatio } from '../lib/format'

/** Open the account box on a tab and bring it into view. */
export function goTo(tab?: Tab) {
  if (tab) window.dispatchEvent(new CustomEvent('tinyvault:tab', { detail: tab }))
  document.getElementById(tab ? 'account' : 'demo')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

type Stage = 0 | 1 | 2 | 3 | 4

/** Where this person is in a loan's life: 0 connect, 1 add BTC, 2 borrow, 3 repay, 4 take BTC back. */
function useStage(): Stage {
  const { account, me } = useApp()
  if (!account) return 0
  if (!me || (me.coll === 0n && me.debt === 0n)) return 1
  if (me.debt > 0n) return 3
  return 2
}

const STEPS: { name: string; tab?: Tab; what: string }[] = [
  { name: 'Connect', what: 'Your wallet on Mezo Testnet' },
  { name: 'Add BTC', tab: 'deposit', what: 'It stays yours, in the shared loan' },
  { name: 'Borrow', tab: 'borrow', what: 'From 10 MUSD, up to your own limit' },
  { name: 'Repay', tab: 'repay', what: 'Any time, all or part' },
  { name: 'Take BTC back', tab: 'withdraw', what: 'Once nothing is owed' },
]

/** The life of one loan, with this person's place in it and the next thing to do. */
export function Journey() {
  const { connect } = useApp()
  const stage = useStage()
  const [err, setErr] = useState('')
  return (
    <div className="journey">
      <ol className="journey-steps">
        {STEPS.map((s, i) => {
          const state = i < stage ? 'done' : i === stage ? 'now' : 'later'
          return (
            <li key={s.name} className={state}>
              <button
                onClick={() => (i === 0 ? connect().catch((e) => setErr(errorText(e))) : goTo(s.tab))}
                disabled={OTHER_VAULT && (s.tab === 'deposit' || s.tab === 'borrow')}
                aria-current={state === 'now' ? 'step' : undefined}
              >
                <span className="journey-mark" aria-hidden="true">{i < stage ? '' : i + 1}</span>
                <span className="journey-text">
                  <b>{s.name}</b>
                  <small>{state === 'now' ? 'You are here' : s.what}</small>
                </span>
              </button>
            </li>
          )
        })}
      </ol>
      {err && <p className="bad">{err}</p>}
    </div>
  )
}

/**
 * A slim bar that stays in view once the account box has scrolled away: your position and the
 * one thing you are most likely to do next.
 */
export function FollowBar() {
  const { account, me, connect } = useApp()
  const [show, setShow] = useState(false)
  useEffect(() => {
    let frame = 0
    const check = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const r = document.getElementById('account')?.getBoundingClientRect()
        setShow(!!r && r.bottom < 0)
      })
    }
    check()
    window.addEventListener('scroll', check, { passive: true })
    window.addEventListener('resize', check)
    return () => { cancelAnimationFrame(frame); window.removeEventListener('scroll', check); window.removeEventListener('resize', check) }
  }, [])

  if (!show) return null
  const has = !!me && (me.coll > 0n || me.debt > 0n)
  return (
    <div className="followbar" role="region" aria-label="Your loan">
      {account && has && me ? (
        <>
          <span className="followbar-pos">
            <b className="mono">{fmtMusd(me.debt, 2)}</b> owed<span className="followbar-btc"> on <b className="mono">{fmtBtc(me.coll)}</b></span>
            {me.debt > 0n && <span className="followbar-ratio">{fmtRatio(me.ratio)}</span>}
          </span>
          <span className="followbar-actions">
            {me.debt > 0n && <button className="btn small" onClick={() => goTo('repay')}>Repay</button>}
            <button className={`btn small${me.debt > 0n ? ' ghost' : ''}`} onClick={() => goTo('borrow')}>Borrow</button>
          </span>
        </>
      ) : account ? (
        <>
          <span className="followbar-pos">No loan yet. Add BTC to start.</span>
          <span className="followbar-actions"><button className="btn small" onClick={() => goTo('deposit')}>Add BTC</button></span>
        </>
      ) : (
        <>
          <span className="followbar-pos">Borrow from 10 MUSD against your Bitcoin.</span>
          <span className="followbar-actions">
            <button className="btn small ghost" onClick={() => goTo()}>Watch a loan</button>
            <button className="btn small" onClick={() => connect().catch(() => goTo('deposit'))}>Connect</button>
          </span>
        </>
      )}
    </div>
  )
}
