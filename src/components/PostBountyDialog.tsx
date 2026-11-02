import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useEscrowActions } from '@/hooks/useEscrowActions'
import { formatUsdcDisplay } from '@/lib/format'
import { CATEGORIES, MAX_DESCRIPTION, MAX_TITLE, encodeBountyMeta } from '@/lib/metadata'
import { AmountError, parseUsdc } from '@/onchain-money'
import { useWallet } from '@/wallet/types'
import { Modal } from './Modal'
import { TxStatus } from './TxStatus'
import { WalletGate } from './WalletGate'

export function PostBountyDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const w = useWallet()
  const actions = useEscrowActions()
  const { state, reset } = actions
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState<string>(CATEGORIES[0])
  const [description, setDescription] = useState('')
  const [reward, setReward] = useState('')

  useEffect(() => {
    if (open) reset()
  }, [open, reset])

  const parsed = useMemo(() => {
    if (!reward.trim()) return { raw: null as bigint | null, error: null as string | null }
    try {
      const raw = parseUsdc(reward)
      if (raw <= 0n) return { raw: null, error: 'Reward must be greater than zero.' }
      if (raw > 2n ** 128n - 1n) return { raw: null, error: 'Reward is too large.' }
      return { raw, error: null }
    } catch (e) {
      return { raw: null, error: e instanceof AmountError && e.code === 'TOO_MANY_FRACTION_DIGITS' ? 'USDC supports up to 6 decimal places.' : 'Enter a valid USDC amount, like 25 or 12.5.' }
    }
  }, [reward])

  const lowBalance = parsed.raw !== null && w.usdcBalance !== undefined && w.usdcBalance < parsed.raw
  const formOk = title.trim().length >= 3 && description.trim().length >= 10 && parsed.raw !== null && !lowBalance

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!formOk || parsed.raw === null) return
    const ok = await actions.createBounty(
      parsed.raw,
      encodeBountyMeta({ title: title.trim(), description: description.trim(), category }),
    )
    if (ok) {
      setTitle('')
      setDescription('')
      setReward('')
    }
  }

  const busy = state.running

  return (
    <Modal
      open={open}
      onClose={busy ? () => undefined : onClose}
      title="Post a bounty"
      subtitle="Your reward is locked in the escrow contract until you release or cancel it."
    >
      <form onSubmit={(e) => void submit(e)} className="space-y-4">
        <div>
          <label className="label" htmlFor="b-title">Title</label>
          <input id="b-title" className="field" maxLength={MAX_TITLE} placeholder="Design a landing page hero" value={title} onChange={(e) => setTitle(e.target.value)} disabled={busy} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="b-cat">Category</label>
            <select id="b-cat" className="field" value={category} onChange={(e) => setCategory(e.target.value)} disabled={busy}>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="b-reward">Reward (USDC)</label>
            <input id="b-reward" className="field tabular-nums" inputMode="decimal" placeholder="25.00" value={reward} onChange={(e) => setReward(e.target.value)} disabled={busy} />
          </div>
        </div>
        {parsed.error && <p role="alert" className="-mt-2 text-sm text-red-300">{parsed.error}</p>}
        {w.address && (
          <p className="-mt-2 text-xs text-mist-muted tabular-nums">
            Balance: {w.usdcBalance === undefined ? '…' : `${formatUsdcDisplay(w.usdcBalance)} USDC`}. Arc also uses USDC for gas, so keep a little extra.
          </p>
        )}
        {lowBalance && (
          <p role="alert" className="-mt-2 text-sm text-red-300">
            Your balance is lower than this reward.{' '}
            <button type="button" className="font-semibold text-lime underline" onClick={w.openFaucet}>Get test USDC</button>
          </p>
        )}
        <div>
          <label className="label" htmlFor="b-desc">Description</label>
          <textarea id="b-desc" className="field min-h-[120px] resize-y" maxLength={MAX_DESCRIPTION} placeholder="What needs to be done, and what proof will you accept?" value={description} onChange={(e) => setDescription(e.target.value)} disabled={busy} />
          <p className="mt-1 text-right text-xs text-mist-dim tabular-nums">{description.length}/{MAX_DESCRIPTION}</p>
        </div>

        <WalletGate>
          {state.finished ? (
            <button type="button" className="btn-primary w-full" onClick={onClose}>Done</button>
          ) : (
            <button type="submit" className="btn-primary w-full" disabled={!formOk || busy}>
              {busy ? 'Working…' : state.error ? 'Try again' : 'Approve USDC & create bounty'}
            </button>
          )}
        </WalletGate>
        <TxStatus flow={state} doneMessage="Bounty created and funded. It is now live in the marketplace." />
      </form>
    </Modal>
  )
}
