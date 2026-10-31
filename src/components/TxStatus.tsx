import { AlertTriangle, CheckCircle2, ExternalLink, Loader2, Circle } from 'lucide-react'
import type { FlowState } from '@/hooks/useTxFlow'
import { explorerTx } from '@/lib/arc'

const HINT: Record<string, string> = {
  wallet: 'Confirm in your wallet…',
  confirming: 'Submitted. Waiting for confirmation…',
  done: 'Confirmed',
  error: 'Failed',
  pending: 'Waiting',
}

/** Real transaction progress only: every state here comes from the wallet or a chain receipt. */
export function TxStatus({ flow, doneMessage }: { flow: FlowState; doneMessage?: string }) {
  if (flow.steps.length === 0) return null

  return (
    <div className="mt-5 space-y-2 rounded-2xl border border-white/[0.07] bg-ink-900/70 p-4" aria-live="polite">
      {flow.steps.map((step) => (
        <div key={step.id} className="flex items-start gap-3">
          <span className="mt-0.5">
            {step.status === 'done' && <CheckCircle2 size={18} className="text-lime" />}
            {step.status === 'error' && <AlertTriangle size={18} className="text-red-300" />}
            {(step.status === 'wallet' || step.status === 'confirming') && (
              <Loader2 size={18} className="animate-spin text-lime" />
            )}
            {step.status === 'pending' && <Circle size={18} className="text-mist-dim" />}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-mist">{step.label}</p>
            <p className="text-xs text-mist-muted">{HINT[step.status]}</p>
            {step.hash && (
              <a
                href={explorerTx(step.hash)}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 inline-flex items-center gap-1 font-mono text-xs text-lime hover:underline"
              >
                {step.hash.slice(0, 10)}…{step.hash.slice(-8)} <ExternalLink size={12} />
              </a>
            )}
          </div>
        </div>
      ))}
      {flow.finished && doneMessage && <p className="pt-1 text-sm font-medium text-lime">{doneMessage}</p>}
      {flow.error && (
        <p
          className={`rounded-xl px-3 py-2 text-sm ${
            flow.error.kind === 'rejected' ? 'bg-white/5 text-mist-muted' : 'bg-red-400/10 text-red-200'
          }`}
        >
          {flow.error.message}
        </p>
      )}
    </div>
  )
}
