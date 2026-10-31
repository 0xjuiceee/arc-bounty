/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ESCROW_ADDRESS?: string
  readonly VITE_ARC_TESTNET_RPC_URL?: string
  readonly VITE_CIRCLE_APP_ID?: string
  readonly VITE_GOOGLE_CLIENT_ID?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

interface Window {
  ethereum?: import('viem').EIP1193Provider
}
