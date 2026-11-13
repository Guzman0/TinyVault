import { useApp } from '../state'
import { sharedClosePrice } from '../lib/data'
import { explorerAddress } from '../lib/chain'
import { ADDR } from '../lib/config'
import { fmtBtc, fmtMusd, fmtRatio, fmtUsd, toNum } from '../lib/format'
import { Stat } from './ui'
import { WindDown } from './Status'

export function VaultPanel() {
  const { vault } = useApp()
  if (!vault) return null
  const ONE = 10n ** 18n
  return (
    <section className="panel">
      <div className="panel-head">
        <span />
        <a className="small-link" href={explorerAddress(ADDR.vault)} target="_blank" rel="noreferrer">View on Mezo explorer</a>
      </div>
      <p className="muted">Mezo sees one loan. TinyVault keeps the ledger of whose BTC is in it.</p>
      <ShareBar />
      <div className="stats five">
        <Stat k="BTC in the loan" v={fmtBtc(vault.troveColl)} sub={`Worth ${fmtUsd(toNum(vault.troveColl * vault.price / ONE))}`} />
        <Stat k="Owed to Mezo" v={fmtMusd(vault.troveDebt, 0)} sub="Includes Mezo's 200 MUSD gas deposit" />
        <Stat k="Ratio Mezo sees" v={vault.closed ? 'Closed' : fmtRatio(vault.ratio)} sub={vault.closed ? "Mezo's line is 110%" : `Mezo's line is 110%: BTC at ${fmtUsd(toNum(sharedClosePrice(vault)))}`} />
        <Stat k="Reserve" v={fmtMusd(vault.reserve)} sub="Pays first if an account falls short" />
        {vault.troveCap > 0n && !vault.closed && (
          <Stat
            k="Room left to borrow"
            v={fmtMusd(vault.troveCap > vault.mezoDebt ? vault.troveCap - vault.mezoDebt : 0n, 0)}
            sub={`Mezo's limit for this loan is ${fmtMusd(vault.troveCap, 0)}. Past it, Mezo updates the limit to the BTC in the loan, for a small fee.`}
          />
        )}
      </div>
      <p className="footnote">
        BTC {fmtUsd(toNum(vault.price))} from Mezo's price feed. Mezo's minimum loan is {fmtMusd(vault.minNetDebt, 0)}, read live from its contract.
        {vault.idle > 0n && ` ${fmtMusd(vault.idle)} of repayments is held against the loan and lent out again first.`}
      </p>
      <WindDown />
    </section>
  )
}

const SHADES = ['#F7931A', '#FBB35C', '#D97A06', '#FCCB8E', '#B86400']

/** The one shared loan, split by whose BTC is in it. */
function ShareBar() {
  const { vault, accounts, account } = useApp()
  if (!vault || vault.troveColl === 0n) return null
  const rows = accounts.filter((a) => a.coll > 0n).sort((a, b) => (b.coll > a.coll ? 1 : -1))
  const total = rows.reduce((t, a) => t + a.coll, 0n) || 1n
  const me = account?.toLowerCase()
  let k = 0
  const parts = rows.map((a) => {
    const anchor = a.address.toLowerCase() === vault.anchor.toLowerCase()
    const you = a.address.toLowerCase() === me
    const share = Number((a.coll * 10_000n) / total) / 100
    const color = anchor ? 'var(--ink)' : SHADES[k++ % SHADES.length]
    const name = anchor ? 'Anchor' : you ? 'You' : `${a.address.slice(0, 6)}…${a.address.slice(-4)}`
    return { key: a.address, share, color, name, you, btc: a.coll }
  })
  return (
    <figure className="sharebar">
      <div className="sharebar-track" role="img" aria-label={parts.map((p) => `${p.name} ${p.share}%`).join(', ')}>
        {parts.map((p) => (
          <span key={p.key} className={p.you ? 'you' : ''} style={{ flexGrow: p.share, background: p.color }} title={`${p.name}: ${fmtBtc(p.btc)}`} />
        ))}
      </div>
      <figcaption className="sharebar-legend">
        {parts.map((p) => (
          <span key={p.key}><i style={{ background: p.color }} />{p.name} <b className="mono">{p.share < 1 ? p.share.toFixed(1) : Math.round(p.share)}%</b></span>
        ))}
      </figcaption>
    </figure>
  )
}
