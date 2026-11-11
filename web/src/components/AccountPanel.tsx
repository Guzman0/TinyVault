import { useMemo, useState } from 'react'
import { useApp } from '../state'
import { borrow, claimMusd, deposit, repay, withdraw } from '../lib/actions'
import { fmtBtc, fmtMusd, fmtNum, fmtRatio, fmtUsd, toNum, toWei, errorText } from '../lib/format'
import { Gauge, Stat, TxButton } from './ui'
import { CloseAlert, NotifyToggle } from './CloseAlert'
import { OTHER_VAULT } from '../lib/config'

type Tab = 'deposit' | 'borrow' | 'repay' | 'withdraw'
const ONE = 10n ** 18n

export function AccountPanel() {
  const { account, wallet, connect, me, params, vault, balances } = useApp()
  const [tab, setTab] = useState<Tab>(OTHER_VAULT ? 'repay' : 'deposit')
  const [amount, setAmount] = useState('')
  const [err, setErr] = useState('')
  const [firstDone, setFirstDone] = useState('')

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
        {vault.closed || vault.shutdownAt > 0n || OTHER_VAULT
          ? <Stat k="You can borrow" v="0 MUSD" sub={OTHER_VAULT ? 'Old vault: repay and withdraw only' : vault.closed ? 'The vault is closed' : 'The vault is winding down'} />
          : <Stat k="You can borrow" v={fmtMusd(me.maxBorrow)} sub="Before fees, at the 150% limit" />}
      </div>

      {firstDone && <div className="notice good">{firstDone}</div>}
      <CloseAlert m={me} p={params} v={vault} onFix={(t, amt) => { setTab(t); setAmount(trim(amt)) }} />
      <NotifyToggle account={account} m={me} p={params} />

      {me.claimable > 0n && (
        <div className="claim">
          <p><strong>{fmtMusd(me.claimable)}</strong> of the MUSD the vault was holding is yours.</p>
          <TxButton label="Claim MUSD" done="Claimed." run={(s) => claimMusd(wallet, account, s)} />
        </div>
      )}
      {me.coll === 0n && me.debt === 0n && !vault.closed && vault.shutdownAt === 0n && !OTHER_VAULT && (
        <>
          <FirstLoan onDone={setFirstDone} />
          <p className="or">or step by step</p>
        </>
      )}
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

const PRESETS = ['20', '50', '100']
const FIRST_RATIO = 2n * ONE // a first loan starts well above the 150% limit, so BTC can fall 37% before 125%

/** A first loan in one go: pick how much MUSD, the app works out the BTC and sends both steps. */
function FirstLoan({ onDone }: { onDone: (s: string) => void }) {
  const { account, wallet, params, vault, balances } = useApp()
  const [amount, setAmount] = useState('50')
  const p = params!, v = vault!, b = balances!
  const wei = toWei(amount)

  const plan = useMemo(() => {
    if (!wei) return null
    const reserveFee = wei * BigInt(p.reserveFeeBps) / 10_000n
    const mezoFee = (wei + reserveFee) * p.mezoFeeRate / ONE
    const debt = wei + reserveFee + mezoFee
    const raw = (debt * FIRST_RATIO + v.price - 1n) / v.price
    const coll = ((raw + 10n ** 12n - 1n) / 10n ** 12n) * 10n ** 12n // round up to 0.000001 BTC
    const closeAt = toNum(debt * p.closeRatio / coll)
    const need = wei + reserveFee
    return { debt, fees: reserveFee + mezoFee, coll, closeAt, fall: 1 - closeAt / toNum(v.price), fromTrove: need > v.idle ? need - v.idle : 0n }
  }, [wei, p, v])

  const tooLow = wei !== null && wei < p.minBorrow
  const short = plan !== null && b.btc < plan.coll + 10n ** 15n // keep a little BTC for gas

  return (
    <div className="first">
      <h3>Your first loan, in one step</h3>
      <div className="presets" role="group" aria-label="How much MUSD">
        {PRESETS.map((x) => <button key={x} className="chip" aria-pressed={amount === x} onClick={() => setAmount(x)}>{x} MUSD</button>)}
      </div>
      <label className="field">
        <span>MUSD to borrow</span>
        <div className="input-row">
          <input inputMode="decimal" placeholder="50" value={amount} onChange={(e) => setAmount(e.target.value)} />
          <span className="unit">MUSD</span>
        </div>
      </label>
      {plan && !tooLow && (
        <div className="summary">
          <Row k="You add" v={`${fmtBtc(plan.coll)} (${fmtUsd(toNum(plan.coll * v.price / ONE))})`} />
          <Row k="You get" v={fmtMusd(wei!)} />
          <Row k="You will owe" v={`${fmtMusd(plan.debt)} (fees ${fmtMusd(plan.fees, 2)})`} />
          <Row k="Closes if BTC falls to" v={`${fmtUsd(plan.closeAt)}, ${Math.round(plan.fall * 100)}% below today`} />
        </div>
      )}
      {tooLow && <p className="bad">The smallest loan is {fmtNum(toNum(p.minBorrow), 0)} MUSD.</p>}
      {short && <p className="bad">That needs {fmtBtc(plan!.coll)} plus a little for gas; your wallet has {fmtBtc(b.btc)}. <a href="https://faucet.test.mezo.org" target="_blank" rel="noreferrer">Get testnet BTC</a></p>}
      <TxButton
        label={plan && !tooLow ? `Add ${fmtBtc(plan.coll)} and borrow ${amount} MUSD` : 'Enter an amount'}
        disabled={!plan || tooLow || short}
        done="Borrowed. The MUSD is in your wallet."
        run={async (step) => {
          if (!plan || !wei || !account || !wallet) throw new Error('Enter an amount.')
          await deposit(wallet, account, plan.coll, (s) => step(`Step 1 of 2. ${s}`))
          const h = await borrow(wallet, account, wei, plan.fromTrove, (s) => step(`Step 2 of 2. ${s}`))
          onDone(`Borrowed ${amount} MUSD. It is in your wallet. Repay any time to take your BTC back.`)
          return h
        }}
      />
      <small className="muted">Two confirmations in your wallet: one to add the BTC, one to borrow.</small>
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
  const stopped = (tab === 'deposit' || tab === 'borrow') && (v.shutdownAt > 0n || v.closed || OTHER_VAULT)
  const paused = tab === 'withdraw' && v.recoveryMode && !v.closed
  const noRepay = tab === 'repay' && v.closed
  const unsafe = preview.ratio !== null && preview.ratio < toNum(p.openRatio) && (tab === 'borrow' || tab === 'withdraw')

  const run = (step: (s: string) => void) => {
    if (!wei || !account || !wallet) throw new Error('Enter an amount.')
    if (tab === 'deposit') return deposit(wallet, account, wei, step)
    if (tab === 'borrow') {
      const need = wei + wei * BigInt(p.reserveFeeBps) / 10_000n
      return borrow(wallet, account, wei, need > v.idle ? need - v.idle : 0n, step)
    }
    if (tab === 'repay') return repay(wallet, account, wei >= m.debt ? 2n ** 255n : wei, m.debt, step)
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
      {stopped && <p className="bad">{OTHER_VAULT ? 'This is an old vault: repay and withdraw only.' : `The vault is ${v.closed ? 'closed' : 'winding down'}: no new deposits or loans.`}</p>}
      {paused && <p className="bad">Mezo is in Recovery Mode and pauses BTC withdrawals until it recovers.</p>}
      {noRepay && <p className="muted">The vault's Mezo loan is closed, so there is nothing to repay.</p>}
      <TxButton
        label={wei ? `${tab === 'deposit' ? 'Add' : tab === 'borrow' ? 'Borrow' : tab === 'repay' ? 'Repay' : 'Withdraw'} ${amount} ${unit}` : 'Enter an amount'}
        disabled={!wei || tooLow || unsafe || stopped || paused || noRepay}
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
