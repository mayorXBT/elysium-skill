# Elysium builder guide

Elysium is Kinetiq's L2 for the Hyperliquid ecosystem: an Arbitrum Orbit (Nitro/ArbOS) chain run by Conduit that settles to HyperEVM and uses HYPE as gas. Testnet is live (chain 99801). Mainnet is announced for 9 Nov 2026; its chain ID, RPC and addresses are not published yet.

Sources:
- E1 = https://elysium.kinetiq.xyz/docs/what-is-elysium
- E2 = https://elysium.kinetiq.xyz/docs/connecting-to-elysium
- E3 = https://elysium.kinetiq.xyz/docs/building-on-elysium (updated 20 Oct 2026)
- E4 = https://elysium.kinetiq.xyz/docs/token-bridging-on-elysium
- E5 = https://elysium.kinetiq.xyz/docs/hypercore-market-data
- E6 = https://elysium.kinetiq.xyz/docs/contract-addresses (updated 20 Oct 2026)
- E7 = https://testnet.elysium.kinetiq.xyz/verify-contract (official verify page with agent prompt)
- E8 = https://docs.chainstack.com/docs/elysium-tooling (third party, consistent with E2/E6)
- E9 = Kinetiq blog and @Enter_Elysium posts, 20 to 23 Oct 2026 (mainnet date, TheHUB Tokyo node)
- Live checks against https://testnet-rpc.elysium.kinetiq.xyz on 2026-10-24 (`scripts/elysium-check.ts`).

## Contents
1. Chain facts
2. Project scaffolding (Foundry, Hardhat 3, Next.js + wagmi)
3. Deploy and verify
4. Behaviors that break ported code
5. Bridging (canonical and mirror)
6. HyperCore access roadmap (precompile and ElysiumCoreWriter)
7. What Kinetiq wants built
8. Builder program and ecosystem listing
9. Infrastructure partners
10. Mainnet day checklist

## 1. Chain facts

| Item | Value | Source |
| --- | --- | --- |
| Stack | Arbitrum Orbit (stock ArbOS), sequencer by Conduit | E1, E3 |
| Settlement / parent chain | HyperEVM (testnet: 998) | E1, E8 |
| Gas token | HYPE, bridged 1:1 from HyperEVM, 18 decimals | E1, E2 |
| Block time | 100 to 200 ms, tuned toward 100 ms | E1, E8 |
| Throughput target | 300 Mgas/s | E1 |
| Data availability | AnyTrust DAC with fallback to posting full data on HyperEVM | E1 |
| Ordering | Single sequencer, priority-fee ordering, no public mempool | E1, E8 |
| Withdrawals to HyperEVM | Optimistic, with a challenge period (length not published) | E1, E4 |
| Testnet chain ID | 99801 (0x185d9) | E2; RPC returns it |
| Testnet gas price | about 0.1 gwei observed | live |
| Testnet RPC | https://testnet-rpc.elysium.kinetiq.xyz (public). Alchemy: https://elysium-testnet.g.alchemy.com/v2/{KEY} | E2 |
| Explorer | https://elysium.kinetiq.xyz/testnet-explorer (Blockscout) | E2, E7 |
| Faucet / Bridge UI | https://elysium.kinetiq.xyz/testnet-faucet, https://elysium.kinetiq.xyz/testnet-bridge | E2 |

## 2. Project scaffolding

Default stack: Foundry for contracts, Next.js + wagmi + viem for the app. Hardhat 3 is the alternative.

### viem chain (never import `elysiumTestnet` from viem; it is chain 1338, a different network)

Use `scripts/chains.ts` or:

```ts
import { defineChain } from 'viem'
export const kinetiqElysiumTestnet = defineChain({
  id: 99801,
  name: 'Elysium Testnet',
  testnet: true,
  nativeCurrency: { name: 'HYPE', symbol: 'HYPE', decimals: 18 },
  rpcUrls: { default: { http: [process.env.NEXT_PUBLIC_ELYSIUM_RPC_URL ?? 'https://testnet-rpc.elysium.kinetiq.xyz'] } },
  blockExplorers: { default: { name: 'Elysium Explorer', url: 'https://elysium.kinetiq.xyz/testnet-explorer' } },
  contracts: { multicall3: { address: '0xcA11bde05977b3631167028862bE2a173976CA11' } },
})
```

