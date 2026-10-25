// TinyVault keeper: finds accounts below the close ratio and closes them.
//
// Closing is open to anyone. The closer pays the account's debt in MUSD and receives that account's
// BTC worth the debt plus the close bonus (5%), so running this is paid work, not charity.
//
//   node keeper.mjs                  scan once and report (no key needed)
//   PRIVATE_KEY=0x... node keeper.mjs        scan once and close what can be closed
//   PRIVATE_KEY=0x... INTERVAL=60 node keeper.mjs   keep watching, every 60 seconds
//
// Settings (env): RPC (default Mezo testnet), VAULT, FROM_BLOCK (the vault's deploy block),
// PRIVATE_KEY (a wallet holding MUSD and a little BTC for gas), INTERVAL (seconds; unset = run once),
// MAX_PAY (largest debt in MUSD this keeper will pay off in one close; default: no limit).
import { createPublicClient, createWalletClient, http, parseAbiItem, formatUnits, parseUnits, defineChain, decodeEventLog } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { readFileSync } from 'node:fs'

const vaultAbi = JSON.parse(readFileSync(new URL('./vault-abi.json', import.meta.url)))
const erc20Abi = [
  parseAbiItem('function balanceOf(address) view returns (uint256)'),
  parseAbiItem('function allowance(address,address) view returns (uint256)'),
  parseAbiItem('function approve(address,uint256) returns (bool)'),
]

const RPC = process.env.RPC || 'https://rpc.test.mezo.org'
const VAULT = process.env.VAULT || '0x8724a13AfAF230311AC0f69e5979f42058EF248b'
const FROM_BLOCK = BigInt(process.env.FROM_BLOCK || 16325664)
const INTERVAL = process.env.INTERVAL ? Number(process.env.INTERVAL) : 0
const MAX_PAY = process.env.MAX_PAY ? parseUnits(process.env.MAX_PAY, 18) : null
const STEP = 10_000n // Mezo's RPC answers log queries over at most 10,000 blocks

const pub = createPublicClient({ transport: http(RPC) })
const chain = defineChain({ id: await pub.getChainId(), name: 'Mezo', nativeCurrency: { name: 'Bitcoin', symbol: 'BTC', decimals: 18 }, rpcUrls: { default: { http: [RPC] } } })
const signer = process.env.PRIVATE_KEY ? privateKeyToAccount(process.env.PRIVATE_KEY) : null
const wallet = signer ? createWalletClient({ account: signer, chain, transport: http(RPC) }) : null

const fmt = (x, d = 2) => Number(formatUnits(x, 18)).toLocaleString('en-US', { maximumFractionDigits: d })
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a)
const read = (functionName, args = []) => pub.readContract({ address: VAULT, abi: vaultAbi, functionName, args })

const known = new Set()
let scannedTo = FROM_BLOCK - 1n

async function discover() {
  const head = await pub.getBlockNumber()
  const events = [parseAbiItem('event Deposited(address indexed account, uint256 amount)'), parseAbiItem('event AnchorOpened(address indexed anchor, uint256 coll, uint256 debt)')]
  for (let from = scannedTo + 1n; from <= head; from += STEP) {
    const to = from + STEP - 1n > head ? head : from + STEP - 1n
    const logs = await pub.getLogs({ address: VAULT, events, fromBlock: from, toBlock: to })
    for (const l of logs) known.add(l.args.account ?? l.args.anchor)
  }
  scannedTo = head
}

async function closeOne(account, view, price, closeRatio, musd) {
  // interest accrues every second, so leave a little headroom over the debt read a moment ago
  const debt = (view.debt * 1001n) / 1000n + 1n
  if (MAX_PAY && debt > MAX_PAY) return log(`  skip ${account}: debt ${fmt(debt)} MUSD is over MAX_PAY`)
  const bal = await pub.readContract({ address: musd, abi: erc20Abi, functionName: 'balanceOf', args: [signer.address] })
  if (bal < debt) return log(`  skip ${account}: needs ${fmt(debt)} MUSD, keeper holds ${fmt(bal)}`)
  const allowance = await pub.readContract({ address: musd, abi: erc20Abi, functionName: 'allowance', args: [signer.address, VAULT] })
  if (allowance < debt) {
    const h = await wallet.writeContract({ address: musd, abi: erc20Abi, functionName: 'approve', args: [VAULT, debt] })
    await pub.waitForTransactionReceipt({ hash: h })
  }
  const zero = '0x0000000000000000000000000000000000000000'
  // simulate first: if someone else closed it, or it recovered, nothing is sent
  const { request } = await pub.simulateContract({ account: signer, address: VAULT, abi: vaultAbi, functionName: 'closeAccount', args: [account, zero, zero] })
  const hash = await wallet.writeContract(request)
  const rc = await pub.waitForTransactionReceipt({ hash })
  for (const l of rc.logs) {
    try {
      const ev = decodeEventLog({ abi: vaultAbi, data: l.data, topics: l.topics })
      if (ev.eventName !== 'AccountClosed') continue
      const { paid, collSeized: seized, reserveUsed: fromReserve, shared: socialized } = ev.args
      const gain = (seized * price) / 10n ** 18n - paid
      log(`  closed ${account}: paid ${fmt(paid)} MUSD, received ${fmt(seized, 6)} BTC (worth ${fmt(gain)} MUSD more)` +
        (fromReserve > 0n ? `, reserve covered ${fmt(fromReserve)}` : '') + (socialized > 0n ? `, shared ${fmt(socialized)}` : '') + ` tx ${hash}`)
    } catch {}
  }
}

async function tick() {
  if (await read('closed')) return log('the vault\'s Mezo loan is closed; nothing to do')
  await discover()
  const [closeRatio, state, musd] = await Promise.all([read('closeRatio'), read('vaultState'), read('musd')])
  const price = state.price
  log(`BTC $${fmt(price)} · ${known.size} accounts · close below ${fmt(closeRatio * 100n)}% · Mezo loan at ${fmt(state.ratio * 100n, 0)}%`)
  let found = 0
  for (const account of known) {
    const v = await read('accountOf', [account])
    if (v.debt === 0n) continue
    const pct = fmt(v.ratio * 100n, 1)
    if (v.ratio >= closeRatio) { log(`  ok     ${account} ${pct}%  closes at $${fmt(v.closePrice)}`); continue }
    found++
    log(`  CLOSE  ${account} ${pct}%  owes ${fmt(v.debt)} MUSD`)
    if (!wallet) continue
    try { await closeOne(account, v, price, closeRatio, musd) } catch (e) { log(`  could not close ${account}: ${e.shortMessage || e.message}`) }
  }
  if (!found) log('  nothing to close')
  else if (!wallet) log(`  ${found} account(s) can be closed; set PRIVATE_KEY to close them`)
}

do {
  try { await tick() } catch (e) { log('error:', e.shortMessage || e.message) }
  if (INTERVAL) await new Promise((r) => setTimeout(r, INTERVAL * 1000))
} while (INTERVAL)
