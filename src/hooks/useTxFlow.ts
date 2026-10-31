import { useCallback, useRef, useState } from 'react'
import type { Hash } from 'viem'
import { publicClient } from '@/lib/arc'
import { describeError, type DescribedError } from '@/lib/errors'

export type StepStatus = 'pending' | 'wallet' | 'confirming' | 'done' | 'error'

export interface TxStep {
  id: string
  label: string
  status: StepStatus
  hash?: Hash
}

export interface StepDef {
  id: string
  label: string
  /** Optional preflight (e.g. a simulation) that throws a decodable error before the wallet is asked. */
  preflight?: () => Promise<void>
  /** Submits the transaction and resolves with its hash. */
  submit: () => Promise<Hash>
}

export interface FlowState {
  running: boolean
  finished: boolean
  steps: TxStep[]
  error: DescribedError | null
}

const IDLE: FlowState = { running: false, finished: false, steps: [], error: null }

export function useTxFlow() {
  const [state, setState] = useState<FlowState>(IDLE)
  const busy = useRef(false)

  const patchStep = (id: string, patch: Partial<TxStep>) =>
    setState((s) => ({ ...s, steps: s.steps.map((step) => (step.id === id ? { ...step, ...patch } : step)) }))

  const run = useCallback(async (defs: StepDef[], onFinished?: () => void | Promise<void>): Promise<boolean> => {
    if (busy.current) return false
    busy.current = true
    setState({
      running: true,
      finished: false,
      error: null,
      steps: defs.map((d) => ({ id: d.id, label: d.label, status: 'pending' })),
    })

    let currentId = defs[0]?.id
    try {
      for (const def of defs) {
        currentId = def.id
        patchStep(def.id, { status: 'wallet' })
        if (def.preflight) await def.preflight()
        const hash = await def.submit()
        patchStep(def.id, { status: 'confirming', hash })
        const receipt = await publicClient.waitForTransactionReceipt({ hash, timeout: 90_000 })
        if (receipt.status !== 'success') {
          throw Object.assign(new Error('Transaction reverted onchain.'), { reverted: true })
        }
        patchStep(def.id, { status: 'done' })
      }
      setState((s) => ({ ...s, running: false, finished: true }))
      await onFinished?.()
      return true
    } catch (error) {
      const described = (error as { reverted?: boolean }).reverted
        ? { kind: 'revert' as const, message: 'The transaction was mined but reverted. No funds moved.' }
        : describeError(error)
      if (currentId) patchStep(currentId, { status: 'error' })
      setState((s) => ({ ...s, running: false, error: described }))
      return false
    } finally {
      busy.current = false
    }
  }, [])

  const reset = useCallback(() => {
    if (!busy.current) setState(IDLE)
  }, [])

  return { state, run, reset }
}
