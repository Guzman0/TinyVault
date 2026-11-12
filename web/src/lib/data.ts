import { erc20Abi, parseAbi, parseAbiItem, type Address } from 'viem'
import { publicClient } from './chain'
import { ADDR, DEPLOY_BLOCK } from './config'
import { vaultAbi } from './vaultAbi'

const boAbi = parseAbi(['function borrowingRate() view returns (uint256)'])

export interface Params {
  openRatio: bigint
  closeRatio: bigint
  closeBonus: bigint
  minBorrow: bigint
  reserveFeeBps: number
  mezoFeeRate: bigint // 1e18 = 100%
}

export interface VaultState {
  troveColl: bigint
  troveDebt: bigint
  vaultDebt: bigint
  ratio: bigint
  price: bigint
  idle: bigint
  reserve: bigint
  minNetDebt: bigint
  closed: boolean
  anchor: Address
  owner: Address
  shutdownAt: bigint // 0 = open
  forcedFrom: bigint // when accounts still owing can be closed (0 = not shut down)
  woundDown: boolean
  recoveryMode: boolean
  totalShares: bigint
}

export interface AccountState {
  address: Address
  coll: bigint
  debt: bigint
  ratio: bigint
  maxBorrow: bigint
  closePrice: bigint
  claimable: bigint // MUSD to claim after Mezo closed the trove
}

const v = { address: ADDR.vault, abi: vaultAbi } as const

export async function loadParams(): Promise<Params> {
  const [openRatio, closeRatio, closeBonus, minBorrow, reserveFeeBps, mezoFeeRate] = await Promise.all([
    publicClient.readContract({ ...v, functionName: 'openRatio' }),
    publicClient.readContract({ ...v, functionName: 'closeRatio' }),
    publicClient.readContract({ ...v, functionName: 'closeBonus' }),
    publicClient.readContract({ ...v, functionName: 'minBorrow' }),
    publicClient.readContract({ ...v, functionName: 'reserveFeeBps' }),
    publicClient.readContract({ address: ADDR.borrowerOps, abi: boAbi, functionName: 'borrowingRate' }),
  ])
  return { openRatio, closeRatio, closeBonus, minBorrow, reserveFeeBps: Number(reserveFeeBps), mezoFeeRate }
}

export async function loadVault(): Promise<VaultState> {
  const [s, owner, shutdownAt, grace, woundDown, recoveryMode, totalShares] = await Promise.all([
    publicClient.readContract({ ...v, functionName: 'vaultState' }),
    // Vaults deployed before Wave 2 lack the wind-down views; read them as "open".
    publicClient.readContract({ ...v, functionName: 'owner' }),
    publicClient.readContract({ ...v, functionName: 'shutdownAt' }).catch(() => 0n),
    publicClient.readContract({ ...v, functionName: 'WIND_DOWN_GRACE' }).catch(() => 0n),
    publicClient.readContract({ ...v, functionName: 'woundDown' }).catch(() => false),
    publicClient.readContract({ ...v, functionName: 'recoveryMode' }).catch(() => false),
    publicClient.readContract({ ...v, functionName: 'totalShares' }),
  ])
  return { ...s, owner, shutdownAt, forcedFrom: shutdownAt === 0n ? 0n : shutdownAt + grace, woundDown, recoveryMode, totalShares }
}

export async function loadAccount(address: Address): Promise<AccountState> {
  const [a, claimable] = await Promise.all([
    publicClient.readContract({ ...v, functionName: 'accountOf', args: [address] }),
    publicClient.readContract({ ...v, functionName: 'claimableMusd', args: [address] }).catch(() => 0n),
  ])
  return { address, ...a, claimable }
}

export async function loadWallet(address: Address) {
  const [btc, musd, allowance] = await Promise.all([
    publicClient.getBalance({ address }),
    publicClient.readContract({ address: ADDR.musd, abi: erc20Abi, functionName: 'balanceOf', args: [address] }),
    publicClient.readContract({ address: ADDR.musd, abi: erc20Abi, functionName: 'allowance', args: [address, ADDR.vault] }),
  ])
  return { btc, musd, allowance }
}

const STEP = 10_000n // Mezo's RPC answers log queries over at most 10,000 blocks

/** Everyone who has used the vault, from its events. */
export async function loadAccounts(): Promise<AccountState[]> {
  const latest = await publicClient.getBlockNumber()
  const events = [
    parseAbiItem('event Deposited(address indexed account, uint256 amount)'),
    parseAbiItem('event AnchorOpened(address indexed anchor, uint256 coll, uint256 debt)'),
  ]
  const seen = new Set<Address>()
  const ranges: [bigint, bigint][] = []
  for (let from = DEPLOY_BLOCK; from <= latest; from += STEP) {
    ranges.push([from, from + STEP - 1n > latest ? latest : from + STEP - 1n])
  }
  await Promise.all(
    ranges.map(async ([fromBlock, toBlock]) => {
      const logs = await publicClient.getLogs({ address: ADDR.vault, events, fromBlock, toBlock })
      for (const l of logs) {
        const a = (l.args as { account?: Address; anchor?: Address }).account ?? (l.args as { anchor?: Address }).anchor
        if (a) seen.add(a)
      }
    }),
  )
  const accounts = await Promise.all([...seen].map(loadAccount))
  return accounts.filter((a) => a.coll > 0n || a.debt > 0n || a.claimable > 0n)
}

