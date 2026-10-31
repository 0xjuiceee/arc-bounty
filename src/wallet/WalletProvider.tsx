import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { createWalletClient, custom, erc20Abi, getAddress, type Address } from 'viem'
import { ADD_CHAIN_PARAMS, ARC_CHAIN_ID, USDC_ADDRESS, arcTestnet, publicClient } from '@/lib/arc'
import { describeError } from '@/lib/errors'
import {
  circleConfigured,
  clearSession,
  getSdk,
  hasLoginSession,
  loadOrCreateWallet,
  onLoginError,
  onLoginSuccess,
  readSession,
  sendFromGoogleWallet,
  startGoogleLogin,
} from './circle'
import { WalletContext, type InjectedWallet, type TxRequest, type WalletKind } from './types'

const STORAGE_KEY = 'arc-bounties.wallet'
const ARC_HEX = ADD_CHAIN_PARAMS.chainId

interface Eip6963Detail {
  info: { uuid: string; name: string; icon?: string }
  provider: InjectedWallet['provider']
}

async function requestSwitch(wallet: InjectedWallet): Promise<void> {
  try {
    await wallet.provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: ARC_HEX }] })
  } catch (error) {
    const code = (error as { code?: number }).code
    const message = error instanceof Error ? error.message : ''
    // 4902 = unknown chain. Some wallets wrap the same condition in -32603.
    if (code === 4902 || code === -32603 || /unrecognized|not added|unknown chain|try adding/i.test(message)) {
      await wallet.provider.request({ method: 'wallet_addEthereumChain', params: [ADD_CHAIN_PARAMS] })
      return
    }
    throw error
  }
}

