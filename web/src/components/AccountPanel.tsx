import { useMemo, useState } from 'react'
import { useApp } from '../state'
import { borrow, deposit, repay, withdraw } from '../lib/actions'
import { fmtBtc, fmtMusd, fmtNum, fmtRatio, fmtUsd, toNum, toWei, errorText } from '../lib/format'
import { Gauge, Stat, TxButton } from './ui'

type Tab = 'deposit' | 'borrow' | 'repay' | 'withdraw'
const ONE = 10n ** 18n

export function AccountPanel() {
  const { account, wallet, connect, me, params, vault, balances } = useApp()
  const [tab, setTab] = useState<Tab>('deposit')
  const [amount, setAmount] = useState('')
  const [err, setErr] = useState('')

  if (!account || !wallet) {
    return (
      <div className="panel panel-account">
        <h2>Your account</h2>
        <p className="muted">Connect a wallet on Mezo Testnet to deposit BTC and borrow. You need a little testnet BTC from the faucet.</p>
        <button className="btn" onClick={() => connect().catch((e) => setErr(errorText(e)))}>Connect wallet</button>
        {err && <p className="bad">{err}</p>}
        <a className="small-link" href="https://faucet.test.mezo.org" target="_blank" rel="noreferrer">Get testnet BTC</a>
      </div>
    )
  }
  if (!me || !params || !vault || !balances) return <div className="panel panel-account"><p className="muted">Reading your account from Mezo testnet</p></div>

  const price = vault.price
  const hasDebt = me.debt > 0n
  const valueUsd = toNum(me.coll * price / ONE)

  return (
    <div className="panel panel-account">
      <div className="panel-head">
        <h2>Your account</h2>
        <span className={`pill ${me.ratio < params.closeRatio ? 'bad' : me.ratio < params.openRatio ? 'warn' : 'good'}`}>{fmtRatio(me.ratio)}</span>
      </div>
      <Gauge ratio={me.ratio} closeRatio={params.closeRatio} openRatio={params.openRatio} />
      <div className="stats">
        <Stat k="BTC in the vault" v={fmtBtc(me.coll)} sub={`Worth ${fmtUsd(valueUsd)}`} />
        <Stat k="You owe" v={fmtMusd(me.debt)} sub={hasDebt ? `Closes if BTC falls to ${fmtUsd(toNum(me.closePrice))}` : 'No loan yet'} />
        <Stat k="You can borrow" v={fmtMusd(me.maxBorrow)} sub="Before fees, at the 150% limit" />
      </div>

      <div className="tabs" role="tablist">
        {(['deposit', 'borrow', 'repay', 'withdraw'] as Tab[]).map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} onClick={() => { setTab(t); setAmount('') }}>
            {t === 'deposit' ? 'Add BTC' : t === 'borrow' ? 'Borrow' : t === 'repay' ? 'Repay' : 'Withdraw'}
          </button>
        ))}
      </div>
      <ActionForm tab={tab} amount={amount} setAmount={setAmount} />
    </div>
  )
}

