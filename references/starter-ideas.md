# Starter app ideas with build checklists

Each idea maps to something Kinetiq says it wants (see `elysium.md` section 7) or to a real gap found while researching. Difficulty: S = a weekend, M = a week or two, L = a team project. Every checklist ends with the same safety gate: testnet first, explicit user confirmation for any transaction, no private keys in code or chat.

## Contents
1. kHYPE rate and APY widget (S, HyperEVM read-only)
2. Kinetiq read-only MCP server for AI agents (S, read-only)
3. Markets 24/7 terminal (M, Hyperliquid API)
4. Weekend oracle and funding alert bot (S, Hyperliquid API)
5. Stake-to-kHYPE widget with a wrapper contract (M, HyperEVM)
6. PropAMM on Elysium (L, Elysium)
7. Token launchpad with a graduation path (L, Elysium + HyperEVM + HyperCore)
8. Elysium bridge tracker and retryable rescuer (M, Elysium + HyperEVM)
9. Launch market planner (S, calculator)

## 1. kHYPE rate and APY widget (S)

Embeddable card: 1 kHYPE = X HYPE, 7d and 30d APY, TVL, queue length.
- [ ] Next.js app, viem `hyperEvm` client (RPC from env).
- [ ] Read `kHYPEToHYPE(1e18)` now and at blocks about 7 and 30 days back (`getBlock` by binary search on timestamp). Annualize.
- [ ] TVL = `kHYPEToHYPE(totalSupply)`. Do not show `totalStaked` as TVL.
- [ ] Show `withdrawalDelay` and note the 8 to 9 day user-facing estimate.
- [ ] Cache reads for 60 s; the rate changes about daily.
- [ ] Cite the contract addresses in the footer with explorer links.

## 2. Kinetiq read-only MCP server for AI agents (S)

Lets any agent answer "what is the kHYPE rate", "show the mkts:US500 book", "is Elysium testnet healthy".
- [ ] TypeScript MCP server (`@modelcontextprotocol/sdk`) with tools: `khype_rate`, `khype_withdrawals(address)`, `markets_list(dex)`, `markets_book(coin)`, `elysium_status`.
- [ ] Reuse the three scripts in `scripts/` as tool bodies.
- [ ] Read-only by design: no signing tools, no key handling. State this in the tool descriptions.
- [ ] Validate inputs (address checksum, coin must contain `:` for HIP-3).
- [ ] Return the source (contract address or API body) with every answer so agents can cite it.

## 3. Markets 24/7 terminal (M)

TradFi perps on Hyperliquid trade through weekends; most terminals ignore the session context.
- [ ] Market list from `metaAndAssetCtxs` with `dex: "mkts"`; hide `isDelisted`.
- [ ] Live book and trades over WebSocket (`l2Book`, `trades` subscriptions with `mkts:` coins).
- [ ] Session badge per market (US regular / extended / overnight / weekend, ET) and explain that off-hours oracle is an order-book-driven EMA (see `markets-and-launch.md`).
- [ ] Funding (hourly) and OI vs cap per market.
- [ ] Optional trading via the Markets trading API or your own builder code. Order ticket must show coin, side, size, price, est. fees and require a confirm click.

## 4. Weekend oracle and funding alert bot (S)

- [ ] Poll `metaAndAssetCtxs` for `mkts` every 30 to 60 s (or WebSocket `activeAssetCtx`).
- [ ] Alert when mark deviates from oracle by more than N bps, funding exceeds a threshold, or a market flips `isDelisted`.
- [ ] Send to Telegram or Discord via webhook stored in env.
- [ ] Rate-limit alerts per market; log every alert with the raw API values.

## 5. Stake-to-kHYPE widget with a wrapper contract (M)

