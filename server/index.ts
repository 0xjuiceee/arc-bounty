/**
 * Minimal server for optional Google sign-in wallets (Circle user-controlled wallets).
 *
 * - Holds CIRCLE_API_KEY (server only). It never sees a private key: keys live in Circle's MPC
 *   infrastructure and every transaction is approved by the user in Circle's hosted UI.
 * - Only allows contract calls to the escrow contract and the Arc Testnet USDC contract.
 *
 * Run: bun run server   (the Vite dev server proxies /api to this port)
 */
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { Blockchain, initiateUserControlledWalletsClient } from '@circle-fin/user-controlled-wallets'

const PORT = Number(process.env.SERVER_PORT ?? 3001)
const apiKey = process.env.CIRCLE_API_KEY
const escrow = (process.env.VITE_ESCROW_ADDRESS ?? '').toLowerCase()
// Arc Testnet USDC ERC-20 interface (allowed so the sponsor can approve the escrow).
const USDC = '0x3600000000000000000000000000000000000000'
const ALLOWED_TARGETS = new Set([escrow, USDC].filter(Boolean))

const client = apiKey ? initiateUserControlledWalletsClient({ apiKey }) : null

type Body = Record<string, unknown>

class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly code?: number,
  ) {
    super(message)
  }
}

function send(res: ServerResponse, status: number, payload: unknown) {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' })
  res.end(JSON.stringify(payload))
}

async function readBody(req: IncomingMessage): Promise<Body> {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of req) {
    size += (chunk as Buffer).length
    if (size > 64_000) throw new HttpError(413, 'Request too large')
    chunks.push(chunk as Buffer)
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}') as Body
  } catch {
    throw new HttpError(400, 'Invalid JSON')
  }
}

const str = (body: Body, key: string): string => {
  const value = body[key]
  if (typeof value !== 'string' || value.length === 0 || value.length > 20_000) {
    throw new HttpError(400, `Missing or invalid "${key}"`)
  }
  return value
}

function circleError(error: unknown): HttpError {
  const e = error as { response?: { status?: number; data?: { code?: number; message?: string } }; message?: string }
  const code = e.response?.data?.code
  return new HttpError(e.response?.status && e.response.status < 500 ? e.response.status : 502, e.response?.data?.message ?? e.message ?? 'Circle API error', code)
}

function requireClient() {
  if (!client) throw new HttpError(503, 'Google wallets are not configured on this server (CIRCLE_API_KEY missing).')
  return client
}

const ARC = 'ARC-TESTNET' as Blockchain

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
    if (!ALLOWED_TARGETS.has(to.toLowerCase())) throw new HttpError(403, 'Contract is not allowed')
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

createServer((req, res) => {
  void (async () => {
    try {
      const url = new URL(req.url ?? '/', 'http://localhost')
      if (req.method === 'GET' && url.pathname === '/health') {
        return send(res, 200, { ok: true, circleConfigured: Boolean(client) })
      }
      const match = /^\/circle\/([a-z-]+)$/.exec(url.pathname)
      const handler = match ? routes[match[1]] : undefined
      if (req.method !== 'POST' || !handler) throw new HttpError(404, 'Not found')
      send(res, 200, await handler(await readBody(req)))
    } catch (error) {
      const err = error instanceof HttpError ? error : circleError(error)
      send(res, err.status, { error: err.message, code: err.code })
    }
  })()
}).listen(PORT, () => console.log(`Arc Bounties server listening on :${PORT} (circle ${client ? 'on' : 'off'})`))