### wagmi config (Next.js)

```ts
import { createConfig, http } from 'wagmi'
import { hyperEvm } from 'viem/chains'
import { injected } from 'wagmi/connectors'
import { kinetiqElysiumTestnet } from './chains'

export const config = createConfig({
  chains: [kinetiqElysiumTestnet, hyperEvm],
  connectors: [injected()],
  transports: {
    [kinetiqElysiumTestnet.id]: http(process.env.NEXT_PUBLIC_ELYSIUM_RPC_URL),
    [hyperEvm.id]: http(process.env.NEXT_PUBLIC_HYPEREVM_RPC_URL),
  },
  ssr: true,
})
```

Wallet add-network: `wallet_addEthereumChain` with `chainId: '0x185d9'`. The Kinetiq explorer serves transactions at `/transaction/`, not `/tx/`. For wallets that build `/tx/` links, E8 suggests the Conduit explorer https://explorer-elysium-testnet.t.conduit.xyz (verify before use).

### Foundry

```bash
forge init my-elysium-app && cd my-elysium-app
```

`foundry.toml`:

```toml
[profile.default]
src = "src"
out = "out"
libs = ["lib"]
solc_version = "0.8.28"
optimizer = true
optimizer_runs = 200

[rpc_endpoints]
elysium_testnet = "${ELYSIUM_RPC_URL}"
hyperevm = "https://rpc.hyperliquid.xyz/evm"
hyperevm_testnet = "https://rpc.hyperliquid-testnet.xyz/evm"
```

EVM version: Elysium follows the deployed ArbOS version (E3). If `cast` or a deploy fails on an opcode, set `evm_version` to one ArbOS supports (for example `cancun`) and confirm on testnet. The exact ArbOS version is not published; verify before use.

### Hardhat 3 (from E8, matches E7)

```ts
networks: { elysiumTestnet: { type: 'http', url: configVariable('ELYSIUM_RPC_URL'), accounts: [configVariable('ELYSIUM_PRIVATE_KEY')] } },
chainDescriptors: { 99801: { name: 'Elysium Testnet', blockExplorers: { blockscout: {
  name: 'Elysium Testnet Explorer', url: 'https://testnet.elysium.kinetiq.xyz', apiUrl: 'https://testnet.elysium.kinetiq.xyz/api/verify' } } } },
```

`configVariable` reads env vars or the Hardhat keystore so keys stay out of the repo.

## 3. Deploy and verify

Keys: use `cast wallet import deployer --interactive` (encrypted keystore) or a hardware wallet. Never paste a private key into chat or commit it. Get testnet HYPE from the faucet.

```bash
cast chain-id --rpc-url $ELYSIUM_RPC_URL          # must print 99801
forge script script/Deploy.s.sol --rpc-url $ELYSIUM_RPC_URL --account deployer --broadcast
forge verify-contract <ADDRESS> src/MyContract.sol:MyContract \
  --chain 99801 --verifier blockscout \
  --verifier-url https://testnet.elysium.kinetiq.xyz/api/verify \
  --skip-is-verified-check --watch
```

Notes from E7:
- No API key needed. The endpoint accepts verification only (no `getabi`/`getsourcecode`).
- Reuse the exact compiler version, optimizer runs, EVM version, via-IR and constructor args from the deploy.
- A partial match is not full verification.
- Check result at `https://testnet.elysium.kinetiq.xyz/address/<ADDRESS>?tab=contract`.
- E8 gives `https://elysium.kinetiq.xyz/api/` as the verifier URL and notes the printed link omits `/testnet-explorer`.

E7 also publishes an "agent prompt" for verification; this skill follows it.

## 4. Behaviors that break ported code

