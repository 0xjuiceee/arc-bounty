import { TriangleAlert } from 'lucide-react'
import { Logo } from './Nav'

export function Footer() {
  return (
    <footer className="mx-auto max-w-6xl px-4 pb-24 pt-14 sm:px-6">
      <div className="flex items-start gap-3 rounded-2xl border border-amber-signal/30 bg-amber-signal/[0.06] p-4 text-sm text-amber-signal">
        <TriangleAlert size={18} className="mt-0.5 shrink-0" />
        <p className="text-pretty">
          Testnet only. Test USDC has no value. The escrow contract is unaudited and may contain bugs, so never use it
          with real funds. Proof links are submitted by strangers: open them with care.
        </p>
      </div>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Logo />
        <p className="text-xs text-mist-dim">Non-custodial. No platform wallet. Chain ID 5042002.</p>
      </div>
    </footer>
  )
}