export interface Activity {
  /** Estimated from the block number, between the deploy block's and the latest block's times. */
  time: number
  kind: string
  account: Address
  text: string
  hash: `0x${string}`
  block: bigint
}

const fmt = (x: bigint, d = 2) => (Number(x) / 1e18).toLocaleString('en-US', { maximumFractionDigits: d })

/** Everything that happened in the vault, newest first, from its events. */
export async function loadActivity(): Promise<Activity[]> {
  const latest = await publicClient.getBlockNumber()
  const ranges: [bigint, bigint][] = []
  for (let from = DEPLOY_BLOCK; from <= latest; from += STEP) ranges.push([from, from + STEP - 1n > latest ? latest : from + STEP - 1n])
  const [b0, b1] = await Promise.all([publicClient.getBlock({ blockNumber: DEPLOY_BLOCK }), publicClient.getBlock({ blockNumber: latest })]).catch(() => [null, null])
  const timeOf = (n: bigint) => {
    if (!b0 || !b1 || b1.number === b0.number) return 0
    const t = Number(b0.timestamp) + (Number(n - b0.number) * Number(b1.timestamp - b0.timestamp)) / Number(b1.number - b0.number)
    return t * 1000
  }
  const out: Activity[] = []
  await Promise.all(ranges.map(async ([fromBlock, toBlock]) => {
    const logs = await publicClient.getContractEvents({ address: ADDR.vault, abi: vaultAbi, fromBlock, toBlock })
    for (const l of logs) {
      const a = l.args as Record<string, never>
      let item: [string, Address, string] | null = null
      switch (l.eventName) {
        case 'AnchorOpened': item = ['open', a.anchor, `opened the shared Mezo loan with ${fmt(a.coll, 4)} BTC`]; break
        case 'Deposited': item = ['deposit', a.account, `added ${fmt(a.amount, 5)} BTC`]; break
        case 'Borrowed': item = ['borrow', a.account, `borrowed ${fmt(a.amount)} MUSD`]; break
        case 'Repaid': item = ['repay', a.account, `repaid ${fmt(a.amount)} MUSD`]; break
        case 'Withdrawn': item = ['withdraw', a.account, `withdrew ${fmt(a.amount, 5)} BTC`]; break
        case 'AccountClosed': item = ['close', a.closer, `closed ${(a.account as string).slice(0, 6)}…, paid ${fmt(a.paid)} MUSD for ${fmt(a.collSeized, 5)} BTC`]; break
        case 'Redeemed': item = ['redeem', ADDR.vault, `Mezo redemption took ${fmt(a.collRemoved, 5)} BTC, split by debt`]; break
        case 'Redistributed': item = ['redistribute', ADDR.vault, `Mezo redistribution added ${fmt(a.collAdded, 5)} BTC`]; break
        case 'Shutdown': item = ['shutdown', ADDR.vault, 'vault shut to new loans; wind-down started']; break
        case 'WoundDown': item = ['wound', ADDR.vault, `Mezo loan repaid and closed; ${fmt(a.collReturned, 4)} BTC returned to the vault`]; break
        case 'MusdClaimed': item = ['claim', a.account, `claimed ${fmt(a.amount)} MUSD`]; break
      }
      if (item) out.push({ time: timeOf(l.blockNumber), kind: item[0], account: item[1], text: item[2], hash: l.transactionHash, block: l.blockNumber })
    }
  }))
  return out.sort((x, y) => (x.block > y.block ? -1 : 1))
}

/** Mezo's line for a single loan: below 110% it can close the whole trove. */
export const MEZO_MCR = 11n * 10n ** 17n

/**
 * The BTC price at which Mezo can close the whole shared loan. The anchor carries Mezo's
 * minimum, so it cannot be closed on its own; it goes at this price, and with it every account
 * that still owes, whatever its own ratio. 0 if there is no open loan.
 */
export function sharedClosePrice(v: VaultState): bigint {
  if (v.closed || v.troveColl === 0n) return 0n
  return (v.troveDebt * MEZO_MCR) / v.troveColl
}

/** The price an account is really closed at: its own line, or the shared line if that comes first. */
export function effectiveClosePrice(a: { address?: Address; debt: bigint; closePrice: bigint }, v: VaultState, who?: Address): bigint {
  if (a.debt === 0n) return 0n
  const shared = sharedClosePrice(v)
  const isAnchor = (who ?? a.address)?.toLowerCase() === v.anchor.toLowerCase()
  if (isAnchor) return shared
  return shared > a.closePrice ? shared : a.closePrice
}
