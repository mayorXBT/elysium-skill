// Chain definitions for Kinetiq builders. Values from official sources:
//   HyperEVM mainnet/testnet: viem/chains (hyperEvm id 999, hyperliquidEvmTestnet id 998)
//   Elysium testnet: https://elysium.kinetiq.xyz/docs/connecting-to-elysium
//                    https://elysium.kinetiq.xyz/docs/contract-addresses
// WARNING: do NOT import `elysiumTestnet` from viem/chains. That export is Vulcan Forged's
// Elysium (chain id 1338, LAVA gas), a different chain.
import { defineChain } from 'viem'
export { hyperEvm, hyperliquidEvmTestnet } from 'viem/chains'

export const kinetiqElysiumTestnet = defineChain({
  id: 99801,
  name: 'Elysium Testnet',
  testnet: true,
  nativeCurrency: { name: 'HYPE', symbol: 'HYPE', decimals: 18 },
  rpcUrls: {
    // Public RPC is shared and rate limited. Set ELYSIUM_RPC_URL to an Alchemy/QuickNode/Chainstack URL for real traffic.
    default: { http: [process.env.ELYSIUM_RPC_URL ?? 'https://testnet-rpc.elysium.kinetiq.xyz'] },
  },
  blockExplorers: {
    default: { name: 'Elysium testnet explorer', url: 'https://elysium.kinetiq.xyz/testnet-explorer' },
  },
  contracts: {
    multicall3: { address: '0xcA11bde05977b3631167028862bE2a173976CA11' },
  },
})
