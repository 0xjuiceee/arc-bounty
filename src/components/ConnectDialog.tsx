import { ExternalLink, Loader2, Wallet } from 'lucide-react'
import { useWallet } from '@/wallet/types'
import { Modal } from './Modal'

const INSTALL_LINKS = [
  { name: 'MetaMask', href: 'https://metamask.io/download/' },
  { name: 'Rabby', href: 'https://rabby.io/' },
  { name: 'Coinbase Wallet', href: 'https://www.coinbase.com/wallet/downloads' },
]

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.2 5.5-4.7 7.2l7.5 5.8c4.4-4 7-10 7-17.5z" />
      <path fill="#FBBC05" d="M10.5 28.7A14.5 14.5 0 0 1 9.5 24c0-1.6.3-3.2.9-4.7l-7.9-6.1A24 24 0 0 0 0 24c0 3.9.9 7.5 2.6 10.8l7.9-6.1z" />
      <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.5-5.8c-2.1 1.4-4.9 2.3-8.4 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z" />
    </svg>
  )
}

export function ConnectDialog() {
  const w = useWallet()

  return (
    <Modal
      open={w.connectOpen}
      onClose={w.closeConnect}
      title="Connect to Arc Bounties"
      subtitle="You stay in control of your keys. Arc Bounties never holds your funds."
    >
      <div className="space-y-3">
        {w.googleEnabled ? (
          <button className="btn-ghost w-full justify-start gap-3 !py-3" onClick={() => void w.connectGoogle()} disabled={w.connecting}>
            <GoogleMark />
            <span className="flex-1 text-left">Continue with Google</span>
            {w.connecting && <Loader2 size={16} className="animate-spin" />}
          </button>
        ) : (
          <div className="rounded-xl border border-dashed border-white/10 p-3 text-sm text-mist-muted">
            <p className="font-semibold text-mist">Google sign-in is not enabled on this deployment</p>
            <p className="mt-1">
              It needs a Circle App ID and a Google OAuth client ID. See the README, section "Google sign-in wallets".
            </p>
          </div>
        )}

        <div className="flex items-center gap-3 py-1 text-xs uppercase tracking-[0.1em] text-mist-dim">
          <span className="h-px flex-1 bg-white/10" /> or use a browser wallet <span className="h-px flex-1 bg-white/10" />
        </div>

        {w.wallets.length > 0 ? (
          w.wallets.map((wallet) => (
            <button
              key={wallet.id}
              className="btn-ghost w-full justify-start gap-3 !py-3"
              disabled={w.connecting}
              onClick={() => void w.connectInjected(wallet)}
            >
              {wallet.icon ? (
                <img src={wallet.icon} alt="" width={22} height={22} className="rounded-md" />
              ) : (
                <Wallet size={20} />
              )}
              <span className="flex-1 text-left">{wallet.name}</span>
            </button>
          ))
        ) : (
          <div className="rounded-xl border border-white/10 bg-ink-900 p-4 text-sm text-mist-muted">
            <p className="font-semibold text-mist">No browser wallet detected</p>
            <p className="mt-1">Install one of these, create an account, then reload this page:</p>
            <ul className="mt-3 space-y-1.5">
              {INSTALL_LINKS.map((l) => (
                <li key={l.name}>
                  <a
                    href={l.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-lime hover:underline"
                  >
                    {l.name} <ExternalLink size={13} />
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}

        {w.connectError && (
          <p role="alert" className="rounded-xl bg-red-400/10 px-3 py-2 text-sm text-red-200">
            {w.connectError}
          </p>
        )}
        <p className="pt-1 text-xs text-mist-dim">
          Arc Testnet will be added to your wallet automatically (chain ID 5042002). Test USDC has no real value.
        </p>
      </div>
    </Modal>
  )
}