function ActionForm({ tab, amount, setAmount }: { tab: Tab; amount: string; setAmount: (s: string) => void }) {
  const { account, wallet, me, params, vault, balances } = useApp()
  const wei = toWei(amount)
  const p = params!, v = vault!, m = me!, b = balances!
  const price = v.price
  const unit = tab === 'deposit' || tab === 'withdraw' ? 'BTC' : 'MUSD'

  const preview = useMemo(() => {
    const coll = m.coll
    const debt = m.debt
    const w = wei ?? 0n
    let newColl = coll, newDebt = debt, fees = 0n
    if (tab === 'deposit') newColl = coll + w
    if (tab === 'withdraw') newColl = coll > w ? coll - w : 0n
    if (tab === 'repay') newDebt = debt > w ? debt - w : 0n
    if (tab === 'borrow') {
      const reserveFee = w * BigInt(p.reserveFeeBps) / 10_000n
      const mezoFee = (w + reserveFee) * p.mezoFeeRate / ONE
      fees = reserveFee + mezoFee
      newDebt = debt + w + fees
    }
    const ratio = newDebt === 0n ? null : Number(newColl * price / newDebt) / 1e18
    const closeAt = newDebt === 0n || newColl === 0n ? null : toNum(newDebt * p.closeRatio / newColl)
    return { newColl, newDebt, fees, ratio, closeAt }
  }, [tab, wei, m, p, price])

  const max = useMemo(() => {
    if (tab === 'deposit') return b.btc > 10n ** 15n ? b.btc - 10n ** 15n : 0n // leave gas
    if (tab === 'borrow') return m.maxBorrow * 99n / 100n // leave room for fees
    if (tab === 'repay') return m.debt < b.musd ? m.debt : b.musd
    const locked = m.debt === 0n ? 0n : (m.debt * p.openRatio + price - 1n) / price
    return m.coll > locked ? m.coll - locked : 0n
  }, [tab, b, m, p, price])

  const tooLow = tab === 'borrow' && wei !== null && wei < p.minBorrow
  const unsafe = preview.ratio !== null && preview.ratio < toNum(p.openRatio) && (tab === 'borrow' || tab === 'withdraw')

  const run = (step: (s: string) => void) => {
    if (!wei || !account || !wallet) throw new Error('Enter an amount.')
    if (tab === 'deposit') return deposit(wallet, account, wei, step)
    if (tab === 'borrow') return borrow(wallet, account, wei, step)
    if (tab === 'repay') return repay(wallet, account, wei >= m.debt ? 2n ** 255n : wei, step)
    return withdraw(wallet, account, wei, step)
  }

  return (
    <div className="form">
      <label className="field">
        <span>{tab === 'deposit' ? 'BTC to add' : tab === 'borrow' ? 'MUSD to borrow' : tab === 'repay' ? 'MUSD to repay' : 'BTC to withdraw'}</span>
        <div className="input-row">
          <input inputMode="decimal" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} />
          <button className="chip" onClick={() => setAmount(trim(max))}>Max</button>
          <span className="unit">{unit}</span>
        </div>
        <small className="muted">
          {tab === 'deposit' && `In your wallet: ${fmtBtc(b.btc)}`}
          {tab === 'borrow' && `From ${fmtNum(toNum(p.minBorrow), 0)} MUSD. Mezo's own minimum is ${fmtNum(toNum(v.minNetDebt), 0)} MUSD.`}
          {tab === 'repay' && `In your wallet: ${fmtMusd(b.musd)}`}
          {tab === 'withdraw' && `Free to withdraw: ${fmtBtc(max)}`}
        </small>
      </label>

      {wei !== null && (
        <div className="summary">
          {tab === 'borrow' && <Row k="Fees" v={`${fmtMusd(preview.fees, 3)} (0.5% reserve + Mezo's 0.1%)`} />}
          {(tab === 'borrow' || tab === 'repay') && <Row k="You will owe" v={fmtMusd(preview.newDebt)} />}
          {(tab === 'deposit' || tab === 'withdraw') && <Row k="BTC in the vault" v={fmtBtc(preview.newColl)} />}
          <Row k="Ratio after" v={preview.ratio === null ? 'No debt' : `${Math.round(preview.ratio * 100)}%`} bad={unsafe} />
          {preview.closeAt !== null && <Row k="Closes if BTC falls to" v={fmtUsd(preview.closeAt)} />}
        </div>
      )}
      {tooLow && <p className="bad">The smallest loan is {fmtNum(toNum(p.minBorrow), 0)} MUSD.</p>}
      {unsafe && <p className="bad">That goes below the 150% limit.</p>}
      <TxButton
        label={wei ? `${tab === 'deposit' ? 'Add' : tab === 'borrow' ? 'Borrow' : tab === 'repay' ? 'Repay' : 'Withdraw'} ${amount} ${unit}` : 'Enter an amount'}
        disabled={!wei || tooLow || unsafe}
        done={tab === 'borrow' ? 'Borrowed. The MUSD is in your wallet.' : 'Done.'}
        run={async (s) => { const h = await run(s); setAmount(''); return h }}
      />
    </div>
  )
}

function Row({ k, v, bad }: { k: string; v: string; bad?: boolean }) {
  return <div className="row"><span>{k}</span><strong className={bad ? 'bad' : ''}>{v}</strong></div>
}

function trim(wei: bigint) {
  const n = toNum(wei)
  return n === 0 ? '0' : String(Math.floor(n * 1e6) / 1e6)
}
