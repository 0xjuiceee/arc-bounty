import { useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { encodeFunctionData, erc20Abi } from 'viem'
import { ESCROW_ADDRESS, USDC_ADDRESS, publicClient } from '@/lib/arc'
import { escrowAbi } from '@/lib/escrowAbi'
import { describeError } from '@/lib/errors'
import { useWallet } from '@/wallet/types'
import { useTxFlow, type StepDef } from './useTxFlow'

export const BOUNTIES_KEY = ['bounties'] as const

/** Every write the app can make to the escrow, as multi-step flows with real receipts. */
export function useEscrowActions() {
  const wallet = useWallet()
  const queryClient = useQueryClient()
  const { state, run, reset } = useTxFlow()

  const afterFlow = useCallback(async () => {
    await Promise.all([queryClient.invalidateQueries({ queryKey: BOUNTIES_KEY }), wallet.refreshBalance()])
  }, [queryClient, wallet])

  const requireReady = useCallback(() => {
    if (!ESCROW_ADDRESS) throw new Error('The escrow contract address is not configured.')
    if (!wallet.address) throw new Error('Connect a wallet first.')
    return { escrow: ESCROW_ADDRESS, account: wallet.address }
  }, [wallet.address])

  const createBounty = useCallback(
    async (reward: bigint, metadataURI: string) => {
      let escrow, account
      try {
        ;({ escrow, account } = requireReady())
        if (wallet.usdcBalance !== undefined && wallet.usdcBalance < reward) {
          throw new Error('Your USDC balance is lower than this reward.')
        }
      } catch (error) {
        return run([
          {
            id: 'precheck',
            label: 'Check wallet',
            submit: () => Promise.reject(new Error(describeError(error).message)),
          },
        ])
      }

      const allowance = await publicClient
        .readContract({ address: USDC_ADDRESS, abi: erc20Abi, functionName: 'allowance', args: [account, escrow] })
        .catch(() => 0n)

      const steps: StepDef[] = []
      if (allowance < reward) {
        steps.push({
          id: 'approve',
          label: 'Approve USDC for escrow',
          submit: () =>
            wallet.sendTransaction({
              to: USDC_ADDRESS,
              data: encodeFunctionData({ abi: erc20Abi, functionName: 'approve', args: [escrow, reward] }),
            }),
        })
      }
      steps.push({
        id: 'create',
        label: 'Create bounty and lock USDC',
        preflight: async () => {
          await publicClient.simulateContract({
            address: escrow, abi: escrowAbi, functionName: 'createBounty', args: [reward, metadataURI], account,
          })
        },
        submit: () =>
          wallet.sendTransaction({
            to: escrow,
            data: encodeFunctionData({ abi: escrowAbi, functionName: 'createBounty', args: [reward, metadataURI] }),
          }),
      })
      return run(steps, afterFlow)
    },
    [afterFlow, requireReady, run, wallet],
  )

  const submitProof = useCallback(
    async (id: number, proofURI: string) => {
      const { escrow, account } = requireReady()
      return run(
        [
          {
            id: 'proof',
            label: 'Submit proof',
            preflight: async () => {
              await publicClient.simulateContract({
                address: escrow, abi: escrowAbi, functionName: 'submitProof', args: [BigInt(id), proofURI], account,
              })
            },
            submit: () =>
              wallet.sendTransaction({
                to: escrow,
                data: encodeFunctionData({ abi: escrowAbi, functionName: 'submitProof', args: [BigInt(id), proofURI] }),
              }),
          },
        ],
        afterFlow,
      )
    },
    [afterFlow, requireReady, run, wallet],
  )

  const sponsorAction = useCallback(
    async (fn: 'release' | 'cancel' | 'rejectProof', id: number, label: string) => {
      const { escrow, account } = requireReady()
      return run(
        [
          {
            id: fn,
            label,
            preflight: async () => {
              await publicClient.simulateContract({
                address: escrow, abi: escrowAbi, functionName: fn, args: [BigInt(id)], account,
              })
            },
            submit: () =>
              wallet.sendTransaction({
                to: escrow,
                data: encodeFunctionData({ abi: escrowAbi, functionName: fn, args: [BigInt(id)] }),
              }),
          },
        ],
        afterFlow,
      )
    },
    [afterFlow, requireReady, run, wallet],
  )

  return {
    state,
    reset,
    createBounty,
    submitProof,
    release: (id: number) => sponsorAction('release', id, 'Release USDC to worker'),
    cancel: (id: number) => sponsorAction('cancel', id, 'Cancel and return USDC'),
    reject: (id: number) => sponsorAction('rejectProof', id, 'Reject proof and reopen'),
  }
}
