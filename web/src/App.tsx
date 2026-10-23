import { useState } from 'react'
import { AppProvider, useApp } from './state'
import { AccountPanel } from './components/AccountPanel'
import { VaultPanel } from './components/VaultPanel'
import { Accounts } from './components/Accounts'
import { explorerAddress } from './lib/chain'
import { ADDR } from './lib/config'
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
          <span className="net"><i />Mezo Testnet</span>
          {account ? (
            <span className="chip-addr mono">{shortAddr(account)}{balances ? ` · ${fmtNum(toNum(balances.musd), 2)} MUSD` : ''}</span>
          ) : (
            <button className="btn small" onClick={() => connect().catch((e) => setErr(errorText(e)))}>Connect wallet</button>
          )}
        </div>
      </header>
      {err && <div className="notice bad">{err}</div>}
      {loadError && <div className="notice bad">{loadError}</div>}

      <main>
        <section className="hero">
          <div className="hero-copy">
            <h1>Borrow $20 against your Bitcoin.</h1>
            <p className="lede">
              Mezo's smallest loan is {vault ? fmtMusd(vault.minNetDebt, 0) : '1,800 MUSD'}, which takes about $3,000 of BTC.
              TinyVault shares one Mezo loan between many people, so you can borrow from {params ? fmtNum(toNum(params.minBorrow), 0) : '10'} MUSD with the BTC you have, and keep your Bitcoin.
            </p>
            <div className="compare">
              <div><span>Smallest loan on Mezo</span><strong>{vault ? fmtNum(toNum(vault.minNetDebt), 0) : '1,800'} MUSD</strong></div>
              <div className="accent"><span>Smallest loan here</span><strong>{params ? fmtNum(toNum(params.minBorrow), 0) : '10'} MUSD</strong></div>
            </div>
            <ol className="steps">
              <li><b>Add BTC.</b> It goes into the shared Mezo loan, recorded under your name.</li>
              <li><b>Borrow MUSD</b> up to two thirds of its value. Your limit is yours alone.</li>
              <li><b>Repay any time</b> and take your BTC back.</li>
            </ol>
          </div>
          <AccountPanel />
        </section>

        <VaultPanel />
        <Accounts />

        <section className="fair">
          <h2>How one shared loan stays fair</h2>
          <div className="cards">
            <div className="card"><h3>Your own limit</h3><p>Each account has its own ratio. Borrowing and withdrawing must keep it at 150% or more.</p></div>
            <div className="card"><h3>One account closes alone</h3><p>Below 125% anyone can pay off that account and take its BTC worth the debt plus 5%. Nothing is sold on a market, and others are untouched.</p></div>
            <div className="card"><h3>Reserve pays first</h3><p>A 0.5% fee on each loan builds a reserve. If an account's BTC falls short before it is closed, the reserve covers the gap.</p></div>
            <div className="card"><h3>Redemptions split by debt</h3><p>When Mezo redeems against the loan, BTC leaves each account in proportion to its debt, matching the debt cancelled. Nobody loses value to anyone else.</p></div>
          </div>
        </section>
      </main>

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
