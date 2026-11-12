import { useEffect, useMemo, useRef, useState } from 'react'
import { useApp } from '../state'
import { effectiveClosePrice, loadAccount, MEZO_MCR, sharedClosePrice } from '../lib/data'
import { borrow, claimMusd, deposit, repay, withdraw } from '../lib/actions'
import { fmtBtc, fmtMusd, fmtNum, fmtRatio, fmtUsd, toNum, toWei, errorText } from '../lib/format'
import { Gauge, Stat, TxButton } from './ui'
import { CloseAlert, NotifyToggle } from './CloseAlert'
import { OTHER_VAULT } from '../lib/config'

type Tab = 'deposit' | 'borrow' | 'repay' | 'withdraw'
const ONE = 10n ** 18n

export function AccountPanel() {
  const { account, wallet, connect, me, params, vault, balances } = useApp()
  const [tab, setTab] = useState<Tab>(OTHER_VAULT || (me && me.debt > 0n) ? 'repay' : 'deposit')
  const [amount, setAmount] = useState('')
  const [err, setErr] = useState('')
  const [firstDone, setFirstDone] = useState('')
  // Someone with a loan most often comes back to repay: open on Repay once, unless they picked a tab.
  const picked = useRef(false)
  const owes = !!me && me.debt > 0n
  useEffect(() => { if (owes && !picked.current) setTab('repay') }, [owes])

  if (!account || !wallet) {
    return (
      <div className="panel panel-account">
        <h2>Your account</h2>
        <Calculator />
        <div className="connect-row">
          <button className="btn" onClick={() => connect().catch((e) => setErr(errorText(e)))}>Connect wallet</button>
          <a className="small-link" href="https://faucet.test.mezo.org" target="_blank" rel="noreferrer">Get testnet BTC</a>
        </div>
        {err && <p className="bad">{err}</p>}
        <small className="muted">Mezo Testnet: the app adds the network to your wallet when you connect.</small>
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
        <Stat k="You owe" v={fmtMusd(me.debt)} sub={hasDebt ? `Closes if BTC falls to ${fmtUsd(toNum(effectiveClosePrice(me, vault, account)))}` : 'No loan yet'} />
        {vault.closed || vault.shutdownAt > 0n || OTHER_VAULT
          ? <Stat k="You can borrow" v="0 MUSD" sub={OTHER_VAULT ? 'Old vault: repay and withdraw only' : vault.closed ? 'The vault is closed' : 'The vault is winding down'} />
          : <Stat k="You can borrow" v={fmtMusd(me.maxBorrow)} sub="Before fees, at the 150% limit" />}
      </div>

      {firstDone && <div className="notice good">{firstDone}</div>}
      {hasDebt && !vault.closed && <SharedNote />}
      <CloseAlert m={me} p={params} v={vault} onFix={(t, amt) => { picked.current = true; setTab(t); setAmount(trim(amt)) }} />
      <NotifyToggle account={account} m={me} p={params} v={vault} />

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
          <button key={t} role="tab" aria-selected={tab === t} onClick={() => { picked.current = true; setTab(t); setAmount('') }}>
            {t === 'deposit' ? 'Add BTC' : t === 'borrow' ? 'Borrow' : t === 'repay' ? 'Repay' : 'Withdraw'}
          </button>
        ))}
      </div>
      {tab === 'repay' && hasDebt && !vault.closed && account.toLowerCase() !== vault.anchor.toLowerCase() && <PayOff />}
      <ActionForm tab={tab} amount={amount} setAmount={setAmount} />
    </div>
  )
}

