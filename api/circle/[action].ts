/**
 * Vercel function for optional Google sign-in wallets: POST /api/circle/<action>.
 * Reads CIRCLE_API_KEY from the project's environment variables (server only).
 */
import { handleCircle, type Body } from '../../server/circle-routes'

const json = (status: number, payload: unknown) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  })

export async function POST(request: Request): Promise<Response> {
  const action = new URL(request.url).pathname.split('/').filter(Boolean).pop() ?? ''
  const text = await request.text()
  if (text.length > 64_000) return json(413, { error: 'Request too large' })
  let body: Body
  try {
    body = JSON.parse(text || '{}') as Body
  } catch {
    return json(400, { error: 'Invalid JSON' })
  }
  const result = await handleCircle(action, body)
  return json(result.status, result.payload)
}
