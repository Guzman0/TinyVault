import { useApp } from '../state'
import { fmtBtc, fmtMusd, fmtNum, toNum } from '../lib/format'

/**
 * The idea in one picture: many people, one ledger, one Mezo loan. BTC flows right into the
 * shared loan; MUSD flows back left to each person. Filled with the vault's live numbers.
 */
export function HowItWorks() {
  const { vault, accounts, account, params } = useApp()
  const me = account?.toLowerCase()
  const people = accounts
    .filter((a) => a.coll > 0n && a.address.toLowerCase() !== vault?.anchor.toLowerCase())
    .sort((a, b) => (b.coll > a.coll ? 1 : -1))
  const shown = people.slice(0, 3)
  const more = people.length - shown.length
  const min = vault ? fmtNum(toNum(vault.minNetDebt), 0) : '1,800'
  const from = params ? fmtNum(toNum(params.minBorrow), 0) : '10'

  return (
    <div className="how">
      <div className="how-flow">
        <div className="how-node">
          <h3>You and other borrowers</h3>
          <ul className="how-people">
            {shown.map((a) => (
              <li key={a.address} className={a.address.toLowerCase() === me ? 'you' : ''}>
                <span className="mono">{a.address.toLowerCase() === me ? 'You' : `${a.address.slice(0, 6)}…${a.address.slice(-4)}`}</span>
                <b className="mono">{fmtBtc(a.coll)}</b>
              </li>
            ))}
            {shown.length === 0 && <li><span>Anyone with a little BTC</span></li>}
            {more > 0 && <li className="more"><span>and {more} more</span></li>}
          </ul>
        </div>

        <Arrows right="BTC in" left="MUSD out" />

        <div className="how-node vault">
          <h3>TinyVault</h3>
          <p>Keeps the ledger: whose BTC is whose, who owes what, and each account's own limit and close line.</p>
        </div>

        <Arrows right="All the BTC" left="MUSD" />

        <div className="how-node mezo">
          <h3>One Mezo loan</h3>
          {vault ? (
            <p><b className="mono">{fmtBtc(vault.troveColl)}</b> backing <b className="mono">{fmtMusd(vault.troveDebt, 0)}</b>. The anchor covers Mezo's {min} MUSD minimum, so everyone else can borrow from {from} MUSD.</p>
          ) : (
            <p>The anchor covers Mezo's {min} MUSD minimum, so everyone else can borrow from {from} MUSD.</p>
          )}
        </div>
      </div>

      <ol className="how-points">
        <li><b>Your BTC joins one shared Mezo loan</b>, recorded under your address. It is still yours.</li>
        <li><b>You borrow up to your own limit.</b> Mezo lends to the vault, and the vault passes the MUSD to you. Fees and interest are split by what each person borrowed.</li>
        <li><b>Each account stands alone.</b> Below 125% only that account is closed, and the rest of the vault is untouched. Repay and your BTC comes back.</li>
      </ol>
    </div>
  )
}

function Arrows({ right, left }: { right: string; left: string }) {
  return (
    <div className="how-arrows" aria-hidden="true">
      <span className="to">{right}</span>
      <span className="back">{left}</span>
    </div>
  )
}