| Behavior | Effect | Fix | Source |
| --- | --- | --- | --- |
| HyperEVM precompiles (0x...0800 and up) and CoreWriter (0x3333...3333) do not exist | Calls succeed with empty return data, then your ABI decode reverts | Feature-flag HyperCore reads per chain. Until the Elysium precompile ships, read HyperCore off-chain (Hyperliquid API) or on HyperEVM | E8; live `eth_getCode` = 0x |
| Gas for a plain HYPE transfer is about 21,170, not 21,000 | Hardcoded `gas: 21000` fails with "intrinsic gas too low" | Let the library estimate. Nitro adds parent-chain data cost (`gasUsedForL1`) | E8; live `eth_estimateGas` = 21170 |
| No public mempool | `newPendingTransactions` subscriptions return an ID but deliver nothing | Watch blocks/receipts. MEV and sandwich bots cannot read pending txs; ordering is by priority fee | E1, E8 |
| 100 to 200 ms blocks | Block-count windows are short (10,000 blocks is about 17 to 33 min); `eth_getProof` only serves recent state | Use timestamps not block counts for time logic; paginate `eth_getLogs` | E8 |
| Solidity `block.number` returns the HyperEVM (parent) block number, not the Elysium block number from `eth_blockNumber` | Block-based timing and IDs are off by orders of magnitude | Use `block.timestamp`, or `ArbSys(0x64).arbBlockNumber()` for the Elysium block | Live 2026-10-24: in-EVM NUMBER = 67,785,463 (HyperEVM testnet head 67,785,469) vs Elysium head 15,123,006 |
| Single sequencer | Liveness depends on it; forced inclusion goes through the HyperEVM inbox | Design for sequencer downtime in liquidations and oracles | E1 |
| Look-alike WHYPE/USDC tokens | Wrong token in pools | Pin canonical addresses from `contracts.md` | E3, E6 |

## 5. Bridging

### Canonical bridge (HyperEVM <-> Elysium), stock Nitro token bridge (E4)

Requirements: standard ERC-20. No fee-on-transfer or rebasing tokens.

Deposit from HyperEVM testnet (L1 Gateway router 0x1aAE2caD8B0249905492087EF230FcCEa3707C45):

```solidity
// 1. approve the GATEWAY, not the router
address gateway = IGatewayRouter(L1_ROUTER).getGateway(token);
IERC20(token).approve(gateway, amount);
// 2. outboundTransfer with retryable ticket params
uint256 maxGas = 300_000;
uint256 gasPriceBid = 0.1 gwei;
uint256 maxSubmissionCost = 4e14; // example from E4; quote it for production
bytes memory data = abi.encode(maxSubmissionCost, bytes(""));
IGatewayRouter(L1_ROUTER).outboundTransfer{value: maxSubmissionCost + maxGas * gasPriceBid}(
  token, recipient, amount, maxGas, gasPriceBid, data);
// L2 address of the token:
address l2Token = IGatewayRouter(L1_ROUTER).calculateL2TokenAddress(token);
```

Withdraw from Elysium (L2 Gateway router 0x89659883a9d980925733B0A698F117AAb65ac718):

```solidity
// token = the ORIGINAL HyperEVM address, data must be empty
IGatewayRouter(L2_ROUTER).outboundTransfer(hyperEvmToken, recipient, amount, 0, 0, "");
// non-empty data reverts with EXTRA_DATA_DISABLED
```

Then wait for the challenge period and execute on the HyperEVM Outbox (0x87391D602aaffB3Fe8051EcCDb75d6EEe8C31060 on testnet). Retryable tickets that fail to auto-redeem can expire after several days: redeem them through `ArbRetryableTx` (0x...006E) or the bridge UI before they lapse.

### Mirror bridge (Elysium-native token -> HyperEVM) (E4, E6)

