---
name: kinetiq
description: Builder guide for the Kinetiq ecosystem on Hyperliquid. Covers Elysium (Kinetiq's Arbitrum Orbit L2 for Hyperliquid, testnet chain 99801, HYPE gas), kHYPE liquid staking integrations on HyperEVM (rate reads, stake and unstake via contracts, kHYPE as collateral), Markets by Kinetiq HIP-3 perps (mkts dex, Hyperliquid info API, Markets trading API) and Kinetiq Launch for deploying a HIP-3 dex. Includes verified contract addresses with sources, viem/wagmi/Foundry/Hardhat config, deploy and verify steps, bridging, known traps, and starter app checklists. Use when the user wants to build on Elysium, Kinetiq, kHYPE, kmHYPE, Kinetiq Markets or markets.xyz, a Hyperliquid L2, or asks about HyperEVM integrations with Kinetiq, the Elysium builder program, or launching a HIP-3 market with Kinetiq.
---

# Kinetiq builder skill

Kinetiq builds liquid staking and exchange infrastructure on Hyperliquid. This skill helps a coding agent ship apps on its four builder surfaces. Facts are dated 2026-10-24 and every address is sourced in [references/contracts.md](references/contracts.md).

## Quick routing

| User wants to... | Surface | Chain | Read |
| --- | --- | --- | --- |
| Deploy contracts or an app on Elysium | Elysium L2 | 99801 testnet (mainnet 9 Nov 2026, details unpublished) | [references/elysium.md](references/elysium.md) |
| Read the kHYPE rate, stake/unstake from an app, accept kHYPE as collateral | kHYPE | HyperEVM 999 | [references/khype-integration.md](references/khype-integration.md) |
| Show or trade Markets perps (stocks, indices, FX, commodities) | Markets by Kinetiq (`mkts` HIP-3 dex) | HyperCore via API | [references/markets-and-launch.md](references/markets-and-launch.md) |
| Launch their own HIP-3 perp dex | Kinetiq Launch | HyperEVM + HyperCore | [references/markets-and-launch.md](references/markets-and-launch.md) |
| Get an idea and a checklist | any | any | [references/starter-ideas.md](references/starter-ideas.md) |
| Look up one address, RPC or chain ID | any | any | [references/contracts.md](references/contracts.md), [llms.txt](llms.txt) |

## Rules for the agent

1. **Addresses come only from `references/contracts.md` or an official Kinetiq page opened this session.** Never invent, guess or "fix" an address. If one is missing (Elysium mainnet, EXFactory, Earn vault), say it is not published and stop.
2. **Confirm before every transaction.** Before any write (stake, approve, bridge, deploy, order), show the user: chain name and ID, contract address, function, amounts in human units, and expected output. Wait for an explicit yes.
3. **Never handle private keys in chat or code.** Use `cast wallet import --interactive`, a hardware wallet, Hardhat `configVariable`, or a browser wallet. If a user pastes a key, tell them to rotate it.
4. **Testnet first, and say which network.** Default every script and config to Elysium testnet (99801) or HyperEVM testnet (998). Mainnet only on explicit request. Label every command and address with its network.
5. **Read live values, do not hardcode parameters.** Fees, limits, delays and market lists change. Read them on-chain or from the API at run time.
6. **Prefer the bundled scripts for reads**: run them, do not paste their logic.
   - `npx tsx scripts/read-khype-rate.ts [address]`: kHYPE rate, limits, fee, a user's pending withdrawals.
   - `npx tsx scripts/elysium-check.ts`: Elysium testnet chain ID, canonical tokens, Multicall3, gas, precompile absence.
   - `npx tsx scripts/markets-snapshot.ts [dex] [coin]`: Kinetiq HIP-3 dexes, live vs delisted markets, top of book.
   Run `npm install` in `scripts/` once. All three are read-only.

## Ecosystem map

- **kHYPE**: non-rebasing LST of HYPE on HyperEVM. Rate from `StakingAccountant.kHYPEToHYPE`. 10% fee on rewards. 5 HYPE minimum. Exit takes about 8 to 9 days (7-day contract delay plus HyperCore lockup).
- **kmHYPE**: LST whose stake backs the Markets HIP-3 dexes. Same ABI as kHYPE. Minting is whitelisted on-chain (`whitelistEnabled() == true`), so apps buy it or read it, they do not mint it.
- **Markets by Kinetiq** (markets.xyz): 24/7 HIP-3 perps on equities, indices, FX, commodities, priced by Kaiko. Live dex is `mkts` (USDC collateral). The older `km` dex (USDH) is fully delisted. Plus a REST trading API at trading-api.markets.xyz.
- **Kinetiq Launch**: Exchange-as-a-Service. A deployer bonds at least 1000 HYPE; depositors stake HYPE into a per-market EXLST that backs the HIP-3 stake requirement. Onboarding through contact@kinetiq.xyz.
- **Elysium**: Arbitrum Orbit L2 settling to HyperEVM, HYPE gas, 100 to 200 ms blocks, sequencer by Conduit, no public mempool. HyperCore market-data precompile and `ElysiumCoreWriter` arrive about 4 weeks after mainnet.
- **KNTQ / sKNTQ**: governance token (HyperCore spot index 124). 50% of Elysium sequencer revenue buys and burns KNTQ.
- **Builder program**: 25% of Elysium sequencer revenue goes to builders. List your app at testnet.elysium.kinetiq.xyz/ecosystem/submit from the deployer wallet.

## Networks at a glance

| Network | Chain ID | Public RPC | Explorer |
| --- | --- | --- | --- |
| HyperEVM mainnet | 999 | https://rpc.hyperliquid.xyz/evm | hyperevmscan.io (verify before use) |
| HyperEVM testnet | 998 | https://rpc.hyperliquid-testnet.xyz/evm | see contracts.md |
| Elysium testnet | 99801 | https://testnet-rpc.elysium.kinetiq.xyz | https://elysium.kinetiq.xyz/testnet-explorer |
| Elysium mainnet | not published | not published | not published |
| Hyperliquid API | n/a | https://api.hyperliquid.xyz/info, wss://api.hyperliquid.xyz/ws | n/a |

For production Elysium traffic use a provider RPC (Alchemy is Kinetiq's recommended one): `https://elysium-testnet.g.alchemy.com/v2/{API_KEY}`.

## Workflow 1: scaffold a project

Default: Foundry contracts + Next.js app with wagmi and viem.

```
- [ ] forge init contracts && npx create-next-app@latest web --ts
- [ ] npm i wagmi viem @tanstack/react-query  (in web/)
- [ ] Copy scripts/chains.ts into web/ (defines Elysium testnet 99801; re-exports hyperEvm, hyperliquidEvmTestnet)
- [ ] Add rpc_endpoints to foundry.toml (elysium_testnet, hyperevm, hyperevm_testnet)
- [ ] .env.example with ELYSIUM_RPC_URL, HYPEREVM_RPC_URL; .env in .gitignore
- [ ] cast chain-id --rpc-url $ELYSIUM_RPC_URL prints 99801
```

Configs to copy (foundry.toml, wagmi, Hardhat 3): [references/elysium.md](references/elysium.md) section 2.

**Trap:** `import { elysiumTestnet } from 'viem/chains'` is Vulcan Forged's chain 1338 with LAVA gas, not Kinetiq's Elysium. Always use `defineChain` with ID 99801. Community posts quoting "99901" are also wrong.

## Workflow 2: deploy and verify on Elysium testnet

```
- [ ] Fund the deployer from https://elysium.kinetiq.xyz/testnet-faucet (or bridge testnet HYPE)
- [ ] cast wallet import deployer --interactive   (never a raw key in a flag or file)
- [ ] forge script script/Deploy.s.sol --rpc-url $ELYSIUM_RPC_URL --account deployer --broadcast
- [ ] forge verify-contract <ADDR> src/X.sol:X --chain 99801 --verifier blockscout \
        --verifier-url https://testnet.elysium.kinetiq.xyz/api/verify --skip-is-verified-check --watch
- [ ] Open https://testnet.elysium.kinetiq.xyz/address/<ADDR>?tab=contract and confirm a full match
- [ ] Submit the ecosystem listing from the same deployer wallet
```

Before porting HyperEVM code, check [references/elysium.md](references/elysium.md) section 4. The big four:
- HyperEVM precompiles (0x...0800+) and CoreWriter (0x3333...3333) do not exist on Elysium. Calls return empty data and the decode reverts.
- Solidity `block.number` on Elysium returns the HyperEVM block number. Use `block.timestamp` or `ArbSys(0x64).arbBlockNumber()`.
- A plain HYPE transfer costs about 21,170 gas. Never hardcode 21000.
- No public mempool: pending-transaction subscriptions never fire.

## Workflow 3: integrate kHYPE

Read the rate (no wallet needed):

```ts
import { createPublicClient, http, parseAbi } from 'viem'
import { hyperEvm } from 'viem/chains'
const client = createPublicClient({ chain: hyperEvm, transport: http() })
const rate = await client.readContract({
  address: '0x9209648Ec9D448EF57116B73A2f081835643dc7A', // kHYPE StakingAccountant, chain 999
  abi: parseAbi(['function kHYPEToHYPE(uint256) view returns (uint256)']),
  functionName: 'kHYPEToHYPE', args: [10n ** 18n],
}) // HYPE per 1 kHYPE, 18 decimals
```

Stake / unstake (StakingManager `0x393D0B87Ed38fc779FD9611144aE649BA6082109`):

```
- [ ] stake(): payable, >= minStakeAmount() (5 HYPE). kHYPE is minted to msg.sender
- [ ] maxStakeAmount() and stakingLimit() return 0 = no cap. Only enforce when > 0
- [ ] Unstake: kHYPE.approve(StakingManager, amt) -> queueWithdrawal(amt) -> wait withdrawalDelay() -> confirmWithdrawal(id)
- [ ] Show the user: amount, expected HYPE (kHYPEToHYPE), 7-day contract delay, about 8 to 9 days total, cannot cancel
```

If you wrap these calls in a contract, kHYPE, withdrawal ids and the returned HYPE all belong to your contract, not the user. Kinetiq's sample wrappers do not handle this. Read "Writing a wrapper contract: the 4 traps" in [references/khype-integration.md](references/khype-integration.md) before writing Solidity.

kHYPE as collateral: price = HYPE/USD x `kHYPEToHYPE(1e18)`. That is redemption value; add a market-price check or depeg breaker. The rate steps about once a day.

## Workflow 4: read and trade Markets

```bash
curl -s https://api.hyperliquid.xyz/info -H 'content-type: application/json' \
  -d '{"type":"metaAndAssetCtxs","dex":"mkts"}'      # markets, mark, funding, OI
curl -s https://api.hyperliquid.xyz/info -H 'content-type: application/json' \
  -d '{"type":"l2Book","coin":"mkts:US500"}'         # order book, prefixed coin
```

```
- [ ] Use dex "mkts" (USDC). "km" (USDH) is fully delisted
- [ ] Filter isDelisted; on 2026-10-24 live mkts markets were US500, USTECH, SMALL2000, USBOND, BVIV
- [ ] Coins are "mkts:TICKER"; many are onlyIsolated
- [ ] To trade: Hyperliquid API with your own signing and optional builder code, or the Markets REST API (hlk_ key, mainnet only, $10 minimum order, set a cloid)
- [ ] Every order: show coin, side, size, price, fees; get a confirm
```

Details, error handling and the 502 rule: [references/markets-and-launch.md](references/markets-and-launch.md).

## Workflow 5: launch a HIP-3 market with Kinetiq

Not self-serve yet: EXFactory addresses and the enclave-signed launch payload come from Kinetiq during onboarding. The agent's job is preparation:

```
- [ ] Draft the onboarding email to contact@kinetiq.xyz (collateral, tier, validator, sub-deployers). The user sends it, not the agent
- [ ] Plan capital: opBond >= 1000 HYPE on HyperEVM, about 6 USDC activation (one-way), Tier 1 reserve floor 500,000 HYPE
- [ ] Enable HyperEVM big blocks for the deployer (evmUserModify usingBigBlocks)
- [ ] Run Kinetiq's fork rehearsal; testnet, then mainnet-dryrun, then mainnet
- [ ] Model fees with buybackBps (at 1000: deployer 40.5%, buyback 4.5%, Kinetiq 5%, Hyperliquid 50%)
```

Low-capital alternative: list an asset on `mkts` through Perps.inc (first listing BVIV, Sep 2026).

## What Kinetiq wants built

From Kinetiq's Elysium docs and announcements: spot trading venues, PropAMMs (5 to 10 quote updates a second), token launch and lifecycle flows (Elysium AMM to PropAMM to HyperCore spot to HIP-3 perp), HFT market making and keepers that will use the HyperCore precompile and `ElysiumCoreWriter`, and tooling (data, wallets, name service). Nine ideas with checklists: [references/starter-ideas.md](references/starter-ideas.md).

## Gotchas (all verified 2026-10-24 unless marked)

| # | Gotcha | Do this |
| --- | --- | --- |
| 1 | viem `elysiumTestnet` is chain 1338 (Vulcan Forged) | `defineChain` id 99801 |
| 2 | X posts list Elysium chain ID 99901 | 99801; check with `cast chain-id` |
| 3 | HyperEVM precompiles/CoreWriter absent on Elysium, calls return `0x` | Feature-flag per chain |
| 4 | `block.number` on Elysium = HyperEVM block | `block.timestamp` / `arbBlockNumber()` |
| 5 | Plain transfer = 21,170 gas on Elysium | Let tools estimate |
| 6 | No pending-tx feed on Elysium | Watch blocks and receipts |
| 7 | `maxStakeAmount`/`stakingLimit` = 0 means no cap; Kinetiq's validation sample reverts | Check `> 0` first |
| 8 | `totalStaked` is cumulative deposits, not TVL | TVL = `kHYPEToHYPE(totalSupply)` |
| 9 | `queueWithdrawal` pulls kHYPE with `transferFrom` (audited source) | Approve StakingManager first |
| 10 | Wrapper contracts receive the kHYPE, ids and HYPE | Forward to the user; add `receive()` |
| 11 | kmHYPE minting is whitelisted | Buy or read kmHYPE; do not call `stake()` |
| 12 | kmHYPE docs say 0.10% withdrawal fee; on-chain `unstakeFeeRate` = 0 | Read live value |
| 13 | `km` dex fully delisted; Markets is `mkts` (USDC) | Use `dex: "mkts"` |
| 14 | HIP-3 coins need the `dex:` prefix; the Markets asset docs list stocks (TSLA, AAPL) that are delisted on `mkts` and trade as `xyz:TSLA` on another dex | `mkts:US500`; read meta live |
| 15 | Off-hours Markets oracle follows the order book EMA | Widen liquidation and alert bands outside US hours |
| 16 | Canonical bridge: approve the gateway not the router; withdrawal `data` must be empty | See elysium.md section 5 |
| 17 | Retryable tickets can expire | Monitor and redeem |
| 18 | Look-alike WHYPE/USDC on Elysium testnet | Pin addresses |
| 19 | Elysium mainnet params not out; scam warning issued 23 Oct 2026 | Wait for the official contract-addresses page |
| 20 | Node 20 has no global WebSocket | Node 22+ or `ws` |

## FAQ

**Is there a Kinetiq SDK?** No official JS SDK for kHYPE was found; use viem with the ABIs in khype-integration.md or the interface zip from the contracts page. Kinetiq's GitHub (github.com/kinetiq-research) has `hl-rs`, a Rust Hyperliquid SDK.

**Is kHYPE on Elysium or HyperEVM testnet?** No deployment is published for either. Build kHYPE features against HyperEVM mainnet with fork tests.

**Can I use Elysium mainnet now?** Not before 9 Nov 2026. Build on testnet; switch config when the official addresses page updates.

**How do I read HyperCore prices on Elysium today?** Off-chain from the Hyperliquid API, then post on-chain via your own keeper. The native precompile comes about 4 weeks after mainnet.

**How do builders earn?** 25% of Elysium sequencer revenue goes to builders (allocation formula not yet published), HIP-3 deployer fees on Launch markets, and Hyperliquid builder codes on trading apps.

**Where do I ask?** Discord https://discord.kinetiq.xyz, X @Kinetiq_xyz, @Enter_Elysium, @Markets_xyz. Launch onboarding: contact@kinetiq.xyz.

## Not verified (say so if asked)

Elysium mainnet chain ID, RPC and addresses; challenge period length; builder revenue allocation formula; EXFactory and other Launch addresses; Earn (vkHYPE) vault address; sKNTQ contract; kHYPE PauserRegistry (docs text and link disagree); the exact ArbOS/EVM version on Elysium; HyperEVM testnet USDC (third-party source). Full list in [references/contracts.md](references/contracts.md).
