# Arc Bounties

> Built with Arc Studio - money-powered apps in minutes

This is the **project memory** - what Arc Studio remembers about building this app. It helps future agents (or humans) understand and extend the project.

---

## What This App Does

Non-custodial bounty marketplace on Arc Testnet. Sponsors escrow test USDC, workers submit proof, sponsors release, reject or cancel. Optional Google sign-in wallets via Circle user-controlled wallets (server/index.ts).

## Tech Stack

- Frontend: React 18, Vite, TypeScript, Tailwind CSS
- Web3: wagmi v2, viem v2, ConnectKit
- Contracts: Solidity 0.8.28 + Foundry. Sources in `contracts/`, unit tests in `contracts/test/*.t.sol`. Build with `bun run contracts:build` (`forge build`), test with `bun run contracts:test` (`forge test`).
- Wallet: own EIP-6963 injected wallet layer in `src/wallet/` (no wagmi, no ConnectKit, no WalletConnect) plus optional Google wallets (`src/wallet/circle.ts`)
- Chain: Arc Testnet (Chain ID: 5042002, imported from `viem/chains`)
- Token: USDC (6 decimals) (Address: 0x3600000000000000000000000000000000000000, Chain: Arc Testnet)
- Toasts: Sonner

## Key Files

- `src/App.tsx` - Main application logic
- `src/components/` - UI components
- `src/config.ts` - wagmi config (chains, connectors, transports)

## Share links

- Starter apps already ship `getShareBase`, `buildShareLink` and `installShareSync` in `src/lib/share.ts`; import them instead of rewriting them.
- Keep shareable state in the URL path or query, not in the `#fragment`.
- Never put a secret (private key, claim secret, seed phrase, session token, API key) in the URL path or query, encoded or not: every in-app path and query is mirrored to the visitor's studio.arc.io address bar and browser history and reaches servers. A bearer claim secret goes only in the `#fragment` appended to the share link (`` `${await buildShareLink('/claim')}#${secret}` ``) and is read from `location.hash` on load. A link to the app's own share URL shown inside the app must be copy-only or open in a new tab with `target="_blank" rel="noopener noreferrer"`.
- Build every link a user copies or sends with `buildShareLink()` from `src/lib/share.ts`.
- Keep the `installShareSync()` call in `src/main.tsx` when editing it; it keeps the Studio address bar in step with in-app navigation.
- Navigate inside the app with relative links.

## To Run

```bash
bun install
bun run dev
```

## Deployments

- ArcBountiesEscrow (Arc Testnet): `0xda283515f694e53dc744867058777d601f6a2005`, constructor arg = Arc Testnet USDC. Set as `VITE_ESCROW_ADDRESS` in `.env`.
- Contract ABI for the app: `src/lib/escrowAbi.ts` (regenerate from `contracts/out` after any contract change).
- Contract added beyond the spec: sponsor `rejectProof`, and `cancel` also works in Review, so a junk proof cannot lock funds.
- Deploy your own copy: `bun run compile:contracts`, then `bun run deploy:testnet` with `ARC_DEPLOYER_PRIVATE_KEY` in `.env`.
