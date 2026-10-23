import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Address, WalletClient } from 'viem'
import { connectWallet, existingAccount, onWalletChange } from './lib/chain'
import { loadAccount, loadAccounts, loadParams, loadVault, loadWallet, type AccountState, type Params, type VaultState } from './lib/data'
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
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const [p, v, list] = await Promise.all([loadParams(), loadVault(), loadAccounts()])
      setParams(p); setVault(v); setAccounts(list)
      if (account) {
        const [m, b] = await Promise.all([loadAccount(account), loadWallet(account)])
        setMe(m); setBalances(b)
      } else {
        setMe(null); setBalances(null)
      }
    } catch (e) {
      setLoadError(`Could not read the vault from Mezo testnet: ${errorText(e)}`)
    } finally {
      setLoading(false)
    }
  }, [account])

  useEffect(() => { refresh() }, [refresh])

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
    () => ({ account, wallet, connect, params, vault, me, balances, accounts, loading, loadError, refresh }),
    [account, wallet, connect, params, vault, me, balances, accounts, loading, loadError, refresh],
  )
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
