/**
 * Local server for optional Google sign-in wallets (Circle user-controlled wallets).
 * On Vercel the same routes run as a function (api/circle/[action].ts) instead.
 *
 * Run: bun run server   (the Vite dev server proxies /api to this port)
 */
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { circleServerConfigured, handleCircle, type Body } from './circle-routes'

const PORT = Number(process.env.SERVER_PORT ?? 3001)

function send(res: ServerResponse, status: number, payload: unknown) {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' })
  res.end(JSON.stringify(payload))
}

async function readBody(req: IncomingMessage): Promise<Body | null> {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of req) {
    size += (chunk as Buffer).length
    if (size > 64_000) return null
    chunks.push(chunk as Buffer)
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}') as Body
  } catch {
    return null
  }
}

createServer((req, res) => {
  void (async () => {
    const url = new URL(req.url ?? '/', 'http://localhost')
    if (req.method === 'GET' && url.pathname === '/health') {
      return send(res, 200, { ok: true, circleConfigured: circleServerConfigured() })
    }
    const match = /^\/circle\/([a-z-]+)$/.exec(url.pathname)
    if (req.method !== 'POST' || !match) return send(res, 404, { error: 'Not found' })
    const body = await readBody(req)
    if (!body) return send(res, 400, { error: 'Invalid or oversized JSON' })
    const result = await handleCircle(match[1], body)
    send(res, result.status, result.payload)
  })()
}).listen(PORT, () =>
  console.log(`Arc Bounties server listening on :${PORT} (circle ${circleServerConfigured() ? 'on' : 'off'})`),
)
