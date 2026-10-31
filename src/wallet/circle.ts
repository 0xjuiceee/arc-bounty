/**
 * Google sign-in wallets via Circle user-controlled wallets (non-custodial, MPC).
 * The browser holds the user session; a small server route (server/index.ts) holds the
 * Circle API key and never sees a private key. Every transaction is approved by the user
 * in Circle's hosted UI.
 */
import type { W3SSdk } from '@circle-fin/w3s-pw-web-sdk'
import type { Address, Hash, Hex } from 'viem'
import { sleep } from '@/lib/sleep'

const APP_ID = (import.meta.env.VITE_CIRCLE_APP_ID ?? '').trim()
const GOOGLE_CLIENT_ID = (import.meta.env.VITE_GOOGLE_CLIENT_ID ?? '').trim()

export const circleConfigured = APP_ID.length > 0 && GOOGLE_CLIENT_ID.length > 0

interface Session {
  deviceId?: string
  deviceToken?: string
  deviceEncryptionKey?: string
  userToken?: string
  encryptionKey?: string
  walletId?: string
}

const KEY = 'arc-bounties.circle-session'

export function readSession(): Session {
  try {
    return JSON.parse(sessionStorage.getItem(KEY) ?? '{}') as Session
  } catch {
    return {}
  }
}

function writeSession(patch: Session): Session {
  const next = { ...readSession(), ...patch }
  sessionStorage.setItem(KEY, JSON.stringify(next))
  return next
}

export function clearSession(): void {
  sessionStorage.removeItem(KEY)
}

export const hasLoginSession = (): boolean => {
  const s = readSession()
  return Boolean(s.userToken && s.encryptionKey)
}

class CircleApiError extends Error {
  code?: number
}

async function api<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(`/api/circle/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = (await res.json().catch(() => ({}))) as T & { error?: string; code?: number }
  if (!res.ok) {
    const err = new CircleApiError(data.error ?? 'Google wallet service is unavailable')
    err.code = data.code
    throw err
  }
  return data
}

let sdkPromise: Promise<W3SSdk> | null = null
const loginErrors = new Set<(message: string) => void>()
const loginSuccess = new Set<() => void>()

export const onLoginError = (fn: (message: string) => void) => {
  loginErrors.add(fn)
  return () => void loginErrors.delete(fn)
}
export const onLoginSuccess = (fn: () => void) => {
  loginSuccess.add(fn)
  return () => void loginSuccess.delete(fn)
}

function loginConfigs() {
  const s = readSession()
  return {
    deviceToken: s.deviceToken ?? '',
    deviceEncryptionKey: s.deviceEncryptionKey ?? '',
    google: { clientId: GOOGLE_CLIENT_ID, redirectUri: window.location.origin, selectAccountPrompt: true },
  }
}

export function getSdk(): Promise<W3SSdk> {
  sdkPromise ??= (async () => {
    const { W3SSdk } = await import('@circle-fin/w3s-pw-web-sdk')
    const sdk = new W3SSdk(
      { appSettings: { appId: APP_ID }, loginConfigs: loginConfigs() },
      (error, result) => {
        if (error || !result || !('userToken' in result)) {
          loginErrors.forEach((fn) => fn(error?.message ?? 'Google sign-in did not complete.'))
          return
        }
        writeSession({ userToken: result.userToken, encryptionKey: result.encryptionKey })
        loginSuccess.forEach((fn) => fn())
      },
    )
    // Establishes the iframe session; execute() fails silently without it.
    const deviceId = await sdk.getDeviceId()
    writeSession({ deviceId })
    return sdk
  })()
  return sdkPromise
}

/** Step 1: exchange the browser device id for a device token, then redirect to Google. */
export async function startGoogleLogin(): Promise<void> {
  const sdk = await getSdk()
  const { deviceId } = readSession()
  if (!deviceId) throw new Error('Could not establish a device session. Reload and try again.')
  const tokens = await api<{ deviceToken: string; deviceEncryptionKey: string }>('device-token', { deviceId })
  writeSession(tokens)
  sdk.updateConfigs({ appSettings: { appId: APP_ID }, loginConfigs: loginConfigs() })
  const { SocialLoginProvider } = await import('@circle-fin/w3s-pw-web-sdk/dist/src/types')
  await sdk.performLogin(SocialLoginProvider.GOOGLE)
}

function runChallenge(sdk: W3SSdk, challengeId: string): Promise<void> {
  const { userToken, encryptionKey } = readSession()
  if (!userToken || !encryptionKey) return Promise.reject(new Error('Your Google session expired. Sign in again.'))
  sdk.setAuthentication({ userToken, encryptionKey })
  return new Promise((resolve, reject) => {
    sdk.execute(challengeId, (error) => {
      if (error) reject(new Error(error.message || 'The request was cancelled.'))
      else resolve()
    })
  })
}

export interface CircleWallet {
  walletId: string
  address: Address
}

/** Step 3/4: find the user's Arc Testnet wallet, creating it (user-approved) on first sign-in. */
export async function loadOrCreateWallet(): Promise<CircleWallet> {
  const { userToken } = readSession()
  if (!userToken) throw new Error('Your Google session expired. Sign in again.')
  const sdk = await getSdk()

  const existing = await api<{ wallet: CircleWallet | null; challengeId?: string }>('wallet', { userToken })
  if (existing.wallet) {
    writeSession({ walletId: existing.wallet.walletId })
    return existing.wallet
  }
  if (!existing.challengeId) throw new Error('Could not create a wallet for this account.')

  await runChallenge(sdk, existing.challengeId)
  for (let attempt = 0; attempt < 15; attempt++) {
    const next = await api<{ wallet: CircleWallet | null }>('wallet', { userToken })
    if (next.wallet) {
      writeSession({ walletId: next.wallet.walletId })
      return next.wallet
    }
    await sleep(1500)
  }
  throw new Error('Your wallet is still being created. Reload in a moment.')
}

/** Sends a contract call from the Google wallet. The user approves it in Circle's hosted UI. */
export async function sendFromGoogleWallet(to: Address, data: Hex): Promise<Hash> {
  const { userToken, walletId } = readSession()
  if (!userToken || !walletId) throw new Error('Your Google session expired. Sign in again.')
  const sdk = await getSdk()
  const since = new Date(Date.now() - 5000).toISOString()

  const { challengeId } = await api<{ challengeId: string }>('execute', { userToken, walletId, to, callData: data })
  await runChallenge(sdk, challengeId)

  for (let attempt = 0; attempt < 60; attempt++) {
    const tx = await api<{ state: string; txHash: string | null } | { state: null; txHash: null }>('transaction', {
      userToken,
      walletId,
      since,
      to,
    })
    if (tx.state === 'FAILED' || tx.state === 'DENIED' || tx.state === 'CANCELLED') {
      throw new Error('The transaction was not completed (' + tx.state.toLowerCase() + ').')
    }
    if (tx.txHash) return tx.txHash as Hash
    await sleep(2000)
  }
  throw new Error('Timed out waiting for the transaction to be submitted.')
}
