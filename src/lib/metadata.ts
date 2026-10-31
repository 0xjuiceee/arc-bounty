/**
 * Testnet MVP storage: bounty and proof details are encoded as data URIs and stored
 * in the contract itself. Everything decoded here is untrusted user input.
 */

export const CATEGORIES = ['Development', 'Design', 'Writing', 'Research', 'Community', 'Other'] as const
export type Category = (typeof CATEGORIES)[number]

const PREFIX = 'data:application/json,'
export const MAX_TITLE = 80
export const MAX_DESCRIPTION = 1200
export const MAX_NOTE = 600
export const MAX_PROOF_URL = 500

export interface BountyMeta {
  title: string
  description: string
  category: string
}

export interface ProofMeta {
  url: string
  note: string
}

export function encodeBountyMeta(meta: BountyMeta): string {
  return PREFIX + encodeURIComponent(JSON.stringify({ v: 1, ...meta }))
}

export function encodeProofMeta(meta: ProofMeta): string {
  return PREFIX + encodeURIComponent(JSON.stringify({ v: 1, ...meta }))
}

function readJson(uri: string): Record<string, unknown> | null {
  if (!uri.startsWith(PREFIX)) return null
  try {
    const parsed: unknown = JSON.parse(decodeURIComponent(uri.slice(PREFIX.length)))
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null
  } catch {
    return null
  }
}

const str = (value: unknown, max: number): string => (typeof value === 'string' ? value.slice(0, max) : '')

export function decodeBountyMeta(uri: string): BountyMeta {
  const json = readJson(uri)
  if (!json) return { title: 'Untitled bounty', description: uri.slice(0, MAX_DESCRIPTION), category: 'Other' }
  return {
    title: str(json.title, MAX_TITLE) || 'Untitled bounty',
    description: str(json.description, MAX_DESCRIPTION),
    category: str(json.category, 24) || 'Other',
  }
}

export function decodeProofMeta(uri: string): ProofMeta {
  const json = readJson(uri)
  if (!json) return { url: uri.slice(0, MAX_PROOF_URL), note: '' }
  return { url: str(json.url, MAX_PROOF_URL), note: str(json.note, MAX_NOTE) }
}

/** Returns a safe https URL for an http(s) or ipfs:// proof link, otherwise null. Never returns javascript: or data: URLs. */
export function safeProofHref(raw: string): string | null {
  const value = raw.trim()
  if (value.startsWith('ipfs://')) {
    const path = value.slice('ipfs://'.length).replace(/^ipfs\//, '')
    return /^[\w./-]+$/.test(path) && path.length > 0 ? `https://ipfs.io/ipfs/${path}` : null
  }
  try {
    const url = new URL(value)
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : null
  } catch {
    return null
  }
}

export const isValidProofInput = (raw: string): boolean => safeProofHref(raw) !== null
