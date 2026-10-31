import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { ExternalLink, Link2 } from 'lucide-react'
import { TokenUSDC } from '@web3icons/react'
import { useEscrowActions } from '@/hooks/useEscrowActions'
import type { Bounty } from '@/lib/bounties'
import { ESCROW_ADDRESS, explorerAddress, shortAddress } from '@/lib/arc'
import { formatUsdcDisplay } from '@/lib/format'
import { MAX_NOTE, MAX_PROOF_URL, encodeProofMeta, isValidProofInput, safeProofHref } from '@/lib/metadata'
import { useWallet } from '@/wallet/types'
import { Modal } from './Modal'
import { StatusBadge } from './StatusBadge'
import { TxStatus } from './TxStatus'
import { WalletGate } from './WalletGate'

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-white/[0.05] py-3 text-sm last:border-0">
      <dt className="text-mist-muted">{label}</dt>
      <dd className="min-w-0 text-right text-mist">{children}</dd>
    </div>
  )
}

function AddressLink({ address, me }: { address: string; me: boolean }) {
  return (
    <a
      href={explorerAddress(address)}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 font-mono text-lime hover:underline"
      title={address}
    >
      {shortAddress(address)} {me && <span className="rounded bg-lime/15 px-1.5 text-[10px] font-semibold text-lime">YOU</span>}
      <ExternalLink size={12} />
    </a>
  )
}

function ProofSection({ busy, done, onSubmit }: { busy: boolean; done: boolean; onSubmit: (uri: string) => Promise<boolean> }) {
  const [open, setOpen] = useState(false)
  const [url, setUrl] = useState('')
  const [note, setNote] = useState('')

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!isValidProofInput(url)) return
    const ok = await onSubmit(encodeProofMeta({ url: url.trim(), note: note.trim() }))
    if (ok) setOpen(false)
  }

  if (!open) {
    return done ? null : (
      <button className="btn-primary w-full" onClick={() => setOpen(true)}>Submit proof</button>
    )
  }
  return (
    <form onSubmit={(e) => void submit(e)} className="space-y-3 rounded-2xl border border-lime/20 bg-lime/[0.03] p-4">
      <div>
        <label className="label" htmlFor="p-url">Proof URL or IPFS URI</label>
        <input id="p-url" className="field" maxLength={MAX_PROOF_URL} placeholder="https://github.com/you/repo/pull/1 or ipfs://…" value={url} onChange={(e) => setUrl(e.target.value)} disabled={busy} />
        {url && !isValidProofInput(url) && <p role="alert" className="mt-1 text-sm text-red-300">Use an https:// link or an ipfs:// URI.</p>}
      </div>
      <div>
        <label className="label" htmlFor="p-note">Note (optional)</label>
        <textarea id="p-note" className="field min-h-[84px] resize-y" maxLength={MAX_NOTE} value={note} onChange={(e) => setNote(e.target.value)} disabled={busy} />
      </div>
      <div className="flex gap-2">
        <button type="submit" className="btn-primary flex-1" disabled={busy || !isValidProofInput(url)}>{busy ? 'Working…' : 'Submit proof onchain'}</button>
        <button type="button" className="btn-ghost" onClick={() => setOpen(false)} disabled={busy}>Cancel</button>
      </div>
    </form>
  )
}

