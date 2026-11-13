import { useState } from 'react'
import { useApp } from '../state'
import { refinanceCost, roomLeft } from '../lib/data'
import { fmtMusd, fmtNum, toNum } from '../lib/format'

/**
 * How much the shared loan can still grow before Mezo has to raise its limit, in words a
 * borrower who has never heard of a refinance can follow.
 */
export function RoomMeter({ asking }: { asking?: bigint }) {
  const { vault, params } = useApp()
  const [open, setOpen] = useState(false)
  if (!vault || !params || vault.closed || vault.troveCap === 0n) return null
  const room = roomLeft(vault)
  const used = toNum(vault.mezoDebt) / toNum(vault.troveCap)
  const cost = refinanceCost(vault, params.mezoFeeRate)
  const over = asking !== undefined && asking > 0n && asking > room
  return (
    <div className={`room${over ? ' over' : ''}`}>
      <div className="room-head">
        <span>Room left in the shared loan</span>
        <span><b className="mono">{fmtMusd(room, 0)}</b> of {fmtNum(toNum(vault.troveCap), 0)}</span>
      </div>
      <div className="room-bar" role="img" aria-label={`${Math.round(used * 100)}% of the shared loan's limit is in use`}>
        <span style={{ width: `${Math.min(used, 1) * 100}%` }} />
      </div>
      <p className="room-line">
        {over
          ? `Your loan is bigger than the room left, so Mezo first updates the limit to the BTC in the loan today. Mezo charges a one-time fee of about ${fmtMusd(cost, 2)} for that, added to your loan.`
          : `Loans up to ${fmtMusd(room, 0)} have no extra fee. A bigger one makes Mezo update the limit, for a one-time fee of about ${fmtMusd(cost, 2)}.`}
        {' '}
        <button className="link-btn inline" onClick={() => setOpen(!open)} aria-expanded={open}>{open ? 'Hide' : 'Why?'}</button>
      </p>
      {open && (
        <p className="room-why">
          Everyone here borrows from one shared Mezo loan, and Mezo sets a limit on how big that loan can grow: what the BTC in it could back on the day the limit was set. Adding BTC does not move the limit by itself. When loans fill it up, Mezo works the limit out again from all the BTC in the loan today, and charges the person whose loan needs the room a small one-time fee for doing it <b>(Mezo calls this a refinance)</b>. Nobody else pays the fee. A refinance also moves the shared loan to Mezo's current interest rate, for everyone in it; today that is the same rate, so nothing changes.
        </p>
      )}
    </div>
  )
}
