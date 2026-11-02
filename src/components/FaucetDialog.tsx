import { useState } from 'react'
import { Check, Copy, Droplets, ExternalLink, Loader2, RefreshCw } from 'lucide-react'
import { TokenUSDC } from '@web3icons/react'
import { formatUsdcDisplay } from '@/lib/format'
import { useWallet } from '@/wallet/types'
import { Modal } from './Modal'

const FAUCET_URL = 'https://faucet.circle.com'

export function FaucetDialog() {
  const w = useWallet()
  const [copied, setCopied] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  const copy = async () => {
    if (!w.address) return
    try {
      await navigator.clipboard.writeText(w.address)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      // Clipboard can be blocked in frames. The address is visible to copy by hand.
    }
  }

  const refresh = async () => {
    setRefreshing(true)
    await w.refreshBalance()
    setRefreshing(false)
  }

  return (
    <Modal
      open={w.faucetOpen}
      onClose={w.closeFaucet}
      title="Get test USDC"
      subtitle="Free Arc Testnet USDC from Circle's faucet. It has no real value."
    >
      <div className="space-y-5">
        {w.address ? (
          <>
            <div className="rounded-2xl border border-white/[0.07] bg-ink-900/70 p-4">
              <p className="label">Your wallet address</p>
              <p className="break-all font-mono text-sm text-mist">{w.address}</p>
              <button className="btn-ghost mt-3 w-full" onClick={() => void copy()}>
                {copied ? <Check size={16} className="text-lime" /> : <Copy size={16} />}
                {copied ? 'Address copied' : 'Copy address'}
              </button>
            </div>

            <ol className="space-y-3 text-sm text-mist-muted">
              <li className="flex gap-3">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-lime/15 text-xs font-bold text-lime">1</span>
                Copy your address above.
              </li>
              <li className="flex gap-3">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-lime/15 text-xs font-bold text-lime">2</span>
                Open the Circle faucet, choose <span className="text-mist">Arc Testnet</span> and <span className="text-mist">USDC</span>, paste your address and request tokens.
              </li>
              <li className="flex gap-3">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-lime/15 text-xs font-bold text-lime">3</span>
                Come back and refresh your balance. USDC is also your gas on Arc, so one claim covers both.
              </li>
            </ol>

            <a href={FAUCET_URL} target="_blank" rel="noopener noreferrer" className="btn-primary w-full">
              <Droplets size={16} /> Open Circle faucet <ExternalLink size={14} />
            </a>

            <div className="flex items-center justify-between rounded-2xl bg-ink-900/70 px-4 py-3">
              <div className="flex items-center gap-3">
                <TokenUSDC variant="branded" size={26} />
                <div>
                  <p className="text-[11px] uppercase tracking-[0.08em] text-mist-dim">Current balance</p>
                  <p className="font-display text-lg font-semibold tabular-nums">
                    {w.usdcBalance === undefined ? '…' : `${formatUsdcDisplay(w.usdcBalance)} USDC`}
                  </p>
                </div>
              </div>
              <button className="btn-ghost !px-3.5" onClick={() => void refresh()} disabled={refreshing} aria-label="Refresh balance">
                {refreshing ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
              </button>
            </div>
          </>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-mist-muted">Connect a wallet first so the faucet knows where to send your test USDC.</p>
            <button
              className="btn-primary w-full"
              onClick={() => {
                w.closeFaucet()
                w.openConnect()
              }}
            >
              Connect wallet
            </button>
          </div>
        )}
        <p className="text-xs text-mist-dim">
          The faucet is run by Circle and has its own limits. Come back later if a request is declined.
        </p>
      </div>
    </Modal>
  )
}
