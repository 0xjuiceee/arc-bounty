/**
 * Circle user-controlled wallet routes for optional Google sign-in.
 * Shared by the local Node server (server/index.ts) and the Vercel function (api/circle/[action].ts).
 *
 * - Holds CIRCLE_API_KEY (server only). It never sees a private key: keys live in Circle's MPC
 *   infrastructure and every transaction is approved by the user in Circle's hosted UI.
 * - Only allows contract calls to the escrow contract and the Arc Testnet USDC contract.
 */
import { Blockchain, initiateUserControlledWalletsClient } from '@circle-fin/user-controlled-wallets'

// Arc Testnet USDC ERC-20 interface (allowed so the sponsor can approve the escrow).
const USDC = '0x3600000000000000000000000000000000000000'
const ARC = 'ARC-TESTNET' as Blockchain

export type Body = Record<string, unknown>

export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly code?: number,
  ) {
    super(message)
  }
}

let cached: ReturnType<typeof initiateUserControlledWalletsClient> | null = null

function requireClient() {
  const apiKey = process.env.CIRCLE_API_KEY
  if (!apiKey) throw new HttpError(503, 'Google wallets are not configured on this server (CIRCLE_API_KEY missing).')
  cached ??= initiateUserControlledWalletsClient({ apiKey })
  return cached
}

export const circleServerConfigured = (): boolean => Boolean(process.env.CIRCLE_API_KEY)

const str = (body: Body, key: string): string => {
  const value = body[key]
  if (typeof value !== 'string' || value.length === 0 || value.length > 20_000) {
    throw new HttpError(400, `Missing or invalid "${key}"`)
  }
  return value
}

export function circleError(error: unknown): HttpError {
  if (error instanceof HttpError) return error
  const e = error as { response?: { status?: number; data?: { code?: number; message?: string } }; message?: string }
  const status = e.response?.status && e.response.status < 500 ? e.response.status : 502
  return new HttpError(status, e.response?.data?.message ?? e.message ?? 'Circle API error', e.response?.data?.code)
}

async function findWallet(userToken: string) {
  const res = await requireClient().listWallets({ userToken })
  const wallet = res.data?.wallets?.find((w) => (w.blockchain as string) === ARC)
  return wallet ? { walletId: wallet.id, address: wallet.address } : null
}

const routes: Record<string, (body: Body) => Promise<unknown>> = {
  async 'device-token'(body) {
    const deviceId = str(body, 'deviceId')
    const res = await requireClient().createDeviceTokenForSocialLogin({ deviceId })
    return { deviceToken: res.data?.deviceToken, deviceEncryptionKey: res.data?.deviceEncryptionKey }
  },

  // Returns the user's Arc Testnet wallet, or a challenge the user approves to create one.
  async wallet(body) {
    const userToken = str(body, 'userToken')
    const existing = await findWallet(userToken)
    if (existing) return { wallet: existing }
    try {
      const res = await requireClient().createUserPinWithWallets({
        userToken,
        blockchains: [ARC],
        accountType: 'EOA',
      })
      return { wallet: null, challengeId: res.data?.challengeId }
    } catch (error) {
      const err = circleError(error)
      // 155106: the user is already initialized, so add a wallet instead.
      if (err.code !== 155106) throw err
      const res = await requireClient().createWallet({ userToken, blockchains: [ARC], accountType: 'EOA' })
      return { wallet: null, challengeId: res.data?.challengeId }
    }
  },

  // Creates a challenge to call a contract. The user approves it in Circle's hosted UI.
  async execute(body) {
    const userToken = str(body, 'userToken')
    const walletId = str(body, 'walletId')
    const to = str(body, 'to')
    const callData = str(body, 'callData')
    const escrow = (process.env.VITE_ESCROW_ADDRESS ?? '').trim().toLowerCase()
    const allowed = new Set([escrow, USDC].filter(Boolean))
    if (!allowed.has(to.toLowerCase())) throw new HttpError(403, 'Contract is not allowed')
    if (!/^0x([0-9a-fA-F]{2})+$/.test(callData)) throw new HttpError(400, 'Invalid call data')
    const res = await requireClient().createUserTransactionContractExecutionChallenge({
      userToken,
      walletId,
      contractAddress: to,
      callData: callData as `0x${string}`,
      fee: { type: 'level', config: { feeLevel: 'MEDIUM' } },
    })
    return { challengeId: res.data?.challengeId }
  },

  // Finds the newest transaction from this wallet to the target contract since a timestamp.
  async transaction(body) {
    const userToken = str(body, 'userToken')
    const walletId = str(body, 'walletId')
    const to = str(body, 'to').toLowerCase()
    const since = Date.parse(str(body, 'since'))
    const res = await requireClient().listTransactions({ userToken, walletIds: [walletId], order: 'DESC', pageSize: 10 })
    const match = res.data?.transactions?.find(
      (t) => t.contractAddress?.toLowerCase() === to && Date.parse(t.createDate) >= since,
    )
    return match ? { state: match.state, txHash: match.txHash ?? null } : { state: null, txHash: null }
  },
}

export async function handleCircle(action: string, body: Body): Promise<{ status: number; payload: unknown }> {
  try {
    const handler = Object.prototype.hasOwnProperty.call(routes, action) ? routes[action] : undefined
    if (!handler) throw new HttpError(404, 'Not found')
    return { status: 200, payload: await handler(body) }
  } catch (error) {
    const err = circleError(error)
    return { status: err.status, payload: { error: err.message, code: err.code } }
  }
}
