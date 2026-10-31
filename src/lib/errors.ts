import { BaseError, ContractFunctionRevertedError } from 'viem'

export type ErrorKind = 'rejected' | 'funds' | 'revert' | 'network' | 'unknown'

export interface DescribedError {
  kind: ErrorKind
  message: string
}

const REVERTS: Record<string, string> = {
  NotSponsor: 'Only the sponsor of this bounty can do that.',
  InvalidStatus: 'This bounty changed state. Refresh the list and try again.',
  SponsorCannotSubmit: 'Sponsors cannot submit proof to their own bounty.',
  ZeroAmount: 'The reward must be greater than zero.',
  InvalidURI: 'The text you entered is empty or too long to store onchain.',
  InvalidBountyId: 'That bounty does not exist.',
  UnexpectedBalanceDelta: 'The escrow did not receive the exact USDC amount.',
  ReentrantCall: 'Blocked a reentrant call.',
  ERC20InsufficientAllowance: 'USDC allowance is too low. Approve the escrow first.',
  ERC20InsufficientBalance: 'Your USDC balance is too low for this reward.',
}

const REJECT = /user rejected|user denied|rejected the request|request rejected|denied transaction|cancell?ed/i
const FUNDS = /insufficient funds|exceeds balance|insufficient balance|gas required exceeds/i
const NETWORK = /network|timeout|timed out|fetch failed|failed to fetch|rpc|http request failed/i

function errorCode(error: unknown): number | undefined {
  let current: unknown = error
  for (let depth = 0; depth < 6 && current && typeof current === 'object'; depth++) {
    const code = (current as { code?: unknown }).code
    if (typeof code === 'number') return code
    current = (current as { cause?: unknown }).cause
  }
  return undefined
}

export function describeError(error: unknown): DescribedError {
  const raw = error instanceof Error ? error.message : String(error)
  const short = error instanceof BaseError ? error.shortMessage : raw

  if (errorCode(error) === 4001 || REJECT.test(raw)) {
    return { kind: 'rejected', message: 'You rejected the request in your wallet. Nothing was sent.' }
  }

  if (error instanceof BaseError) {
    const reverted = error.walk((e) => e instanceof ContractFunctionRevertedError)
    if (reverted instanceof ContractFunctionRevertedError) {
      const name = reverted.data?.errorName
      if (name && REVERTS[name]) return { kind: 'revert', message: REVERTS[name] }
      return { kind: 'revert', message: `The contract rejected this transaction${reverted.reason ? `: ${reverted.reason}` : '.'}` }
    }
  }

  if (FUNDS.test(raw)) {
    return {
      kind: 'funds',
      message: 'Not enough test USDC. Arc uses USDC for gas, so keep a little extra on top of the reward.',
    }
  }
  if (NETWORK.test(short)) {
    return { kind: 'network', message: 'Network issue talking to Arc Testnet. Check your connection and try again.' }
  }
  return { kind: 'unknown', message: short.length > 220 ? `${short.slice(0, 220)}…` : short }
}