For an app that wants to stake on behalf of users (zap, referral, auto-compounding).
- [ ] Read `khype-integration.md` section "Writing a wrapper contract: the 4 traps" first.
- [ ] Contract: `stakeFor(user, minOut)` measures its own kHYPE delta and transfers it to `user`; enforces `minOut` from `HYPEToKHYPE`.
- [ ] Guard `maxStakeAmount`/`stakingLimit` with `> 0` checks.
- [ ] Unstake path: pull kHYPE from user, approve StakingManager, queue, keep a `user => ids` map, `receive()` HYPE, forward on confirm with reentrancy guard.
- [ ] Foundry fork tests against `https://rpc.hyperliquid.xyz/evm` (no gas spent).
- [ ] Get an audit before holding user funds. Kinetiq lists its own auditors on https://kinetiq.xyz/docs/contracts-and-audits.
- [ ] UI shows amount, contract addresses, chain 999 and quoted kHYPE before every signature.

## 6. PropAMM on Elysium (L)

A market-maker-quoted AMM. Elysium's 100 to 200 ms blocks and low gas make 5 to 10 quote updates per second affordable (Kinetiq's stated target).
- [ ] Contracts: pool holds WHYPE/USDC (canonical testnet addresses); an authorized quoter posts `(bid, ask, size, expiry)`; swaps fill against the latest unexpired quote.
- [ ] Quote expiry in `block.timestamp` terms (not `block.number`, which is HyperEVM's on Elysium).
- [ ] Reference price off-chain from Hyperliquid's API today; design an `IMarketData` interface to swap in the HyperCore market-data precompile after the post-mainnet ArbOS upgrade.
- [ ] Priority-fee ordering and no public mempool: quoter updates should pay enough priority fee to land before takers.
- [ ] Inventory hedging on HyperCore through the Hyperliquid API (later via `ElysiumCoreWriter`).
- [ ] Load test on testnet: measure update latency and gas per quote.
- [ ] Verify contracts on the Elysium explorer and submit the ecosystem listing from the deployer wallet.

## 7. Token launchpad with a graduation path (L)

Kinetiq's lifecycle: Elysium AMM, then PropAMM, then HyperCore spot, then a HIP-3 perp.
- [ ] Launch contract on Elysium: fixed-supply ERC-20 with immutable name/symbol/decimals (required by the mirror bridge).
- [ ] Bonding curve or fair-launch sale, then seed an AMM pool with canonical WHYPE.
- [ ] Graduation: register the HyperEVM mirror with `ElysiumMirrorFactory.createAndRegisterL1Mirror` (read the bridging doc for `RegistrationParams`).
- [ ] HyperCore spot listing needs a ticker auction and linking on Hyperliquid; document it as a manual, team-run step.
- [ ] Perp stage: Perps.inc listing on `mkts` or your own dex via Kinetiq Launch.
- [ ] Anti-rug defaults: locked LP, no mint function, published deployer.

## 8. Elysium bridge tracker and retryable rescuer (M)

Retryable tickets can expire after several days; users lose deposits they never redeemed.
- [ ] Index `outboundTransfer` deposits on the HyperEVM testnet gateway router and matching L2 messages.
- [ ] Flag tickets that failed auto-redeem; offer a one-click `ArbRetryableTx.redeem(ticketId)` with confirmation.
- [ ] Track withdrawals through the challenge period and offer Outbox execution when ready.
- [ ] Read-only mode by default; signing only with the user's wallet.

## 9. Launch market planner (S)

Help a prospective HIP-3 deployer size a Launch market.
- [ ] Inputs: expected daily volume, fee rate, `buybackBps`, reserve size, staking APR.
- [ ] Output: deployer treasury revenue, buyback flow into EXLST, implied EXLST APY, using the split in `markets-and-launch.md`.
- [ ] Show capital needs: 1000 HYPE bond, 500,000 HYPE Tier 1 floor, about 6 USDC activation, big blocks enabled.
- [ ] Link to contact@kinetiq.xyz for onboarding; do not imply the tool can deploy.
