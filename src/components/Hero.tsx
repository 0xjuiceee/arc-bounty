import { ArrowRight, ExternalLink, ShieldCheck } from 'lucide-react'
import { TokenUSDC } from '@web3icons/react'
import { ESCROW_ADDRESS, explorerAddress, shortAddress } from '@/lib/arc'
import { formatUsdcDisplay } from '@/lib/format'
import type { BountySnapshot } from '@/lib/bounties'
import { useWallet } from '@/wallet/types'

interface HeroProps {
  snapshot: BountySnapshot | undefined
  loading: boolean
  failed: boolean
  onPost: () => void
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-ink-900/80 px-3 py-2.5">
      <p className="font-display text-xl font-semibold tabular-nums">{value}</p>
      <p className="text-[11px] uppercase tracking-[0.08em] text-mist-dim">{label}</p>
    </div>
  )
}

export function Hero({ snapshot, loading, failed, onPost }: HeroProps) {
  const w = useWallet()
  const count = (s: string) => snapshot?.bounties.filter((b) => b.status === s).length ?? 0

  return (
    <section id="top" className="relative overflow-hidden">
      <div className="grid-bg pointer-events-none absolute inset-0" aria-hidden="true" />
      <div className="pointer-events-none absolute -top-40 left-1/2 h-96 w-[42rem] -translate-x-1/2 rounded-full bg-lime/10 blur-3xl" aria-hidden="true" />
      <div className="relative mx-auto grid max-w-6xl gap-10 px-4 pb-14 pt-12 sm:px-6 lg:grid-cols-[1.15fr_0.85fr] lg:items-center lg:pb-20 lg:pt-20">
        <div>
          <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-lime/25 bg-lime/[0.07] px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.1em] text-lime">
            <ShieldCheck size={14} /> Arc Testnet · Non-custodial escrow
          </p>
          <h1 className="font-display text-[2.6rem] font-bold leading-[1.02] tracking-[-0.035em] text-balance sm:text-6xl">
            Do work that moves. <span className="text-lime">Get paid in USDC.</span>
          </h1>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-mist-muted text-pretty sm:text-lg">
            Sponsors lock test USDC in a smart contract on Arc Testnet. Workers submit proof. The sponsor releases the
            payout straight to the worker's wallet. No platform wallet, no accounts, no one in the middle holding your
            funds.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <button className="btn-primary !px-6" onClick={onPost}>
              Post a bounty <ArrowRight size={16} />
            </button>
            <a href="#explore" className="btn-ghost !px-6">
              Browse work
            </a>
          </div>
          {w.address && (
            <div className="mt-6 inline-flex items-center gap-3 rounded-2xl border border-white/[0.08] bg-ink-800/70 px-4 py-3">
              <TokenUSDC variant="branded" size={28} />
              <div>
                <p className="text-[11px] uppercase tracking-[0.08em] text-mist-dim">Your wallet balance</p>
                <p className="font-display text-lg font-semibold tabular-nums">
                  {w.usdcBalance === undefined ? 'Loading…' : `${formatUsdcDisplay(w.usdcBalance)} USDC`}
                </p>
              </div>
            </div>
          )}
        </div>

        <aside className="card relative overflow-hidden p-5 shadow-glow sm:p-6" aria-label="Live escrow status">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-[0.1em] text-mist-muted">Live onchain escrow</p>
            <span className="inline-flex items-center gap-1.5 text-xs text-mist-muted">
              <span className={`h-2 w-2 rounded-full ${failed ? 'bg-red-400' : 'bg-lime animate-pulseDot'}`} />
              {failed ? 'RPC unreachable' : 'Arc Testnet'}
            </span>
          </div>
          {ESCROW_ADDRESS ? (
            <>
              <p className="mt-4 font-display text-5xl font-bold tracking-tight tabular-nums">
                {loading || !snapshot ? (
                  <span className="skeleton inline-block h-12 w-48 rounded-lg" />
                ) : (
                  formatUsdcDisplay(snapshot.totalEscrowed)
                )}
              </p>
              <p className="mt-1 text-sm text-mist-muted">USDC currently locked in open and in-review bounties</p>
              <div className="mt-5 grid grid-cols-3 gap-2">
                <Stat label="Open" value={snapshot ? String(count('Open')) : '–'} />
                <Stat label="In review" value={snapshot ? String(count('Review')) : '–'} />
                <Stat label="Paid" value={snapshot ? String(count('Paid')) : '–'} />
              </div>
              <a
                href={explorerAddress(ESCROW_ADDRESS)}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-5 inline-flex items-center gap-1.5 font-mono text-xs text-lime hover:underline"
              >
                Escrow {shortAddress(ESCROW_ADDRESS)} <ExternalLink size={12} />
              </a>
            </>
          ) : (
            <div className="mt-4 rounded-xl border border-dashed border-amber-signal/40 bg-amber-signal/5 p-4 text-sm text-amber-signal">
              The escrow contract address is not configured. Set VITE_ESCROW_ADDRESS to the deployed contract.
            </div>
          )}
        </aside>
      </div>
    </section>
  )
}