export function WalletProvider({ children }: { children: ReactNode }) {
  const [announced, setAnnounced] = useState<InjectedWallet[]>([])
  const [active, setActive] = useState<InjectedWallet | null>(null)
  const [kind, setKind] = useState<WalletKind | null>(null)
  const [address, setAddress] = useState<Address>()
  const [chainId, setChainId] = useState<number>()
  const [connecting, setConnecting] = useState(false)
  const [connectError, setConnectError] = useState<string | null>(null)
  const [connectOpen, setConnectOpen] = useState(false)
  const restored = useRef(false)

  // EIP-6963 wallet discovery (MetaMask, Rabby, Coinbase Wallet, and other injected wallets).
  useEffect(() => {
    const onAnnounce = (event: Event) => {
      const detail = (event as CustomEvent<Eip6963Detail>).detail
      if (!detail?.provider) return
      setAnnounced((prev) =>
        prev.some((w) => w.id === detail.info.uuid)
          ? prev
          : [...prev, { id: detail.info.uuid, name: detail.info.name, icon: detail.info.icon, provider: detail.provider }],
      )
    }
    window.addEventListener('eip6963:announceProvider', onAnnounce)
    window.dispatchEvent(new Event('eip6963:requestProvider'))
    return () => window.removeEventListener('eip6963:announceProvider', onAnnounce)
  }, [])

  const wallets = useMemo<InjectedWallet[]>(() => {
    if (announced.length > 0) return announced
    return window.ethereum ? [{ id: 'injected', name: 'Browser wallet', provider: window.ethereum }] : []
  }, [announced])

  const reset = useCallback(() => {
    setActive(null)
    setKind(null)
    setAddress(undefined)
    setChainId(undefined)
  }, [])

  const readChainId = useCallback(async (wallet: InjectedWallet) => {
    const hex = (await wallet.provider.request({ method: 'eth_chainId' })) as string
    setChainId(Number(hex))
  }, [])

  // Keep account and network in sync with the wallet.
  useEffect(() => {
    if (!active) return
    const onAccounts = (accounts: Address[]) => {
      if (accounts.length === 0) {
        localStorage.removeItem(STORAGE_KEY)
        reset()
      } else {
        setAddress(getAddress(accounts[0]))
      }
    }
    const onChain = (hex: string) => setChainId(Number(hex))
    active.provider.on('accountsChanged', onAccounts)
    active.provider.on('chainChanged', onChain)
    return () => {
      active.provider.removeListener('accountsChanged', onAccounts)
      active.provider.removeListener('chainChanged', onChain)
    }
  }, [active, reset])

  // Real ERC-20 USDC balance from the Arc Testnet USDC contract (one pool; also pays gas).
  const balanceQuery = useQuery({
    queryKey: ['usdc-balance', address],
    enabled: Boolean(address),
    refetchInterval: 20_000,
    queryFn: () =>
      publicClient.readContract({
        address: USDC_ADDRESS,
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: [address as Address],
      }),
  })
  const usdcBalance = address ? balanceQuery.data : undefined
  const { refetch: refetchBalance } = balanceQuery
  const refreshBalance = useCallback(async () => {
    await refetchBalance()
  }, [refetchBalance])

  const connectInjected = useCallback(
    async (wallet: InjectedWallet) => {
      setConnecting(true)
      setConnectError(null)
      try {
        const accounts = (await wallet.provider.request({ method: 'eth_requestAccounts' }))
        if (!accounts[0]) throw new Error('No account was returned by the wallet.')
        const hex = (await wallet.provider.request({ method: 'eth_chainId' })) as string
        if (Number(hex) !== ARC_CHAIN_ID) await requestSwitch(wallet)
        setActive(wallet)
        setKind('injected')
        setAddress(getAddress(accounts[0]))
        await readChainId(wallet)
        localStorage.setItem(STORAGE_KEY, wallet.name)
        setConnectOpen(false)
      } catch (error) {
        const described = describeError(error)
        setConnectError(
          described.kind === 'rejected'
            ? 'Connection request was rejected in your wallet.'
            : described.message,
        )
        // The account may be connected even if the network switch was declined.
        try {
          const accounts = (await wallet.provider.request({ method: 'eth_accounts' }))
          if (accounts[0]) {
            setActive(wallet)
            setKind('injected')
            setAddress(getAddress(accounts[0]))
            await readChainId(wallet)
          }
        } catch {
          // ignore
        }
      } finally {
        setConnecting(false)
      }
    },
    [readChainId],
  )

  // Silent reconnect for a previously authorized injected wallet (no popup).
  useEffect(() => {
    if (restored.current || wallets.length === 0) return
    const saved = localStorage.getItem(STORAGE_KEY)
    if (!saved) return
    const match = wallets.find((w) => w.name === saved)
    if (!match) return
    restored.current = true
    void (async () => {
      try {
        const accounts = (await match.provider.request({ method: 'eth_accounts' }))
        if (!accounts[0]) return
        setActive(match)
        setKind('injected')
        setAddress(getAddress(accounts[0]))
        await readChainId(match)
      } catch {
        // Ignore: the user can connect manually.
      }
    })()
  }, [wallets, readChainId])

  // Google wallet: finish the session after Google redirects back to the app.
  const finishGoogle = useCallback(async () => {
    setConnecting(true)
    setConnectError(null)
    try {
      const wallet = await loadOrCreateWallet()
      setKind('google')
      setAddress(getAddress(wallet.address))
      setChainId(ARC_CHAIN_ID)
      setConnectOpen(false)
    } catch (error) {
      setConnectError(error instanceof Error ? error.message : 'Google sign-in failed.')
    } finally {
      setConnecting(false)
    }
  }, [])

  useEffect(() => {
    if (!circleConfigured) return
    const offOk = onLoginSuccess(() => void finishGoogle())
    const offErr = onLoginError((message) => {
      setConnectError(message)
      setConnectOpen(true)
    })
    const session = readSession()
    if (hasLoginSession()) void Promise.resolve().then(finishGoogle)
    // Boot the SDK right away when a login was started so it can process the OAuth redirect.
    if (session.deviceToken) void getSdk().catch(() => undefined)
    return () => {
      offOk()
      offErr()
    }
  }, [finishGoogle])

  const connectGoogle = useCallback(async () => {
    setConnecting(true)
    setConnectError(null)
    try {
      await startGoogleLogin()
    } catch (error) {
      setConnectError(
        error instanceof Error && /fetch|network|unavailable|404|502|503/i.test(error.message)
          ? 'The Google wallet service is not reachable. Make sure the server is running.'
          : error instanceof Error
            ? error.message
            : 'Google sign-in failed.',
      )
      setConnecting(false)
    }
  }, [])

  const disconnect = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY)
    clearSession()
    reset()
  }, [reset])

  const switchToArc = useCallback(async () => {
    if (!active) return
    try {
      await requestSwitch(active)
      await readChainId(active)
    } catch (error) {
      setConnectError(describeError(error).message)
    }
  }, [active, readChainId])

  const sendTransaction = useCallback(
    async (tx: TxRequest) => {
      if (!address || !kind) throw new Error('Connect a wallet first.')
      if (kind === 'google') return sendFromGoogleWallet(tx.to, tx.data)
      if (!active) throw new Error('Connect a wallet first.')
      if (chainId !== ARC_CHAIN_ID) {
        await requestSwitch(active)
        await readChainId(active)
      }
      const client = createWalletClient({ account: address, chain: arcTestnet, transport: custom(active.provider) })
      return client.sendTransaction({ to: tx.to, data: tx.data })
    },
    [active, address, chainId, kind, readChainId],
  )

  const value = useMemo(
    () => ({
      kind,
      address,
      onArc: kind === 'google' ? true : chainId === ARC_CHAIN_ID,
      connecting,
      connectError,
      wallets,
      usdcBalance,
      googleEnabled: circleConfigured,
      connectInjected,
      connectGoogle,
      disconnect,
      switchToArc,
      refreshBalance,
      sendTransaction,
      openConnect: () => {
        setConnectError(null)
        setConnectOpen(true)
      },
      closeConnect: () => setConnectOpen(false),
      connectOpen,
    }),
    [
      kind, address, chainId, connecting, connectError, wallets, usdcBalance, connectInjected,
      connectGoogle, disconnect, switchToArc, refreshBalance, sendTransaction, connectOpen,
    ],
  )

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>
}
