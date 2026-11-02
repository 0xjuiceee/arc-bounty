import { createContext, useContext } from 'react'
import type { Address, EIP1193Provider, Hash, Hex } from 'viem'

export interface InjectedWallet {
  id: string
  name: string
  icon?: string
  provider: EIP1193Provider
}

export type WalletKind = 'injected' | 'google'

export interface TxRequest {
  to: Address
  data: Hex
}

export interface WalletContextValue {
  kind: WalletKind | null
  address: Address | undefined
  /** True when the wallet is on Arc Testnet (always true for Google wallets). */
  onArc: boolean
  connecting: boolean
  connectError: string | null
  wallets: InjectedWallet[]
  /** USDC balance in ERC-20 units (6 decimals), read from the Arc Testnet USDC contract. */
  usdcBalance: bigint | undefined
  googleEnabled: boolean
  connectInjected: (wallet: InjectedWallet) => Promise<void>
  connectGoogle: () => Promise<void>
  disconnect: () => void
  switchToArc: () => Promise<void>
  refreshBalance: () => Promise<void>
  /** Sends a transaction from the connected wallet and resolves with its hash once submitted. */
  sendTransaction: (tx: TxRequest) => Promise<Hash>
  openConnect: () => void
  closeConnect: () => void
  connectOpen: boolean
  openFaucet: () => void
  closeFaucet: () => void
  faucetOpen: boolean
}

export const WalletContext = createContext<WalletContextValue | null>(null)

export function useWallet(): WalletContextValue {
  const ctx = useContext(WalletContext)
  if (!ctx) throw new Error('useWallet must be used inside <WalletProvider>')
  return ctx
}
