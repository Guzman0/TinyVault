import { useApp } from '../state'
import { closeAccount } from '../lib/actions'
import { explorerAddress } from '../lib/chain'
import { fmtBtc, fmtMusd, fmtRatio, fmtUsd, shortAddr, toNum } from '../lib/format'
import { Gauge, TxButton } from './ui'

export function Accounts() {
  const { accounts, params, vault, account, wallet, loading } = useApp()
  if (!params || !vault) return null
  const rows = [...accounts].sort((a, b) => (a.ratio < b.ratio ? -1 : 1))
  return (
    <section className="panel">
      <div className="panel-head">
        <h2>Every account in the vault</h2>
        <span className="muted small">{rows.length} {rows.length === 1 ? 'account' : 'accounts'}</span>
      </div>
      <p className="muted">
        Below {Math.round(toNum(params.closeRatio) * 100)}% anyone can close an account: they pay its debt and receive its BTC worth the debt plus {Math.round(toNum(params.closeBonus) * 100)}%. The rest stays with the owner, and no other account is touched.
      </p>
      <div className="table">
        <div className="tr th"><span>Account</span><span>BTC</span><span>Owes</span><span>Health</span><span /></div>
        {loading && rows.length === 0 && <div className="empty">Reading accounts from Mezo testnet</div>}
        {rows.map((a) => {
          const closable = a.debt > 0n && a.ratio < params.closeRatio
          return (
            <div className="tr" key={a.address}>
              <span>
                <a href={explorerAddress(a.address)} target="_blank" rel="noreferrer" className="mono">{shortAddr(a.address)}</a>
                {a.address.toLowerCase() === vault.anchor.toLowerCase() && <span className="tag">Anchor</span>}
                {account && a.address.toLowerCase() === account.toLowerCase() && <span className="tag you">You</span>}
              </span>
              <span className="mono">{fmtBtc(a.coll)}</span>
              <span className="mono">{fmtMusd(a.debt)}</span>
              <span className="health">
                <Gauge ratio={a.ratio} closeRatio={params.closeRatio} openRatio={params.openRatio} compact />
                <span className="mono">{fmtRatio(a.ratio)}</span>
              </span>
              <span>
                {closable ? (
                  account && wallet ? (
                    <TxButton label={`Close (pay ${fmtMusd(a.debt, 0)})`} done="Closed." run={(s) => closeAccount(wallet, account, a.address, a.debt, s)} />
                  ) : <span className="pill bad">Can be closed</span>
                ) : (
                  <span className="muted small">{a.debt > 0n ? `Closes at ${fmtUsd(toNum(a.closePrice))}` : 'No loan'}</span>
                )}
              </span>
            </div>
          )
        })}
      </div>
    </section>
  )
}
