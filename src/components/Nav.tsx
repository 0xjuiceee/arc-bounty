import { useEffect, useRef, useState } from 'react'
import { Check, ChevronDown, Copy, Droplets, ExternalLink, LogOut, Wallet } from 'lucide-react'
import { explorerAddress, shortAddress } from '@/lib/arc'
import { formatUsdcDisplay } from '@/lib/format'
import { useWallet } from '@/wallet/types'

export function Logo() {
  return (
    <a href="#top" className="flex items-center gap-2.5" aria-label="Arc Bounties home">
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-lime text-ink">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M3 19 10 5l3.5 6.5L16 8l5 11h-3.2l-1.9-4.6-2.4 3.6-3.4-6.3L6.4 19z" fill="currentColor" />
        </svg>
      </span>
      <span className="font-display text-lg font-bold tracking-tight">
        Arc <span className="text-lime">Bounties</span>
      </span>
    </a>
  )
}

function AccountMenu() {
  const w = useWallet()
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false)
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  if (!w.address) return null
  const address = w.address

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="btn-ghost !px-3.5 font-mono !text-[13px]"
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <span className={`h-2 w-2 rounded-full ${w.onArc ? 'bg-lime' : 'bg-amber-signal'}`} />
        {shortAddress(address)}
        <ChevronDown size={14} />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 z-40 mt-2 w-72 rounded-2xl border border-white/10 bg-ink-800 p-3 shadow-2xl"
        >
          <p className="px-2 pt-1 text-xs uppercase tracking-[0.08em] text-mist-dim">
            {w.kind === 'google' ? 'Google wallet' : 'Browser wallet'}
          </p>
          <p className="px-2 pb-2 pt-1 font-mono text-xs text-mist-muted break-all">{address}</p>
          <div className="mb-2 rounded-xl bg-ink-900 px-3 py-2.5">
            <p className="text-xs text-mist-dim">Test USDC balance</p>
            <p className="font-display text-xl font-semibold tabular-nums">
              {w.usdcBalance === undefined ? '…' : formatUsdcDisplay(w.usdcBalance)}
              <span className="ml-1.5 text-sm text-mist-muted">USDC</span>
            </p>
          </div>
          <button
            role="menuitem"
            className="flex min-h-[44px] w-full items-center gap-2 rounded-xl px-3 text-sm text-lime hover:bg-white/5"
            onClick={() => {
              setOpen(false)
              w.openFaucet()
            }}
          >
            <Droplets size={15} /> Get test USDC
          </button>
          <button
            role="menuitem"
            className="flex min-h-[44px] w-full items-center gap-2 rounded-xl px-3 text-sm text-mist hover:bg-white/5"
            onClick={() => {
              void navigator.clipboard.writeText(address).then(() => {
                setCopied(true)
                setTimeout(() => setCopied(false), 1500)
              })
            }}
          >
            {copied ? <Check size={15} className="text-lime" /> : <Copy size={15} />} {copied ? 'Copied' : 'Copy address'}
          </button>
          <a
            role="menuitem"
            href={explorerAddress(address)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex min-h-[44px] items-center gap-2 rounded-xl px-3 text-sm text-mist hover:bg-white/5"
          >
            <ExternalLink size={15} /> View on explorer
          </a>
          <button
            role="menuitem"
            className="flex min-h-[44px] w-full items-center gap-2 rounded-xl px-3 text-sm text-red-200 hover:bg-red-400/10"
            onClick={() => {
              setOpen(false)
              w.disconnect()
            }}
          >
            <LogOut size={15} /> Disconnect
          </button>
        </div>
      )}
    </div>
  )
}

export function Nav() {
  const w = useWallet()
  const links = (
    <>
      <a href="#explore" className="rounded-lg px-3 py-2 text-sm text-mist-muted transition hover:text-mist">
        Explore
      </a>
      <a href="#how" className="rounded-lg px-3 py-2 text-sm text-mist-muted transition hover:text-mist">
        How it works
      </a>
    </>
  )

  return (
    <header className="sticky top-0 z-30 border-b border-white/[0.06] bg-ink/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <div className="flex items-center gap-6">
          <Logo />
          <nav className="hidden items-center gap-1 sm:flex" aria-label="Primary">
            {links}
          </nav>
        </div>
        <div className="flex items-center gap-2">
          <button className="btn-ghost !px-3.5" onClick={w.openFaucet} aria-label="Get test USDC">
            <Droplets size={16} className="text-lime" />
            <span className="hidden sm:inline">Faucet</span>
          </button>
          {w.address ? (
            <AccountMenu />
          ) : (
            <button className="btn-primary" onClick={w.openConnect} disabled={w.connecting}>
              <Wallet size={16} /> {w.connecting ? 'Connecting…' : 'Connect Wallet'}
            </button>
          )}
        </div>
      </div>
      <nav className="flex items-center gap-1 border-t border-white/[0.04] px-3 sm:hidden" aria-label="Primary mobile">
        {links}
      </nav>
    </header>
  )
}
