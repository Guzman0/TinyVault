import { useEffect, useRef } from 'react'
import { useApp } from '../state'
import { fmtBtc, fmtMusd, fmtNum, fmtPct, toNum } from '../lib/format'

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
  const flow = useRef<HTMLDivElement>(null)
  const svg = useRef<SVGSVGElement>(null)
  useBeams(flow, svg, shown.length)

  return (
    <div className="how">
      <p className="how-why">
        <b>Why one shared loan?</b> Every loan on Mezo must be at least {min} MUSD, so a {from} MUSD loan of your own is not allowed.
        TinyVault opens one loan big enough for Mezo and splits it between everyone, each with their own BTC, debt and limit.
      </p>
      <div className="how-flow" ref={flow}>
        <svg className="how-beams" ref={svg} aria-hidden="true" />
        <div className="how-node">
          <h3>You and other borrowers</h3>
          <ul className="how-people">
            {shown.map((a) => (
              <li key={a.address} data-beam="" className={a.address.toLowerCase() === me ? 'you' : ''}>
                <span className="mono">{a.address.toLowerCase() === me ? 'You' : `${a.address.slice(0, 6)}…${a.address.slice(-4)}`}</span>
                <b className="mono">{fmtBtc(a.coll)}</b>
              </li>
            ))}
            {shown.length === 0 && <li data-beam=""><span>Anyone with a little BTC</span></li>}
            {more > 0 && <li className="more"><span>and {more} more</span></li>}
          </ul>
        </div>

        <div className="how-node vault" data-vault="">
          <h3>TinyVault</h3>
          <p>Keeps the ledger: whose BTC is whose, who owes what, and each account's own limit and close line.</p>
        </div>

        <div className="how-node mezo" data-mezo="">
          <h3>One Mezo loan</h3>
          {vault ? (
            <p><b className="mono">{fmtBtc(vault.troveColl)}</b> backing <b className="mono">{fmtMusd(vault.troveDebt, 0)}</b>. The anchor covers Mezo's {min} MUSD minimum, so everyone else can borrow from {from} MUSD.</p>
          ) : (
            <p>The anchor covers Mezo's {min} MUSD minimum, so everyone else can borrow from {from} MUSD.</p>
          )}
        </div>
      </div>

      <p className="how-legend" aria-hidden="true"><span><i className="btc" />BTC going in</span><span><i className="musd" />MUSD coming back</span></p>

      <ol className="how-points">
        <li><b>Your BTC joins one shared Mezo loan</b>, recorded under your address. It is still yours.</li>
        <li><b>You borrow up to your own limit.</b> Mezo lends to the vault, and the vault passes the MUSD to you. Fees and interest are split by what each person borrowed.</li>
        <li><b>Each account stands alone.</b> Below {params ? fmtPct(params.closeRatio) : '125%'} only that account is closed, and the rest of the vault is untouched. Repay and your BTC comes back.</li>
      </ol>
    </div>
  )
}

/**
 * Beams between the boxes: one from each borrower into the ledger, one from the ledger into the
 * Mezo loan. An orange pulse carries BTC in, a dark one carries MUSD back. Redrawn whenever the
 * layout changes; across the page on wide screens, top to bottom when the boxes stack.
 */
function useBeams(flow: React.RefObject<HTMLDivElement>, svg: React.RefObject<SVGSVGElement>, rows: number) {
  useEffect(() => {
    const root = flow.current, out = svg.current
    if (!root || !out) return
    const draw = () => {
      const c = root.getBoundingClientRect()
      const vault = root.querySelector<HTMLElement>('[data-vault]'), mezo = root.querySelector<HTMLElement>('[data-mezo]')
      if (!vault || !mezo) return
      const v = vault.getBoundingClientRect(), m = mezo.getBoundingClientRect()
      const stacked = v.top > root.querySelector('.how-node')!.getBoundingClientRect().bottom - 1
      const at = (r: DOMRect, side: 'r' | 'l' | 't' | 'b', shift = 0) =>
        side === 'r' ? { x: r.right - c.left, y: r.top + r.height / 2 - c.top + shift }
        : side === 'l' ? { x: r.left - c.left, y: r.top + r.height / 2 - c.top + shift }
        : side === 't' ? { x: r.left + r.width / 2 - c.left + shift, y: r.top - c.top }
        : { x: r.left + r.width / 2 - c.left + shift, y: r.bottom - c.top }
      const curve = (a: { x: number; y: number }, b: { x: number; y: number }) => {
        if (stacked) { const my = (a.y + b.y) / 2; return `M${a.x},${a.y} C${a.x},${my} ${b.x},${my} ${b.x},${b.y}` }
        const mx = (a.x + b.x) / 2; return `M${a.x},${a.y} C${mx},${a.y} ${mx},${b.y} ${b.x},${b.y}`
      }
      const paths: string[] = []
      const people = [...root.querySelectorAll<HTMLElement>('[data-beam]')]
      const box = root.querySelector<HTMLElement>('.how-node')!.getBoundingClientRect()
      people.forEach((el, i) => {
        const r = el.getBoundingClientRect(), spread = (i - (people.length - 1) / 2) * 14
        paths.push(stacked
          ? curve({ x: r.left + r.width / 2 - c.left + spread * 2, y: box.bottom - c.top }, at(v, 't', spread))
          : curve(at(r, 'r'), at(v, 'l', spread)))
      })
      paths.push(stacked ? curve(at(v, 'b'), at(m, 't')) : curve(at(v, 'r'), at(m, 'l')))
      // One clock for every beam: BTC leaves all borrowers together, runs on into Mezo, then MUSD
      // comes back from Mezo and out to all borrowers together.
      const last = paths.length - 1
      out.innerHTML = paths.map((d, i) => {
        const leg = i === last ? 'leg2' : 'leg1'
        return `<path class="beam-base" d="${d}"/><path class="beam-pulse btc ${leg}" pathLength="100" d="${d}"/><path class="beam-pulse musd ${leg}" pathLength="100" d="${d}"/>`
      }).join('')
    }
    draw()
    const ro = new ResizeObserver(draw)
    ro.observe(root)
    window.addEventListener('resize', draw)
    return () => { ro.disconnect(); window.removeEventListener('resize', draw) }
  }, [flow, svg, rows])
}
