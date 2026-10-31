import { createPublicClient, defineChain, http, isAddress, type AddEthereumChainParameter, type Address } from 'viem'
import { registerChain } from '@/tracing'
import { buildAddressExplorerUrl, buildTxExplorerUrl, getUsdc, requireChain } from '@/onchain-facts'

export const ARC_CHAIN_ID = 5042002

const chainFact = requireChain(ARC_CHAIN_ID)
const usdcFact = getUsdc(ARC_CHAIN_ID)
if (!usdcFact) throw new Error('USDC is not registered for Arc Testnet')

export const USDC_ADDRESS = usdcFact.address as Address

/** Optional override. Falls back to the public Arc Testnet RPC from the onchain registry. */
export const RPC_URL: string = import.meta.env.VITE_ARC_TESTNET_RPC_URL || chainFact.rpcUrls[0]

export const arcTestnet = defineChain({
  id: ARC_CHAIN_ID,
  name: chainFact.name,
  // Arc's native gas asset is USDC (18-decimal native view; the ERC-20 view uses 6).
  nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: chainFact.nativeCurrency.decimals },
  rpcUrls: { default: { http: [RPC_URL] } },
  blockExplorers: { default: { name: 'Arc Explorer', url: chainFact.explorerBase } },
  testnet: true,
})

// Name Arc Testnet RPC calls in the Tracing panel.
registerChain(ARC_CHAIN_ID, RPC_URL)

export const publicClient = createPublicClient({
  chain: arcTestnet,
  transport: http(RPC_URL),
})

const rawEscrow = (import.meta.env.VITE_ESCROW_ADDRESS ?? '').trim()

/** Deployed ArcBountiesEscrow address, or undefined when the app is not configured yet. */
export const ESCROW_ADDRESS: Address | undefined = isAddress(rawEscrow) ? (rawEscrow) : undefined

export const explorerTx = (hash: string) => buildTxExplorerUrl(ARC_CHAIN_ID, hash)
export const explorerAddress = (address: string) => buildAddressExplorerUrl(ARC_CHAIN_ID, address)

/** EIP-3085 parameters used by wallet_addEthereumChain. */
export const ADD_CHAIN_PARAMS: AddEthereumChainParameter = {
  chainId: `0x${ARC_CHAIN_ID.toString(16)}`,
  chainName: chainFact.name,
  nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: chainFact.nativeCurrency.decimals },
  rpcUrls: [RPC_URL],
  blockExplorerUrls: [chainFact.explorerBase],
}

export const shortAddress = (address: string) => `${address.slice(0, 6)}…${address.slice(-4)}`
