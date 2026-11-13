import { useApp } from '../state'
import { sharedClosePrice } from '../lib/data'
import { DEMO_ADDRESS } from '../lib/demo'
import { ADDR } from '../lib/config'
import { closeTrove, shutdown } from '../lib/actions'
import { explorerTx } from '../lib/chain'
import { fmtNum, fmtUsd, shortAddr, toNum } from '../lib/format'
import { TxButton } from './ui'

const DEAD_SHARES = 1000n
const date = (t: bigint) => new Date(Number(t) * 1000).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })

/** What state the vault is in, said plainly at the top of the page. */
export function StatusBanner() {
  const { vault } = useApp()
  if (!vault) return null
  if (vault.woundDown) {
    return <div className="notice good"><strong>This vault has been wound down.</strong> Its Mezo loan is repaid and closed, and all BTC is back in the vault. Withdraw yours below.</div>
  }
  if (vault.closed) {
    return <div className="notice bad"><strong>Mezo closed this vault's loan.</strong> Withdraw any BTC left in your account, and claim your share of the MUSD the vault was holding.</div>
  }
  const now = BigInt(Math.floor(Date.now() / 1000))
  const shared = sharedClosePrice(vault)
  const fall = shared > 0n ? 1 - toNum(shared) / toNum(vault.price) : 0
  return (
    <>
      {shared > 0n && (
        <div className={`notice shared ${fall < 0.3 ? 'bad' : fall < 0.5 ? 'warn' : 'calm'}`}>
          <div>
            <strong>The shared loan closes if BTC falls to {fmtUsd(toNum(shared))}</strong>, {Math.round(fall * 100)}% below today ({fmtUsd(toNum(vault.price))}).
          </div>
          <details className="small">
            <summary>What this means</summary>
            That is Mezo's 110% line for the one loan everyone shares. The anchor carries Mezo's minimum loan, so it cannot be closed on its own: it goes at this price, and so does every account that still owes, whatever its own ratio. Each account keeps the MUSD it borrowed. Adding BTC to the anchor moves this line down.
          </details>
        </div>
      )}
      {vault.shutdownAt > 0n && (
        <div className="notice warn">
          <strong>Winding down.</strong> No new deposits or loans. Repay and withdraw as usual.{' '}
          {now < vault.forcedFrom
            ? `From ${date(vault.forcedFrom)}, accounts that still owe can be closed by anyone.`
            : 'Accounts that still owe can now be closed by anyone.'}
        </div>
      )}
      {vault.recoveryMode && (
        <div className="notice warn">
          <strong>Mezo is in Recovery Mode</strong> (its whole system is below 150%). Mezo pauses BTC withdrawals until it recovers. You can still repay, and weak accounts can still be closed: the closer's BTC is held for them in the vault.
        </div>
      )}
    </>
  )
}

/** The vault's life cycle controls: shutdown (owner) and closing the Mezo loan (anyone). */
export function WindDown() {
  const { vault, account, wallet } = useApp()
  if (!vault || vault.closed) return null
  const isOwner = account && account.toLowerCase() === vault.owner.toLowerCase()
  const nobodyOwes = vault.totalShares <= DEAD_SHARES
  if (vault.shutdownAt === 0n && !isOwner) return null
  return (
    <div className="winddown">
      <h3>Winding down</h3>
      {vault.shutdownAt === 0n ? (
        <>
          <p className="muted small">You own this vault. Shutting it down stops new deposits and loans, gives borrowers 7 days to repay, then lets the Mezo loan be closed so every BTC comes back.</p>
          {wallet && account && <TxButton label="Shut the vault down" done="Shut down." run={(s) => shutdown(wallet, account, s)} />}
        </>
      ) : nobodyOwes ? (
        <>
          <p className="muted small">Nobody owes anything. Anyone can now repay and close the vault's Mezo loan; all BTC returns to the vault.</p>
          {wallet && account ? <TxButton label="Close the Mezo loan" done="Closed. Withdraw your BTC." run={(s) => closeTrove(wallet, account, s)} /> : <span className="muted small">Connect a wallet to close it.</span>}
        </>
      ) : (
        <p className="muted small">The Mezo loan can be closed once every account has repaid or been closed.</p>
      )}
    </div>
  )
}

/** Every action in the vault, linked to Mezo's explorer: the full life cycle on chain. */
export function ActivityFeed() {
  const { activity, vault, account } = useApp()
  if (!vault) return null
  const who = (a: string) => account && a.toLowerCase() === account.toLowerCase() ? 'You' : a.toLowerCase() === vault.anchor.toLowerCase() ? 'Anchor' : a.toLowerCase() === DEMO_ADDRESS.toLowerCase() ? 'Demo' : a.toLowerCase() === ADDR.vault.toLowerCase() ? 'Shared loan' : shortAddr(a as `0x${string}`)
  const people = new Set(activity.filter((a) => a.kind !== 'redeem' && a.kind !== 'redistribute' && a.kind !== 'shutdown' && a.kind !== 'wound').map((a) => a.account.toLowerCase()))
  return (
    <section className="panel">
      <div className="panel-head">
        <span />
        <span className="muted small">{fmtNum(activity.length, 0)} actions by {people.size} wallets</span>
      </div>
      <p className="muted">Read from the vault's events on Mezo testnet. Each line links to its transaction.</p>
      <div className="feed">
        {activity.length === 0 && <div className="empty">No activity yet</div>}
        {activity.slice(0, 40).map((a) => (
          <a key={a.hash + a.kind + a.text} className="feed-row" href={explorerTx(a.hash)} target="_blank" rel="noreferrer">
            <span className={`dot k-${a.kind}`} />
            <span className={`mono${who(a.account) === 'You' ? ' you' : ''}`}>{who(a.account)}</span>
            <span>{a.text}</span>
            <span className="muted small" title={`Block ${a.block.toString()}`}>{a.time ? ago(a.time) : `#${a.block.toString()}`}</span>
          </a>
        ))}
      </div>
    </section>
  )
}

function ago(ms: number) {
  const s = Math.max(0, (Date.now() - ms) / 1000)
  if (s < 90) return 'just now'
  if (s < 3600) return `${Math.round(s / 60)} min ago`
  if (s < 86400) return `${Math.round(s / 3600)} h ago`
  if (s < 7 * 86400) return `${Math.round(s / 86400)} d ago`
  return new Date(ms).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
}
