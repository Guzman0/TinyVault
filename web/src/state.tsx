import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Address, WalletClient } from 'viem'
import { connectWallet, existingAccount, onWalletChange } from './lib/chain'
import { loadAccount, loadAccounts, loadActivity, loadParams, loadVault, loadWallet, type AccountState, type Activity, type Params, type VaultState } from './lib/data'
import { errorText } from './lib/format'

interface WalletBalances { btc: bigint; musd: bigint; allowance: bigint }

interface AppState {
  account: Address | null
  wallet: WalletClient | null
  connect: () => Promise<void>
  params: Params | null
  vault: VaultState | null
  me: AccountState | null
  balances: WalletBalances | null
  accounts: AccountState[]
  activity: Activity[]
  loading: boolean
  loadError: string | null
  refresh: () => Promise<void>
}

const Ctx = createContext<AppState | null>(null)

export function useApp() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useApp outside provider')
  return v
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [account, setAccount] = useState<Address | null>(null)
  const [wallet, setWallet] = useState<WalletClient | null>(null)
  const [params, setParams] = useState<Params | null>(null)
  const [vault, setVault] = useState<VaultState | null>(null)
  const [me, setMe] = useState<AccountState | null>(null)
  const [balances, setBalances] = useState<WalletBalances | null>(null)
  const [accounts, setAccounts] = useState<AccountState[]>([])
  const [activity, setActivity] = useState<Activity[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      // The account and the vault come first; the event history can take a while on a long chain.
      const history = Promise.all([loadAccounts(), loadActivity().catch(() => [])])
      const [p, v, m, b] = await Promise.all([
        loadParams(), loadVault(),
        account ? loadAccount(account) : Promise.resolve(null),
        account ? loadWallet(account) : Promise.resolve(null),
      ])
      setParams(p); setVault(v); setMe(m); setBalances(b)
      setLoading(false)
      const [list, act] = await history
      setAccounts(list); setActivity(act)
    } catch (e) {
      setLoadError(`Could not read the vault from Mezo testnet: ${errorText(e)}`)
    } finally {
      setLoading(false)
    }
  }, [account])

  useEffect(() => { refresh() }, [refresh])
  // Re-read every minute so prices, ratios and alerts stay current while the page is open.
  useEffect(() => {
    const id = setInterval(() => { if (document.visibilityState === 'visible' || account) refresh() }, 60_000)
    return () => clearInterval(id)
  }, [refresh, account])

  useEffect(() => {
    existingAccount().then((r) => { if (r) { setAccount(r.account); setWallet(r.wallet) } }).catch(() => {})
    onWalletChange(() => {
      existingAccount().then((r) => { setAccount(r?.account ?? null); setWallet(r?.wallet ?? null) }).catch(() => {})
    })
  }, [])

  const connect = useCallback(async () => {
    const r = await connectWallet()
    setAccount(r.account); setWallet(r.wallet)
  }, [])

  const value = useMemo(
    () => ({ account, wallet, connect, params, vault, me, balances, accounts, activity, loading, loadError, refresh }),
    [account, wallet, connect, params, vault, me, balances, accounts, activity, loading, loadError, refresh],
  )
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
