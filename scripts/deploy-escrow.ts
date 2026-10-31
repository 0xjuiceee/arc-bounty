/**
 * Deploys ArcBountiesEscrow to Arc Testnet from YOUR testnet-only wallet.
 *
 *   1. bun run compile:contracts
 *   2. put ARC_DEPLOYER_PRIVATE_KEY in .env (testnet-only key, funded with test USDC for gas)
 *   3. bun run deploy:testnet
 *
 * The key is read from the environment on your machine only. It is never bundled into the
 * browser app and must never be added to Vercel.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createPublicClient, createWalletClient, http, isHex, type Hex } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { arcTestnet, USDC_ADDRESS, explorerAddress, explorerTx, RPC_URL } from '../src/lib/arc'

const rawKey = (process.env.ARC_DEPLOYER_PRIVATE_KEY ?? '').trim()
const key = (rawKey.startsWith('0x') ? rawKey : `0x${rawKey}`)

if (!rawKey || !isHex(key) || key.length !== 66) {
  console.error('ARC_DEPLOYER_PRIVATE_KEY is missing or not a 32-byte hex key. Add it to .env (testnet wallet only).')
  process.exit(1)
}

const artifactPath = resolve(process.cwd(), 'contracts/out/ArcBountiesEscrow.sol/ArcBountiesEscrow.json')
let artifact: { abi: unknown[]; bytecode: { object: Hex } }
try {
  artifact = JSON.parse(readFileSync(artifactPath, 'utf8')) as typeof artifact
} catch {
  console.error('Compiled artifact not found. Run `bun run compile:contracts` first.')
  process.exit(1)
}

const account = privateKeyToAccount(key)
const publicClient = createPublicClient({ chain: arcTestnet, transport: http(RPC_URL) })
const walletClient = createWalletClient({ account, chain: arcTestnet, transport: http(RPC_URL) })

console.log(`Deployer:  ${account.address}`)
console.log(`Network:   ${arcTestnet.name} (chain ${arcTestnet.id})`)
console.log(`USDC:      ${USDC_ADDRESS}`)

const hash = await walletClient.deployContract({
  abi: artifact.abi,
  bytecode: artifact.bytecode.object,
  args: [USDC_ADDRESS],
})
console.log(`Deploy tx: ${explorerTx(hash)}`)

const receipt = await publicClient.waitForTransactionReceipt({ hash })
if (receipt.status !== 'success' || !receipt.contractAddress) {
  console.error('Deployment failed.')
  process.exit(1)
}

console.log('\nArcBountiesEscrow deployed.')
console.log(`Address:   ${receipt.contractAddress}`)
console.log(`Explorer:  ${explorerAddress(receipt.contractAddress)}`)
console.log('\nAdd this line to your environment variables (.env locally, and Vercel):\n')
console.log(`VITE_ESCROW_ADDRESS=${receipt.contractAddress}`)
