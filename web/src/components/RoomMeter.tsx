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
          ? `Your loan is bigger than the room left, so Mezo raises the limit first. That adds a one-time fee of about ${fmtMusd(cost, 2)} to your loan.`
          : `Loans up to ${fmtMusd(room, 0)} have no extra fee. A bigger one adds a one-time fee of about ${fmtMusd(cost, 2)}.`}
        {' '}
        <button className="link-btn inline" onClick={() => setOpen(!open)} aria-expanded={open}>{open ? 'Hide' : 'Why?'}</button>
      </p>
      {open && (
        <p className="room-why">
          Everyone here borrows from one shared Mezo loan, and Mezo sets a limit on how big that loan can grow. It sets the limit from the BTC in the loan on the day it is set. When loans fill it up, the next person to borrow pays Mezo a small one-time fee to raise the limit to match all the BTC in the loan today (Mezo calls this a refinance). Nobody else pays, and nothing changes for loans already taken.
        </p>
      )}
    </div>
  )
}
