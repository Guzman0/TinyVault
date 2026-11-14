import { useApp } from '../state'
import { sharedClosePrice } from '../lib/data'
import { DEMO_ADDRESS } from '../lib/demo'
import { closeAccount } from '../lib/actions'
import { explorerAddress } from '../lib/chain'
import { fmtBtc, fmtMusd, fmtPct, fmtRatio, fmtUsd, shortAddr, toNum } from '../lib/format'
import { Gauge, TxButton } from './ui'

export function Accounts() {
  const { accounts, params, vault, account, wallet, loading } = useApp()
  if (!params || !vault) return null
  const rows = [...accounts].sort((a, b) => (a.ratio < b.ratio ? -1 : 1))
  return (
    <section className="panel">
      <div className="panel-head">
        <span />
        <span className="muted small">{rows.length} {rows.length === 1 ? 'account' : 'accounts'}</span>
      </div>
      <p className="muted">
        Each account closes at the first of two prices: its own {fmtPct(params.closeRatio)} line, or the price where Mezo closes the whole shared loan ({fmtUsd(toNum(sharedClosePrice(vault)))}). Below {Math.round(toNum(params.closeRatio) * 100)}% anyone can close an account: they pay its debt and receive its BTC worth the debt plus {Math.round(toNum(params.closeBonus) * 100)}%. The rest stays with the owner, and no other account is touched.
      </p>
      <div className="table">
        <div className="tr th"><span>Account</span><span>BTC</span><span>Owes</span><span>Health</span><span /></div>
        {loading && rows.length === 0 && <div className="empty">Reading accounts from Mezo testnet</div>}
        {rows.map((a) => {
          const forced = vault.forcedFrom > 0n && BigInt(Math.floor(Date.now() / 1000)) >= vault.forcedFrom
          const closable = !vault.closed && a.debt > 0n && (a.ratio < params.closeRatio || forced)
          return (
            <div className="tr" key={a.address}>
              <span>
                <a href={explorerAddress(a.address)} target="_blank" rel="noreferrer" className="mono">{shortAddr(a.address)}</a>
                {a.address.toLowerCase() === vault.anchor.toLowerCase() && <span className="tag">Anchor</span>}
                {account && a.address.toLowerCase() === account.toLowerCase() && <span className="tag you">You</span>}
                {a.address.toLowerCase() === DEMO_ADDRESS.toLowerCase() && <span className="tag">Demo</span>}
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
                    <TxButton label={`Close (pay ${fmtMusd(a.debt, 0)})`} done="Closed." run={(s) => closeAccount(wallet, account, a.address, a.debt, seizeOf(a.coll, a.debt, params.closeBonus, vault.price), s)} />
                  ) : <span className="pill bad">Can be closed</span>
                ) : (
                  <span className="muted small">{closeText(a, vault)}</span>
                )}
              </span>
            </div>
          )
        })}
      </div>
    </section>
  )
}

/** BTC a closer receives: the debt plus the bonus at today's price, capped at the account's BTC. */
function seizeOf(coll: bigint, debt: bigint, bonus: bigint, price: bigint) {
  const s = (debt * (10n ** 18n + bonus)) / price
  return s > coll ? coll : s
}

function closeText(a: { address: string; debt: bigint; closePrice: bigint }, vault: Parameters<typeof sharedClosePrice>[0]) {
  if (a.debt === 0n) return 'No loan'
  const shared = sharedClosePrice(vault)
  if (a.address.toLowerCase() === vault.anchor.toLowerCase()) return `Closes with the shared loan at ${fmtUsd(toNum(shared))}`
  if (shared > a.closePrice) return `Own line ${fmtUsd(toNum(a.closePrice))}, shared loan first at ${fmtUsd(toNum(shared))}`
  return `Closes at ${fmtUsd(toNum(a.closePrice))}`
}
