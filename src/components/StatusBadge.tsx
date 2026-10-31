import type { StatusLabel } from '@/lib/bounties'

const STYLES: Record<StatusLabel, string> = {
  Open: 'bg-lime/10 text-lime border-lime/30',
  Review: 'bg-amber-signal/10 text-amber-signal border-amber-signal/30',
  Paid: 'bg-emerald-400/10 text-emerald-300 border-emerald-300/30',
  Cancelled: 'bg-white/5 text-mist-muted border-white/10',
}

export function StatusBadge({ status }: { status: StatusLabel }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${STYLES[status]}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full bg-current ${status === 'Open' ? 'animate-pulseDot' : ''}`} />
      {status}
    </span>
  )
}
