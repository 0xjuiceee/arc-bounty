import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { BountyDetail } from '@/components/BountyDetail'
import { ConnectDialog } from '@/components/ConnectDialog'
import { Footer } from '@/components/Footer'
import { Hero } from '@/components/Hero'
import { HowItWorks } from '@/components/HowItWorks'
import { Marketplace } from '@/components/Marketplace'
import { Nav } from '@/components/Nav'
import { PostBountyDialog } from '@/components/PostBountyDialog'
import { useBounties } from '@/hooks/useBounties'
import { WalletProvider } from '@/wallet/WalletProvider'
import { useWallet } from '@/wallet/types'

function NetworkBanner() {
  const w = useWallet()
  if (!w.address || w.onArc) return null
  return (
    <div role="alert" className="border-b border-amber-signal/30 bg-amber-signal/10">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-2.5 text-sm text-amber-signal sm:px-6">
        <AlertTriangle size={16} />
        <p className="flex-1">Wrong network. Arc Bounties runs on Arc Testnet (chain ID 5042002).</p>
        <button className="btn-ghost !min-h-[36px] !px-3 !text-amber-signal" onClick={() => void w.switchToArc()}>
          Switch network
        </button>
      </div>
    </div>
  )
}

function readBountyParam(): number | null {
  const raw = new URLSearchParams(window.location.search).get('bounty')
  return raw !== null && /^\d{1,9}$/.test(raw) ? Number(raw) : null
}

function Shell() {
  const bounties = useBounties()
  const [selectedId, setSelectedId] = useState<number | null>(readBountyParam)
  const [postOpen, setPostOpen] = useState(false)

  const select = useCallback((id: number | null) => {
    setSelectedId(id)
    const url = new URL(window.location.href)
    if (id === null) url.searchParams.delete('bounty')
    else url.searchParams.set('bounty', String(id))
    window.history.replaceState(null, '', url)
  }, [])

  useEffect(() => {
    const onPop = () => setSelectedId(readBountyParam())
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  const selected = useMemo(
    () => bounties.data?.bounties.find((b) => b.id === selectedId) ?? null,
    [bounties.data, selectedId],
  )

  return (
    <div className="min-h-dvh">
      <Nav />
      <NetworkBanner />
      <main>
        <Hero
          snapshot={bounties.data}
          loading={bounties.isLoading}
          failed={bounties.isError}
          onPost={() => setPostOpen(true)}
        />
        <Marketplace
          snapshot={bounties.data}
          loading={bounties.isLoading}
          error={bounties.isError}
          fetching={bounties.isFetching}
          onRetry={() => void bounties.refetch()}
          onOpen={select}
          onPost={() => setPostOpen(true)}
        />
        <HowItWorks />
      </main>
      <Footer />
      <ConnectDialog />
      <PostBountyDialog open={postOpen} onClose={() => setPostOpen(false)} />
      <BountyDetail bounty={selected} onClose={() => select(null)} />
    </div>
  )
}

export default function App() {
  return (
    <WalletProvider>
      <Shell />
    </WalletProvider>
  )
}
