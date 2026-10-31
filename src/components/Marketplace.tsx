import { useMemo, useState } from 'react'
import { AlertTriangle, Inbox, RefreshCw, Search } from 'lucide-react'
import { TokenUSDC } from '@web3icons/react'
import { STATUS_LABELS, type Bounty, type BountySnapshot } from '@/lib/bounties'
import { ESCROW_ADDRESS, shortAddress } from '@/lib/arc'
import { formatUsdcDisplay } from '@/lib/format'
import { StatusBadge } from './StatusBadge'

type Filter = 'All' | (typeof STATUS_LABELS)[number]

function BountyCard({ bounty, onOpen }: { bounty: Bounty; onOpen: () => void }) {
  return (
    <button
      onClick={onOpen}
      className="card group flex min-h-[176px] w-full flex-col p-5 text-left transition hover:-translate-y-0.5 hover:border-lime/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime"
    >
      <div className="flex items-start justify-between gap-3">
        <span className="rounded-lg bg-white/[0.05] px-2 py-1 text-xs font-medium text-mist-muted">
          {bounty.meta.category}
        </span>
        <StatusBadge status={bounty.status} />
      </div>
      <h3 className="mt-3 line-clamp-2 font-display text-lg font-semibold leading-snug tracking-tight text-mist text-balance">
        {bounty.meta.title}
      </h3>
      <div className="mt-auto flex items-end justify-between gap-3 pt-5">
        <div>
          <p className="flex items-center gap-1.5 font-display text-2xl font-bold tabular-nums text-lime">
            <TokenUSDC variant="branded" size={20} />
            {formatUsdcDisplay(bounty.reward)}
          </p>
          <p className="text-[11px] uppercase tracking-[0.08em] text-mist-dim">USDC reward</p>
        </div>
        <div className="text-right text-xs text-mist-muted">
          <p className="font-mono">#{bounty.id}</p>
          <p className="font-mono">{shortAddress(bounty.sponsor)}</p>
        </div>
      </div>
    </button>
  )
}

function Skeletons() {
  return (
    <>
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="card min-h-[176px] p-5">
          <div className="skeleton h-5 w-24 rounded-lg" />
          <div className="skeleton mt-4 h-6 w-4/5 rounded-lg" />
          <div className="skeleton mt-2 h-6 w-3/5 rounded-lg" />
          <div className="skeleton mt-8 h-8 w-32 rounded-lg" />
        </div>
      ))}
    </>
  )
}

interface MarketplaceProps {
  snapshot: BountySnapshot | undefined
  loading: boolean
  error: boolean
  fetching: boolean
  onRetry: () => void
  onOpen: (id: number) => void
  onPost: () => void
}

export function Marketplace({ snapshot, loading, error, fetching, onRetry, onOpen, onPost }: MarketplaceProps) {
  const [filter, setFilter] = useState<Filter>('All')
  const [query, setQuery] = useState('')

  const all = useMemo(() => snapshot?.bounties ?? [], [snapshot])
  const counts = useMemo(() => {
    const c: Record<string, number> = { All: all.length }
    for (const s of STATUS_LABELS) c[s] = all.filter((b) => b.status === s).length
    return c
  }, [all])

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return all.filter(
      (b) =>
        (filter === 'All' || b.status === filter) &&
        (!q || b.meta.title.toLowerCase().includes(q) || b.meta.category.toLowerCase().includes(q) || String(b.id) === q),
    )
  }, [all, filter, query])

  return (
    <section id="explore" className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="font-display text-3xl font-bold tracking-tight">Explore bounties</h2>
          <p className="mt-1.5 text-mist-muted">Read straight from the escrow contract, newest first.</p>
        </div>
        <div className="flex items-center gap-2">
          <label className="relative block flex-1 sm:w-60">
            <span className="sr-only">Search bounties</span>
            <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-mist-dim" />
            <input
              className="field !pl-10"
              placeholder="Search title, category or ID"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          <button className="btn-ghost !px-3.5" onClick={onRetry} aria-label="Refresh bounties" disabled={fetching}>
            <RefreshCw size={16} className={fetching ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      <div className="-mx-4 mt-5 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0" role="tablist" aria-label="Filter by status">
        {(['All', ...STATUS_LABELS] as Filter[]).map((f) => (
          <button
            key={f}
            role="tab"
            aria-selected={filter === f}
            onClick={() => setFilter(f)}
            className={`min-h-[44px] shrink-0 rounded-full border px-4 text-sm font-medium transition ${
              filter === f
                ? 'border-lime bg-lime text-ink'
                : 'border-white/10 bg-white/[0.03] text-mist-muted hover:border-lime/40 hover:text-mist'
            }`}
          >
            {f} <span className="ml-1 tabular-nums opacity-70">{counts[f] ?? 0}</span>
          </button>
        ))}
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {!ESCROW_ADDRESS ? null : loading ? (
          <Skeletons />
        ) : (
          visible.map((b) => <BountyCard key={b.id} bounty={b} onOpen={() => onOpen(b.id)} />)
        )}
      </div>

      {!ESCROW_ADDRESS && (
        <div className="card mt-6 flex items-start gap-3 p-6 text-sm text-mist-muted">
          <AlertTriangle className="mt-0.5 shrink-0 text-amber-signal" size={18} />
          <p>
            No escrow contract is configured yet. Deploy ArcBountiesEscrow and set <code className="font-mono text-lime">VITE_ESCROW_ADDRESS</code>.
          </p>
        </div>
      )}

      {error && (
        <div role="alert" className="card mt-6 flex flex-wrap items-center gap-3 border-red-400/30 p-5 text-sm text-red-200">
          <AlertTriangle size={18} />
          <p className="flex-1">Could not read bounties from Arc Testnet. Check your connection and retry.</p>
          <button className="btn-ghost" onClick={onRetry}>
            Retry
          </button>
        </div>
      )}

      {ESCROW_ADDRESS && !loading && !error && visible.length === 0 && (
        <div className="card mt-6 grid place-items-center gap-3 px-6 py-14 text-center">
          <Inbox size={30} className="text-mist-dim" />
          <p className="font-display text-xl font-semibold">
            {all.length === 0 ? 'No bounties yet' : 'No bounties match this filter'}
          </p>
          <p className="max-w-sm text-sm text-mist-muted">
            {all.length === 0
              ? 'Be the first sponsor. Lock test USDC and let someone ship the work.'
              : 'Try another status or clear your search.'}
          </p>
          {all.length === 0 && (
            <button className="btn-primary mt-1" onClick={onPost}>
              Post the first bounty
            </button>
          )}
        </div>
      )}
    </section>
  )
}