/** When the shared loan's line is above this account's own, say which one comes first. */
function SharedNote() {
  const { account, me, vault } = useApp()
  const m = me!, v = vault!
  const shared = sharedClosePrice(v)
  const anchor = !!account && account.toLowerCase() === v.anchor.toLowerCase()
  if (!anchor && shared <= m.closePrice) return null
  return (
    <p className="shared-note">
      {anchor
        ? `You are the anchor: your account carries Mezo's minimum loan, so it cannot be closed on its own. It goes only if Mezo closes the whole shared loan, at ${fmtUsd(toNum(shared))}. Adding BTC moves that line down for everyone.`
        : `Your own close line is ${fmtUsd(toNum(m.closePrice))}, but the shared loan closes first, at ${fmtUsd(toNum(shared))}. At that price Mezo closes the whole loan: you keep the MUSD you borrowed and lose the BTC in your account.`}
    </p>
  )
}

/**
 * Pay off and take the BTC back in one go. A loan's fees are added to the debt, so a borrower
 * who only holds the MUSD they received is a few cents short. Then this repays what they hold
 * and returns all the BTC except the sliver that covers the rest, and says how to clear it.
 */
function PayOff() {
  const { account, wallet, me, vault, balances } = useApp()
  const m = me!, v = vault!, b = balances!
  const full = b.musd >= m.debt + m.debt / 1000n // a little room for interest accrued since the read
  const pay = full ? m.debt : b.musd
  const short = full ? 0n : m.debt - b.musd
  const keep = short === 0n ? 0n : (short * FIRST_RATIO + v.price - 1n) / v.price // the sliver stays at 200%, far from any close
  const back = m.coll > keep ? m.coll - keep : 0n
  if (pay === 0n) {
    return (
      <div className="payoff">
        <h3>{fmtMusd(m.debt, 2)} left to repay</h3>
        <p>Repay it to take back the last {fmtBtc(m.coll)}. Your wallet has no MUSD yet: swap a little BTC for MUSD in <a href="https://mezo.org/docs/users/features/mezo-swap" target="_blank" rel="noreferrer">Mezo Swap</a>, or ask a friend to send some, then come back here.</p>
      </div>
    )
  }

  return (
    <div className="payoff">
      <h3>{full ? 'Pay off and take your BTC back' : 'Pay off what you can and take your BTC back'}</h3>
      <p>
        {full
          ? `Repays your ${fmtMusd(m.debt)} and returns all ${fmtBtc(m.coll)}.`
          : `You hold ${fmtMusd(b.musd)} and owe ${fmtMusd(m.debt)}: the ${fmtMusd(short, 2)} gap is the loan's fees. This repays ${fmtMusd(b.musd)} and returns ${fmtBtc(back)}. About ${fmtBtc(keep)} (${fmtUsd(toNum(keep * v.price / ONE))}) stays to cover the ${fmtMusd(short, 2)} still owed; repay it whenever you have the MUSD and the rest comes back too.`}
      </p>
      <TxButton
        label={full ? `Repay ${fmtMusd(m.debt)} and withdraw ${fmtBtc(m.coll)}` : `Repay ${fmtMusd(b.musd)} and withdraw ${fmtBtc(back)}`}
        done={full ? 'Paid off. Your BTC is back in your wallet.' : 'Done. Most of your BTC is back in your wallet.'}
        run={async (step) => {
          if (!account || !wallet) throw new Error('Connect a wallet.')
          await repay(wallet, account, full ? 2n ** 255n : pay, m.debt, (s) => step(`Step 1 of 2. ${s}`))
          // Read the account again: interest moves the debt a little between the two steps.
          const now = await loadAccount(account)
          const lock = now.debt === 0n ? 0n : (now.debt * FIRST_RATIO + v.price - 1n) / v.price
          const out = now.coll > lock ? now.coll - lock : 0n
          if (out === 0n) throw new Error('Repaid. Nothing more can be withdrawn yet.')
          return withdraw(wallet, account, out, (s) => step(`Step 2 of 2. ${s}`))
        }}
      />
      {!full && <small className="muted">To clear the last {fmtMusd(short, 2)}, swap a little BTC for MUSD in <a href="https://mezo.org/docs/users/features/mezo-swap" target="_blank" rel="noreferrer">Mezo Swap</a>, or ask a friend for it.</small>}
    </div>
  )
}

