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
}

export interface AccountState {
  address: Address
  coll: bigint
  debt: bigint
  ratio: bigint
  maxBorrow: bigint
  closePrice: bigint
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
  const s = await publicClient.readContract({ ...v, functionName: 'vaultState' })
  return { ...s }
}

export async function loadAccount(address: Address): Promise<AccountState> {
  const a = await publicClient.readContract({ ...v, functionName: 'accountOf', args: [address] })
  return { address, ...a }
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
  return accounts.filter((a) => a.coll > 0n || a.debt > 0n)
}
