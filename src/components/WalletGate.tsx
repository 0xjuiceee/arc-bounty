import type { ReactNode } from 'react'
import { AlertTriangle, Wallet } from 'lucide-react'
import { ESCROW_ADDRESS } from '@/lib/arc'
import { useWallet } from '@/wallet/types'

/** Renders children only when a wallet is connected on Arc Testnet and the escrow is configured. */
export function WalletGate({ children }: { children: ReactNode }) {
  const w = useWallet()

  if (!ESCROW_ADDRESS) {
    return (
      <p className="flex items-start gap-2 rounded-xl bg-amber-signal/10 px-3 py-2.5 text-sm text-amber-signal">
        <AlertTriangle size={16} className="mt-0.5 shrink-0" /> The escrow contract is not configured yet.
      </p>
    )
  }
  if (!w.address) {
    return (
      <button className="btn-primary w-full" onClick={w.openConnect}>
        <Wallet size={16} /> Connect wallet to continue
      </button>
    )
  }
  if (!w.onArc) {
    return (
      <div className="space-y-2">
        <p className="flex items-start gap-2 rounded-xl bg-amber-signal/10 px-3 py-2.5 text-sm text-amber-signal">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" /> Your wallet is on the wrong network. Switch to Arc Testnet to continue.
        </p>
        <button className="btn-primary w-full" onClick={() => void w.switchToArc()}>
          Switch to Arc Testnet
        </button>
      </div>
    )
  }
  return <>{children}</>
}
