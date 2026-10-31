import { formatUnitsExact } from '@/onchain-money'
import { USDC_DECIMALS } from '@/onchain-facts'

/** 1234500000n -> "1,234.50". Exact bigint math, at least two fraction digits. */
export function formatUsdcDisplay(raw: bigint): string {
  const [whole, fraction = ''] = formatUnitsExact(raw, USDC_DECIMALS).split('.')
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return `${grouped}.${fraction.padEnd(2, '0')}`
}
