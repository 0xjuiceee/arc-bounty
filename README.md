# Arc Bounties

A non-custodial marketplace for useful work on Arc Testnet. Sponsors lock test USDC in an escrow smart contract, workers submit proof of completed work, and the sponsor releases the USDC straight to the worker's wallet. There is no platform wallet, no user accounts, and no server that holds keys.

Built with [Arc Studio](https://studio.arc.io)

> **Testnet only.** Test USDC has no value. The escrow contract is **unaudited**. Do not use it with real funds.

## What you can do

- **Sponsors** post a bounty (title, description, category, USDC reward). The reward is locked in the escrow contract.
- **Workers** browse open bounties and submit a proof link (an https URL or an IPFS URI) with an optional note.
- **Sponsors** review the proof, then release the USDC to the worker, reject the proof to reopen the bounty, or cancel the bounty to get the USDC back.
- Everyone can see live escrow totals and every bounty, read directly from the contract on Arc Testnet.

Details like the title, description, and proof are stored in the contract as data URIs for this testnet MVP. There is no database.

## Arc Testnet configuration

| Setting | Value |
| --- | --- |
| Network name | Arc Testnet |
| Chain ID | 5042002 |
| RPC | https://rpc.testnet.arc.io |
| Explorer | https://explorer.testnet.arc.io |
| Gas token | USDC |
| Test USDC (ERC-20) | `0x3600000000000000000000000000000000000000` (6 decimals) |

On Arc, USDC is both the gas token and the ERC-20 balance shown in the app. It is one pool of funds. Keep a little more USDC than the reward so you can pay gas.

The app adds and switches to Arc Testnet for you in MetaMask, Rabby, Coinbase Wallet, and other compatible browser wallets.

## Wallets and test USDC

1. Install a browser wallet such as [MetaMask](https://metamask.io/download/), [Rabby](https://rabby.io/), or [Coinbase Wallet](https://www.coinbase.com/wallet/downloads), or use Google sign-in if the deployment enables it (see below).
2. Click **Connect Wallet**. Approve the connection and the network switch.
3. Get test USDC from the [Circle faucet](https://faucet.circle.com) (choose Arc Testnet). Inside Arc Studio, use the **Get test USDC** button in the sidebar.

## Local development

Prerequisites: [Bun](https://bun.sh) and [Foundry](https://book.getfoundry.sh/getting-started/installation).

```bash
bun install
cp .env.example .env     # then fill in values
bun run dev              # http://localhost:5173
```

Other scripts:

| Script | What it does |
| --- | --- |
| `bun run dev` | Start the app in development |
| `bun run build` | Production build into `dist/` |
| `bun run compile:contracts` | Compile the Solidity contract (Solidity 0.8.28, optimizer on) |
| `bun run test:contracts` | Run the contract test suite |
| `bun run deploy:testnet` | Deploy the escrow contract to Arc Testnet from your own wallet |
| `bun run server` | Run the optional Google sign-in server |
| `bun run check` | Lint and typecheck |

## Environment variables

| Variable | Where | Purpose |
| --- | --- | --- |
| `VITE_ARC_TESTNET_RPC_URL` | Browser | Arc Testnet RPC. Optional, defaults to the public endpoint. |
| `VITE_ESCROW_ADDRESS` | Browser | Address of the deployed escrow contract. Public, safe to set on Vercel. |
| `ARC_DEPLOYER_PRIVATE_KEY` | Your machine only | Testnet-only key used by `deploy:testnet`. Never add it to Vercel. |
| `VITE_CIRCLE_APP_ID` | Browser | Optional. Circle App ID for Google sign-in wallets. |
| `VITE_GOOGLE_CLIENT_ID` | Browser | Optional. Google OAuth client ID for Google sign-in wallets. |
| `CIRCLE_API_KEY` | Server only | Optional. Circle API key for the Google sign-in server. |
| `SERVER_PORT` | Server only | Optional. Port for the Google sign-in server. Defaults to 3001. |

Only variables starting with `VITE_` reach the browser, and they must be public values. A private key never takes the `VITE_` prefix.

## Deploy the contract

You deploy from a **testnet-only wallet that you control**. Create a fresh wallet that holds nothing else, fund it with test USDC (needed for gas), then:

```bash
bun run compile:contracts
# add ARC_DEPLOYER_PRIVATE_KEY=0x... to your local .env
bun run deploy:testnet
```

The script prints the contract address, an explorer link, and the exact line to copy:

```
VITE_ESCROW_ADDRESS=0x...
```

Actual deployment needs your own deployer private key and test USDC. Arc Bounties cannot deploy for you from a shared wallet, and nobody else ever holds your key.

## Set the escrow address

Put the printed line in `.env` for local use, then restart `bun run dev`. For a hosted site, add the same `VITE_ESCROW_ADDRESS` variable in your host's environment settings and redeploy, because Vite bakes it in at build time. Until it is set, the app shows a clear "not configured" state instead of fake data.

## Deploy to Vercel

1. Push this project to GitHub (next section).
2. In [Vercel](https://vercel.com/new), import the repository. The framework is detected as Vite; the build command is `bun run build` (or `npm run build`) and the output directory is `dist`.
3. Under **Environment Variables**, add `VITE_ESCROW_ADDRESS` (and optionally `VITE_ARC_TESTNET_RPC_URL`).
4. **Do not add `ARC_DEPLOYER_PRIVATE_KEY` to Vercel.** Deployment of the contract happens locally.
5. Deploy. After changing a variable, redeploy so it is rebuilt in.

## Deploy with GitHub

```bash
git init
git add .
git commit -m "Arc Bounties"
git branch -M main
git remote add origin https://github.com/<you>/arc-bounties.git
git push -u origin main
```

`.gitignore` already excludes `.env`, build output, and compiler artifacts. Check `git status` before pushing to be sure no key is staged.

## Google sign-in wallets (optional)

Users can sign in with a Google account and get a non-custodial wallet. Keys are held by Circle's MPC infrastructure for that user, every transaction is approved by the user, and Arc Bounties never has a key. It is off unless you configure it:

1. In the Circle Developer Console, create an API key and a user-controlled wallets App ID. Add your Google OAuth client ID under Social Logins.
2. In Google Cloud, create an OAuth client and authorize your site's origin as a redirect URI (for example `http://localhost:5173` and your production URL).
3. Set `VITE_CIRCLE_APP_ID` and `VITE_GOOGLE_CLIENT_ID` for the browser, and `CIRCLE_API_KEY` for the server.
4. Run `bun run server` next to `bun run dev`. The dev server proxies `/api` to it.
5. On Vercel, import the GitHub repository so Vercel builds it. The login routes run as a Vercel function from the `api/` folder, so no separate server is needed. Add `CIRCLE_API_KEY` (Secret) and the three `VITE_` variables (Config) in the project's Environment Variables, then redeploy. Uploading only the built `dist` folder does not run the function or read your variables.

A Google wallet is a regular address on Arc Testnet. Fund it with test USDC (it needs some for gas) from the wallet menu's copied address. If a user loses access to their Google account, nobody can recover the wallet for them.

## Security assumptions

- The escrow contract has no owner, no admin withdrawal, no upgrade path, and no privileged transfer. Funds can only go to the assigned worker (sponsor release) or back to the sponsor (cancel).
- The sponsor alone decides whether to pay. There is no dispute process and no timeout, so workers trust the sponsor to review fairly. A sponsor can cancel an unpaid bounty even after proof is submitted.
- A submitted proof reserves the bounty for review. If a proof is junk, the sponsor can reject it to reopen the bounty or cancel it for a refund, so funds cannot get stuck.
- Bounty text and proof links are written by strangers and shown as plain text. Open links with care.
- USDC is the only token. The contract rejects tokens that charge transfer fees.
- No private key or API secret is used in the browser. The optional server holds only a Circle API key and only allows calls to the escrow and USDC contracts.

## Warning

This is a **testnet-only** project. Test USDC has no value. The contract has passed automated tests and an automated review but is **not independently audited**. Do not deploy it to mainnet or use real funds without your own professional audit and review.