export function BountyDetail({ bounty, onClose }: { bounty: Bounty | null; onClose: () => void }) {
  const w = useWallet()
  const actions = useEscrowActions()
  const { state, reset } = actions
  const id = bounty?.id
  useEffect(() => {
    reset()
  }, [id, reset])

  const me = w.address?.toLowerCase()
  const isSponsor = Boolean(bounty && me && bounty.sponsor.toLowerCase() === me)
  const busy = state.running
  const proofHref = bounty?.proof ? safeProofHref(bounty.proof.url) : null

  return (
    <Modal
      open={bounty !== null}
      onClose={busy ? () => undefined : onClose}
      variant="sheet"
      title={bounty?.meta.title ?? ''}
      subtitle={bounty ? `Bounty #${bounty.id} · ${bounty.meta.category}` : undefined}
    >
      {bounty && (
        <div className="space-y-6">
          <div className="flex items-center justify-between gap-3">
            <p className="flex items-center gap-2 font-display text-4xl font-bold tabular-nums text-lime">
              <TokenUSDC variant="branded" size={30} /> {formatUsdcDisplay(bounty.reward)}
              <span className="text-base font-medium text-mist-muted">USDC</span>
            </p>
            <StatusBadge status={bounty.status} />
          </div>

          <section>
            <h3 className="label">Description</h3>
            <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-mist text-pretty">
              {bounty.meta.description || 'No description provided.'}
            </p>
          </section>

          <dl className="rounded-2xl border border-white/[0.07] bg-ink-900/60 px-4">
            <Row label="Sponsor"><AddressLink address={bounty.sponsor} me={isSponsor} /></Row>
            <Row label="Worker">
              {bounty.worker ? <AddressLink address={bounty.worker} me={me === bounty.worker.toLowerCase()} /> : <span className="text-mist-muted">Not assigned yet</span>}
            </Row>
            <Row label="Reward">{formatUsdcDisplay(bounty.reward)} USDC</Row>
            <Row label="Status">{bounty.status}</Row>
            {ESCROW_ADDRESS && <Row label="Escrow contract"><AddressLink address={ESCROW_ADDRESS} me={false} /></Row>}
          </dl>

          {bounty.proof && (
            <section>
              <h3 className="label">Submitted proof</h3>
              <div className="space-y-2 rounded-2xl border border-white/[0.07] bg-ink-900/60 p-4 text-sm">
                {proofHref ? (
                  <a href={proofHref} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex max-w-full items-center gap-1.5 break-all text-lime hover:underline">
                    <Link2 size={14} className="shrink-0" /> {bounty.proof.url}
                  </a>
                ) : (
                  <p className="break-all text-mist">{bounty.proof.url}</p>
                )}
                {bounty.proof.note && <p className="whitespace-pre-wrap break-words text-mist-muted">{bounty.proof.note}</p>}
              </div>
              <p className="mt-2 text-xs text-mist-dim">Proof links come from the worker. Check them before you release funds.</p>
            </section>
          )}

          <section className="space-y-3">
            <WalletGate>
              {bounty.status === 'Open' && !isSponsor && (
                <ProofSection
                  key={bounty.id}
                  busy={busy}
                  done={state.finished}
                  onSubmit={(uri) => actions.submitProof(bounty.id, uri)}
                />
              )}
              {bounty.status === 'Open' && isSponsor && (
                <p className="rounded-xl bg-white/[0.04] px-3 py-2.5 text-sm text-mist-muted">Waiting for a worker to submit proof. You can cancel any time to get your USDC back.</p>
              )}

              {/* Sponsor: review */}
              {bounty.status === 'Review' && isSponsor && (
                <div className="space-y-2">
                  <button className="btn-primary w-full" disabled={busy} onClick={() => void actions.release(bounty.id)}>Release USDC</button>
                  <button className="btn-ghost w-full" disabled={busy} onClick={() => void actions.reject(bounty.id)}>Reject proof and reopen</button>
                </div>
              )}
              {bounty.status === 'Review' && !isSponsor && (
                <p className="rounded-xl bg-white/[0.04] px-3 py-2.5 text-sm text-mist-muted">Proof submitted. The sponsor decides whether to release the reward.</p>
              )}
              {(bounty.status === 'Open' || bounty.status === 'Review') && isSponsor && (
                <button className="btn-danger w-full" disabled={busy} onClick={() => void actions.cancel(bounty.id)}>Cancel & return USDC</button>
              )}
              {bounty.status === 'Paid' && <p className="rounded-xl bg-emerald-400/10 px-3 py-2.5 text-sm text-emerald-200">Paid. The reward was sent directly to the worker's wallet.</p>}
              {bounty.status === 'Cancelled' && <p className="rounded-xl bg-white/[0.04] px-3 py-2.5 text-sm text-mist-muted">Cancelled. The escrowed USDC went back to the sponsor.</p>}
            </WalletGate>
            <TxStatus flow={state} doneMessage="Confirmed onchain. The list has been refreshed." />
          </section>
        </div>
      )}
    </Modal>
  )
}
