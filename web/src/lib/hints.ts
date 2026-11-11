import { parseAbi, type Address } from 'viem'
import { publicClient } from './chain'
import { ADDR, ZERO } from './config'

// Mezo keeps every trove in a list sorted by its collateral ratio. Each call that changes the
// vault's trove must re-insert it, and Mezo walks the list from the two "hints" it is given.
// Without hints it walks from the top, which costs more gas the more troves there are. These
// hints come from a free read of Mezo's own SortedTroves, done before the transaction.

const tmAbi = parseAbi([
  'function getEntireDebtAndColl(address) view returns (uint256 coll, uint256 principal, uint256 interest, uint256 pendingColl, uint256 pendingPrincipal, uint256 pendingInterest)',
])
const stAbi = parseAbi([
  'function findInsertPosition(uint256 nicr, address prevId, address nextId) view returns (address, address)',
  'function getPrev(address) view returns (address)',
  'function getNext(address) view returns (address)',
])

export type Hints = readonly [Address, Address]
export const NO_HINTS: Hints = [ZERO, ZERO]

/**
 * Hints for the vault's trove after its BTC changes by `dColl` and its principal by `dPrincipal`.
 * A slightly wrong hint only costs a little gas, never a failed transaction, so any error falls
 * back to no hints.
 */
export async function hintsFor(dColl: bigint, dPrincipal: bigint): Promise<Hints> {
  try {
    const [t, prev, next] = await Promise.all([
      publicClient.readContract({ address: ADDR.troveManager, abi: tmAbi, functionName: 'getEntireDebtAndColl', args: [ADDR.vault] }),
      publicClient.readContract({ address: ADDR.sortedTroves, abi: stAbi, functionName: 'getPrev', args: [ADDR.vault] }),
      publicClient.readContract({ address: ADDR.sortedTroves, abi: stAbi, functionName: 'getNext', args: [ADDR.vault] }),
    ])
    const coll = t[0] + dColl
    const principal = t[1] + dPrincipal
    if (coll <= 0n || principal <= 0n) return NO_HINTS
    const nicr = (coll * 10n ** 20n) / principal
    const [up, low] = await publicClient.readContract({
      address: ADDR.sortedTroves, abi: stAbi, functionName: 'findInsertPosition', args: [nicr, prev, next],
    })
    // The vault's own entry is taken out before it is re-inserted, so it cannot be its own hint.
    const v = ADDR.vault.toLowerCase()
    return [up.toLowerCase() === v ? prev : up, low.toLowerCase() === v ? next : low]
  } catch {
    return NO_HINTS
  }
}
