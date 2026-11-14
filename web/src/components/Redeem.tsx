import { useEffect, useState } from 'react'
import { parseUnits } from 'viem'
import { useApp } from '../state'
import { firstInRedemptionLine, redeem } from '../lib/actions'
import { GAS_COMP } from '../lib/data'
import { fmtMusd, fmtUsd, toNum } from '../lib/format'
import { Stat, TxButton } from './ui'

/**
 * Stress vault only. A Mezo redemption swaps MUSD for BTC from the riskiest troves on Mezo first.
 * This vault's loan sits at the low end of Mezo's list, so a small redemption lands here, and the
 * vault's split of it by debt can be checked on chain.
 */
export function Redeem() {
  const { vault, wallet, account, balances, activity } = useApp()
  const [first, setFirst] = useState<boolean | null>(null)
  const [amount, setAmount] = useState('20')
  useEffect(() => { firstInRedemptionLine().then(setFirst).catch(() => setFirst(null)) }, [vault?.mezoDebt])
  if (!vault) return null

  // Mezo keeps every loan at 1,800 MUSD of net debt or more, so only the part above can be redeemed.
  const net = vault.mezoDebt > GAS_COMP ? vault.mezoDebt - GAS_COMP : 0n
  const room = net > vault.minNetDebt + 10n ** 18n ? net - vault.minNetDebt - 10n ** 18n : 0n
  let wei: bigint | null = null
  try { wei = parseUnits(amount || '0', 18) } catch { wei = null }
  const holds = balances?.musd ?? 0n
  const problem = !wei || wei === 0n ? 'Enter an amount.'
    : wei > room ? `At most ${fmtMusd(room)} now: Mezo keeps every loan at ${fmtMusd(vault.minNetDebt, 0)} or more.`
    : account && wei > holds ? `Your wallet holds ${fmtMusd(holds)}.`
    : first === false ? 'Another Mezo loan is riskier right now, so a redemption would start there, not here.'
    : ''
  const done = activity.filter((a) => a.kind === 'redeem').length

  return (
    <section className="panel">
      <p>
        Anyone holding MUSD can hand it to Mezo for BTC worth the same in dollars, less Mezo's redemption fee. Mezo takes the BTC
        from the riskiest loans first. This vault's shared loan sits at the risky end on purpose, so a small redemption lands here.
      </p>
      <p className="muted">
        The vault then takes the BTC from each account in proportion to its debt, and cancels the same share of each account's debt,
        so nobody's net worth moves. Compare the accounts before and after.
      </p>
      <div className="stats">
        <Stat k="First in Mezo's redemption line" v={first === null ? '…' : first ? 'Yes, this vault' : 'No'} sub={first ? 'A redemption starts here' : 'A redemption would start at a riskier loan'} />
        <Stat k="Can be redeemed now" v={fmtMusd(room)} sub={`Mezo keeps ${fmtMusd(vault.minNetDebt, 0)} of the loan`} />
        <Stat k="Redemptions so far" v={String(done)} sub={`BTC at ${fmtUsd(toNum(vault.price))}`} />
      </div>
      <div className="form">
        <label className="field">
          <span>MUSD to redeem</span>
          <div className="input-row">
            <input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
            <span className="unit">MUSD</span>
          </div>
        </label>
        {problem && amount && <p className="muted small">{problem}</p>}
        {account && wallet ? (
          <TxButton
            label={`Redeem ${amount || 0} MUSD for BTC`}
            done="Redeemed. The vault has split it by debt."
            disabled={!!problem}
            run={(s) => redeem(wallet, account, wei!, vault.price, s)}
          />
        ) : <p className="muted small">Connect a wallet that holds MUSD to redeem.</p>}
      </div>
    </section>
  )
}
