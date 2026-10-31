import { BadgeCheck, FileCheck2, Lock, Wallet } from 'lucide-react'

const STEPS = [
  { icon: Wallet, title: 'Connect', body: 'Use a browser wallet or sign in with Google. Arc Testnet is added for you.' },
  { icon: Lock, title: 'Sponsor locks USDC', body: 'A sponsor posts a bounty and the reward moves into the escrow contract, not to us.' },
  { icon: FileCheck2, title: 'Worker submits proof', body: 'Anyone but the sponsor can submit a link to completed work. The bounty moves to review.' },
  { icon: BadgeCheck, title: 'Sponsor releases', body: 'The sponsor approves and the USDC goes directly to the worker. Or reject, or cancel for a refund.' },
]

export function HowItWorks() {
  return (
    <section id="how" className="border-y border-white/[0.06] bg-ink-900/60">
      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <h2 className="font-display text-3xl font-bold tracking-tight">How it works</h2>
        <p className="mt-1.5 max-w-xl text-mist-muted">Four steps, all enforced by a smart contract. There is no admin key and no withdrawal function.</p>
        <ol className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s, i) => (
            <li key={s.title} className="card p-5">
              <div className="flex items-center justify-between">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-lime/10 text-lime"><s.icon size={20} /></span>
                <span className="font-mono text-xs text-mist-dim">0{i + 1}</span>
              </div>
              <h3 className="mt-4 font-display text-lg font-semibold">{s.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-mist-muted text-pretty">{s.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}