const BTC_PRESETS = ['0.001', '0.005', '0.01']

/** Before connecting: how much could this much BTC borrow, and when would it be closed? */
function Calculator() {
  const { params, vault } = useApp()
  const [btc, setBtc] = useState('0.005')
  if (!params || !vault) return <p className="muted">Reading the vault from Mezo testnet</p>
  const wei = toWei(btc) ?? 0n
  const value = toNum(wei * vault.price / ONE)
  const feeK = ONE + BigInt(params.reserveFeeBps) * ONE / 10_000n // borrowed amount → debt, roughly
  const atLimit = wei * vault.price / params.openRatio * ONE / feeK
  const safe = wei * vault.price / FIRST_RATIO * ONE / feeK
  const closeAt = toNum(vault.price * params.closeRatio / FIRST_RATIO)
  const tooSmall = safe < params.minBorrow
  return (
    <div className="calc">
      <p className="muted">How much could you borrow?</p>
      <label className="field">
        <span>BTC you have</span>
        <div className="input-row">
          <input inputMode="decimal" value={btc} onChange={(e) => setBtc(e.target.value)} aria-label="BTC you have" />
          <span className="unit">BTC</span>
        </div>
        <div className="presets">
          {BTC_PRESETS.map((x) => <button key={x} className="chip" aria-pressed={btc === x} onClick={() => setBtc(x)}>{x}</button>)}
        </div>
      </label>
      {wei > 0n && (
        <div className="summary">
          <Row k="Worth" v={fmtUsd(value)} />
          <Row k="A safe loan, at 200%" v={tooSmall ? `under ${fmtNum(toNum(params.minBorrow), 0)} MUSD` : fmtMusd(safe, 0)} />
          <Row k="The most, at 150%" v={fmtMusd(atLimit, 0)} />
          <Row k="A safe loan closes if BTC falls to" v={`${fmtUsd(Math.max(closeAt, toNum(sharedClosePrice(vault))))}, ${Math.floor((1 - Math.max(closeAt, toNum(sharedClosePrice(vault))) / toNum(vault.price)) * 100)}% below today`} />
        </div>
      )}
      {tooSmall && wei > 0n && <small className="muted">The smallest loan is {fmtNum(toNum(params.minBorrow), 0)} MUSD, so a safe one needs about {fmtBtc(params.minBorrow * feeK / ONE * FIRST_RATIO / vault.price)}.</small>}
      <small className="muted">On Mezo directly, the smallest loan needs about ${fmtNum(toNum(vault.minNetDebt * 11n / 10n * params.openRatio / ONE), 0)} of BTC.</small>
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
    const closeAt = Math.max(toNum(debt * p.closeRatio / coll), toNum(sharedClosePrice(v)))
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
          <Row k="To pay off in full" v={`keep ${fmtMusd(plan.fees, 2)} more than you borrow`} />
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
    // The shared loan moves with this account's change too; repayments held by the vault are
    // ignored here, so this errs on the cautious side.
    const tColl = v.troveColl + newColl - coll
    const tDebt = v.troveDebt + (newDebt > debt ? newDebt - debt : 0n)
    const shared = tColl > 0n ? toNum(tDebt * MEZO_MCR / tColl) : 0
    const own = newDebt === 0n || newColl === 0n ? null : toNum(newDebt * p.closeRatio / newColl)
    const isAnchor = !!account && account.toLowerCase() === v.anchor.toLowerCase()
    const closeAt = own === null ? null : isAnchor ? shared : Math.max(own, shared)
    return { newColl, newDebt, fees, ratio, closeAt }
  }, [tab, wei, m, p, price, v, account])

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
          {tab === 'borrow' && <Row k="To pay off in full" v={`${fmtMusd(preview.newDebt, 2)}, ${fmtMusd(preview.fees, 2)} more than you receive`} />}
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
