import { useEffect, useState } from 'react'
import { AppProvider, useApp } from './state'
import { AccountPanel } from './components/AccountPanel'
import { VaultPanel } from './components/VaultPanel'
import { Accounts } from './components/Accounts'
import { ActivityFeed, StatusBanner } from './components/Status'
import { Demo } from './components/Demo'
import { Entry } from './components/Rail'
import { Journey, FollowBar } from './components/Journey'
import { addMezo, explorerAddress, hasWallet, onMezo, onWalletChange } from './lib/chain'
import { ADDR, OTHER_VAULT, WAVE1_VAULT } from './lib/config'
import { errorText, fmtMusd, fmtNum, shortAddr, toNum } from './lib/format'

export default function App() {
  return (
    <AppProvider>
      <Page />
    </AppProvider>
  )
}

function Page() {
  const { account, connect, balances, vault, params, loadError } = useApp()
  const [err, setErr] = useState('')
  return (
    <div className="wrap">
      <header className="top">
        <div className="brand"><VaultMark />TinyVault</div>
        <div className="top-right">
          <NetworkButton onError={setErr} />
          {account ? (
            <span className="chip-addr mono">{shortAddr(account)}{balances ? ` · ${fmtNum(toNum(balances.musd), 2)} MUSD` : ''}</span>
          ) : (
            <button className="btn small" onClick={() => connect().catch((e) => setErr(errorText(e)))}>Connect wallet</button>
          )}
        </div>
      </header>
      {err && <div className="notice bad">{err}</div>}
      {loadError && <div className="notice bad">{loadError}</div>}
      {OTHER_VAULT && (
        <div className="notice warn">
          You are looking at {ADDR.vault.toLowerCase() === WAVE1_VAULT.toLowerCase() ? 'the Wave 1 vault' : 'another vault'}, {ADDR.vault.slice(0, 6)}…{ADDR.vault.slice(-4)}. It has no wind-down, so repay and withdraw here, then use the <a href={import.meta.env.BASE_URL}>current vault</a>.
        </div>
      )}
      <StatusBanner />

      <main>
        <Entry index={0} label="Borrow">
        <section className="hero">
          <div className="hero-copy">
            <h1>Borrow $20 against your Bitcoin.</h1>
            <p className="lede">
              Mezo's smallest loan is {vault ? fmtMusd(vault.minNetDebt, 0) : '1,800 MUSD'}, which takes about $3,000 of BTC.
              TinyVault shares one Mezo loan between many people, so you can borrow from {params ? fmtNum(toNum(params.minBorrow), 0) : '10'} MUSD with the BTC you have, and keep your Bitcoin.
            </p>
            <MinimumPicture min={vault ? toNum(vault.minNetDebt) : 1800} here={params ? toNum(params.minBorrow) : 10} />
            <Journey />
          </div>
          <AccountPanel />
        </section>
        </Entry>

        <Entry index={1} label="Watch a loan" title="Watch a real loan, no wallet needed"><Demo /></Entry>
        <Entry index={2} label="The shared loan" title="One Mezo loan, many owners"><VaultPanel /></Entry>
        <Entry index={3} label="Every account" title="Every account, each with its own line"><Accounts /></Entry>
        <Entry index={4} label="What happened" title="Everything that happened"><ActivityFeed /></Entry>

        <Entry index={5} label="Why it's fair" title="How one shared loan stays fair">
        <section className="fair">
          <div className="cards">
            <div className="card"><h3>Your own limit</h3><p>Each account has its own ratio. Borrowing and withdrawing must keep it at 150% or more.</p></div>
            <div className="card"><h3>One account closes alone</h3><p>Below 125% anyone can pay off that account and take its BTC worth the debt plus 5%. Nothing is sold on a market, and others are untouched.</p></div>
            <div className="card"><h3>Reserve pays first</h3><p>A 0.5% fee on each loan builds a reserve. If an account's BTC falls short before it is closed, the reserve covers the gap.</p></div>
            <div className="card"><h3>Redemptions split by debt</h3><p>When Mezo redeems against the loan, BTC leaves each account in proportion to its debt, matching the debt cancelled. Nobody loses value to anyone else.</p></div>
          </div>
        </section>
        </Entry>
      </main>
      <FollowBar />

      <footer className="foot">
        <span>Built on Mezo testnet. Loans in MUSD, Mezo's Bitcoin-backed dollar.</span>
        <a href={explorerAddress(ADDR.vault)} target="_blank" rel="noreferrer">Vault contract</a>
        <a href="https://github.com/Guzman0/TinyVault" target="_blank" rel="noreferrer">Code</a>
        <a href="https://faucet.test.mezo.org" target="_blank" rel="noreferrer">Testnet faucet</a>
      </footer>
    </div>
  )
}

function VaultMark() {
  return (
    <svg width="26" height="26" viewBox="0 0 26 26" aria-hidden="true">
      <rect x="2" y="2" width="22" height="22" rx="6" fill="#F7931A" />
      <circle cx="13" cy="13" r="5.2" fill="none" stroke="#1B1A17" strokeWidth="2.2" />
      <path d="M13 7.8v2.4M13 15.8v2.4M7.8 13h2.4M15.8 13h2.4" stroke="#1B1A17" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  )
}

/**
 * The network pill. With a wallet on Mezo Testnet it is a quiet green label; on any other network
 * (or before the wallet has the network) it becomes a one-tap button that adds and switches.
 */
function NetworkButton({ onError }: { onError: (s: string) => void }) {
  const [ok, setOk] = useState<boolean | null>(null)
  useEffect(() => {
    const check = () => { onMezo().then(setOk) }
    check()
    onWalletChange(check)
  }, [])
  if (!hasWallet() || ok) return <span className="net"><i />Mezo Testnet</span>
  return (
    <button className="net net-switch" onClick={() => addMezo().then(() => onMezo().then(setOk)).catch((e) => onError(errorText(e)))}>
      <i />{ok === false ? 'Switch to Mezo Testnet' : 'Add Mezo Testnet'}
    </button>
  )
}

/** Mezo's smallest loan drawn to scale against TinyVault's: the gap is the whole pitch. */
function MinimumPicture({ min, here }: { min: number; here: number }) {
  const pct = Math.max((here / min) * 100, 0.6)
  return (
    <figure className="minpic" aria-label={`Smallest loan on Mezo ${fmtNum(min, 0)} MUSD; smallest loan here ${fmtNum(here, 0)} MUSD`}>
      <div className="minpic-row">
        <span className="minpic-name">Smallest loan on Mezo</span>
        <div className="minpic-bar mezo"><span style={{ width: '100%' }} /></div>
        <strong className="mono">{fmtNum(min, 0)} MUSD</strong>
      </div>
      <div className="minpic-row">
        <span className="minpic-name">Smallest loan here</span>
        <div className="minpic-bar here"><span style={{ width: `${pct}%` }} /></div>
        <strong className="mono">{fmtNum(here, 0)} MUSD</strong>
      </div>
      <figcaption>Drawn to scale. Most people holding Bitcoin need something closer to the bottom bar.</figcaption>
    </figure>
  )
}