For tokens launched on Elysium that need a HyperEVM representation:
- Elysium: `ElysiumBridgeFactory.createL2Wallet(token)` (0xb94A38a4aC46970559E89E566f2486a3Fc56BE5a).
- HyperEVM: `ElysiumMirrorFactory.createAndRegisterL1Mirror(elysiumToken, name, symbol, decimals, RegistrationParams)` (0xcaDb9986F3727177d48FA07294E1730f9D19290b); `expectedL1Mirror(token)` predicts the address.
- The token must implement IERC20Metadata with immutable name, symbol and decimals.
- Read E4 for the `RegistrationParams` struct before coding it. It is not reproduced here because it was not fully verified.

## 6. HyperCore access roadmap (E3, E5)

Arrives with an ArbOS upgrade about 4 weeks after mainnet (E3). Addresses and ABIs are not published yet.

- **HyperCore market-data precompile**: order books to full depth, oracle, mark and spot prices, balances, positions and aggregates. Each response is stamped with the HyperCore block and timestamp and fails visibly when stale. Data is attested by the sequencer.
- **`ElysiumCoreWriter` predeploy**: a keeper lane for trading on HyperCore from Elysium. Uses a trade-only agent, intents, optional callbacks paid from a HYPE gas escrow, idempotent per intent nonce.
- Kinetiq runs Hyperliquid node infra at TheHUB in Tokyo to feed HyperCore and HyperEVM state to Elysium; builders can colocate servers there (E9).

Build now so you can switch later: put HyperCore reads behind an interface (`IMarketData`) with an off-chain or HyperEVM implementation today and an Elysium-precompile implementation after the upgrade. Check staleness on every read.

## 7. What Kinetiq wants built (E1, E3, E9)

- Spot trading venues and on-chain order books that need fast blocks.
- PropAMMs: market-maker-quoted AMMs that update quotes 5 to 10 times a second cheaply.
- Token launch and lifecycle flows: launch on an Elysium AMM, graduate to a PropAMM, then HyperCore spot, then a HIP-3 perp.
- HFT market making and keepers that will use the precompile and `ElysiumCoreWriter`.
- Tooling: wallets, explorers, analytics, name services, data APIs.

## 8. Builder program and ecosystem listing

- Sequencer revenue split (E1): 25% to builders, 25% to the Kinetiq treasury, 50% to KNTQ buy-and-burn (Kinetiq says the burned KNTQ goes to the Hyperliquid Assistance Fund). The exact attribution formula for the builder 25% (by gas used, by contract, by application) is not published. Verify before promising numbers to users.
- Ecosystem listing: https://testnet.elysium.kinetiq.xyz/ecosystem/submit. The deployer wallet links your contracts to the listing, so deploy from the wallet you will submit with.
- Security: Cantina's Apex is offered to Elysium builders (E3 partner list). Serialized offers contract audits and on-chain data on testnet, ready for mainnet (E9).
- Contact: Discord https://discord.kinetiq.xyz, X @Enter_Elysium.
- Community grants such as Ascend's builder program are run by third parties, not Kinetiq. Check terms with them.

## 9. Infrastructure partners (E3)

Alchemy (recommended RPC, mainnet day one), QuickNode, Chainstack, Conduit (sequencer), KyberSwap (aggregator), Enso (routing, router contracts on testnet), Elysium Name Service (.ely), Serialized (data and token security API), Hypedexer (indexing, listed in E2). Use each provider's own docs for endpoints.

## 10. Mainnet day checklist (9 Nov 2026 announced)

- [ ] Take chain ID, RPC, explorer, WHYPE, USDC and bridge addresses only from https://elysium.kinetiq.xyz/docs/contract-addresses after launch. Kinetiq warned on 23 Oct 2026 about unofficial tooling and scams before mainnet (E9).
- [ ] Add a second `defineChain` for mainnet; keep testnet config separate. Never default a deploy script to mainnet.
- [ ] Re-run `scripts/elysium-check.ts` with the mainnet chain to confirm chain ID and canonical tokens.
- [ ] Re-verify every contract on the mainnet explorer.
- [ ] Submit or update the ecosystem listing from the deployer wallet.
