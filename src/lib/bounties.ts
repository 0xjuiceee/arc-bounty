import type { Address } from 'viem'
import { ESCROW_ADDRESS, publicClient } from './arc'
import { escrowAbi } from './escrowAbi'
import { decodeBountyMeta, decodeProofMeta, type BountyMeta, type ProofMeta } from './metadata'

export const STATUS_LABELS = ['Open', 'Review', 'Paid', 'Cancelled'] as const
export type StatusLabel = (typeof STATUS_LABELS)[number]

export interface Bounty {
  id: number
  sponsor: Address
  worker: Address | null
  reward: bigint
  status: StatusLabel
  metadataURI: string
  proofURI: string
  meta: BountyMeta
  proof: ProofMeta | null
}

const ZERO = '0x0000000000000000000000000000000000000000'
const PAGE = 50n

export interface BountySnapshot {
  bounties: Bounty[]
  totalEscrowed: bigint
}

/** Reads every bounty directly from the deployed contract, newest first. */
export async function fetchBountySnapshot(): Promise<BountySnapshot> {
  if (!ESCROW_ADDRESS) return { bounties: [], totalEscrowed: 0n }

  const [next, totalEscrowed] = await Promise.all([
    publicClient.readContract({ address: ESCROW_ADDRESS, abi: escrowAbi, functionName: 'nextBountyId' }),
    publicClient.readContract({ address: ESCROW_ADDRESS, abi: escrowAbi, functionName: 'totalEscrowed' }),
  ])

  const starts: bigint[] = []
  for (let start = 0n; start < next; start += PAGE) starts.push(start)

  const pages = await Promise.all(
    starts.map((start) =>
      publicClient.readContract({
        address: ESCROW_ADDRESS as Address,
        abi: escrowAbi,
        functionName: 'getBounties',
        args: [start, PAGE],
      }),
    ),
  )

  const bounties: Bounty[] = []
  pages.forEach((page, pageIndex) => {
    page.forEach((raw, i) => {
      const id = Number(starts[pageIndex] + BigInt(i))
      const hasWorker = raw.worker !== ZERO
      bounties.push({
        id,
        sponsor: raw.sponsor,
        worker: hasWorker ? raw.worker : null,
        reward: raw.reward,
        status: STATUS_LABELS[raw.status] ?? 'Open',
        metadataURI: raw.metadataURI,
        proofURI: raw.proofURI,
        meta: decodeBountyMeta(raw.metadataURI),
        proof: raw.proofURI ? decodeProofMeta(raw.proofURI) : null,
      })
    })
  })

  bounties.sort((a, b) => b.id - a.id)
  return { bounties, totalEscrowed }
}
