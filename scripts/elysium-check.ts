// Read-only sanity check for Elysium testnet: chain id, head block, gas price,
// canonical tokens, Multicall3, and whether HyperEVM-only precompiles exist (they should not).
// Run: npx tsx elysium-check.ts
import { createPublicClient, formatUnits, http, parseAbi } from 'viem'
import { kinetiqElysiumTestnet } from './chains'

const CANONICAL = {
  WHYPE: '0xCD57F65c2B0e5881CFC2E609F7CD53b746E1F234',
  USDC: '0x7D29d8047B905000459c0E80c34a26CeedcB47b2',
} as const // https://elysium.kinetiq.xyz/docs/contract-addresses
const erc20 = parseAbi(['function symbol() view returns (string)', 'function decimals() view returns (uint8)'])

const client = createPublicClient({ chain: kinetiqElysiumTestnet, transport: http() })

async function main() {
  const chainId = await client.getChainId()
  if (chainId !== 99801) throw new Error(`Expected chain 99801, RPC returned ${chainId}. Wrong RPC?`)
  const [block, gasPrice] = await Promise.all([client.getBlockNumber(), client.getGasPrice()])
  console.log(`chainId 99801 OK, block ${block}, gasPrice ${formatUnits(gasPrice, 9)} gwei`)
  for (const [label, address] of Object.entries(CANONICAL)) {
    const [symbol, decimals] = await Promise.all([
      client.readContract({ address, abi: erc20, functionName: 'symbol' }),
      client.readContract({ address, abi: erc20, functionName: 'decimals' }),
    ])
    console.log(`${label.padEnd(6)} ${address} symbol=${symbol} decimals=${decimals}`)
  }
  const mc = await client.getCode({ address: '0xcA11bde05977b3631167028862bE2a173976CA11' })
  console.log(`Multicall3 deployed: ${!!mc && mc !== '0x'}`)
  for (const a of ['0x0000000000000000000000000000000000000800', '0x3333333333333333333333333333333333333333'] as const) {
    const code = await client.getCode({ address: a })
    console.log(`${a} (HyperEVM-only) has code on Elysium: ${!!code && code !== '0x'}`)
  }
  const gas = await client.estimateGas({ account: CANONICAL.WHYPE, to: '0x000000000000000000000000000000000000dEaD', value: 1n })
  console.log(`plain HYPE transfer estimateGas: ${gas} (above 21000 on Nitro, never hardcode 21000)`)
}
main().catch((e) => { console.error(e.shortMessage ?? e); process.exit(1) })
