import { useQuery } from '@tanstack/react-query'
import { ESCROW_ADDRESS } from '@/lib/arc'
import { fetchBountySnapshot } from '@/lib/bounties'
import { BOUNTIES_KEY } from './useEscrowActions'

export function useBounties() {
  return useQuery({
    queryKey: BOUNTIES_KEY,
    queryFn: fetchBountySnapshot,
    enabled: Boolean(ESCROW_ADDRESS),
    refetchInterval: 15_000,
    staleTime: 5_000,
  })
}
