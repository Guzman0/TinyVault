import { useApp } from '../state'
import { explorerAddress } from '../lib/chain'
import { ADDR } from '../lib/config'
import { fmtBtc, fmtMusd, fmtRatio, fmtUsd, toNum } from '../lib/format'
import { Stat } from './ui'

export function VaultPanel() {
  const { vault } = useApp()
  if (!vault) return null
  const ONE = 10n ** 18n
  return (
    <section className="panel">
      <div className="panel-head">
        <h2>The shared Mezo loan</h2>
        <a className="small-link" href={explorerAddress(ADDR.vault)} target="_blank" rel="noreferrer">View on Mezo explorer</a>
      </div>
      <p className="muted">
        Mezo sees one loan. TinyVault keeps the ledger of who put in which BTC and who owes what.
      </p>
      <div className="stats four">
        <Stat k="BTC in the loan" v={fmtBtc(vault.troveColl)} sub={`Worth ${fmtUsd(toNum(vault.troveColl * vault.price / ONE))}`} />
        <Stat k="Owed to Mezo" v={fmtMusd(vault.troveDebt, 0)} sub="Includes Mezo's 200 MUSD gas deposit" />
        <Stat k="Ratio Mezo sees" v={fmtRatio(vault.ratio)} sub="Mezo's line is 110%" />
        <Stat k="Reserve" v={fmtMusd(vault.reserve)} sub="Pays first if an account falls short" />
      </div>
      <p className="footnote">
        BTC {fmtUsd(toNum(vault.price))} from Mezo's price feed. Mezo's minimum loan is {fmtMusd(vault.minNetDebt, 0)}, read live from its contract.
        {vault.idle > 0n && ` ${fmtMusd(vault.idle)} of repayments is held against the loan and lent out again first.`}
      </p>
    </section>
  )
}
