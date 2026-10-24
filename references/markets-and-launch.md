# Building on Markets by Kinetiq and Kinetiq Launch

Three layers, from least to most commitment:
1. **Read** Markets data from Hyperliquid's public API (no key, no account).
2. **Trade** Markets and other HIP-3 markets from a bot or app (Hyperliquid API directly, or the Markets trading API).
3. **Launch** your own HIP-3 perp dex with Kinetiq Launch (Exchange-as-a-Service), bonded by an LST.

Sources:
- M1 = https://markets.xyz/docs (Markets product docs, updated 25 Aug 2026)
- M2 = https://markets.xyz/docs/trading-api-overview and sibling `trading-api-*` pages (updated 22 to 23 Oct 2026); interactive reference https://trading-api.markets.xyz/docs
- M3 = https://markets.xyz/docs/third-party-assets (Perps.inc, updated 29 Sep 2026)
- M4 = https://markets.xyz/docs/oracle-prices, https://markets.xyz/docs/fees-and-costs
- L1 = https://kinetiq.xyz/docs/launch and https://kinetiq.xyz/docs/launch-deployer-and-operator-guide
- H1 = https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/info-endpoint (and /websocket)
- H2 = https://hyperliquid.gitbook.io/hyperliquid-docs/hyperliquid-improvement-proposals-hips/hip-3-builder-deployed-perpetuals
- Live API checks on 2026-10-24.

## Contents
- Where Markets lives on Hyperliquid (km vs mkts)
- Reading market data (REST and WebSocket)
- Trading: direct Hyperliquid API vs Markets trading API
- Markets trading API essentials
- Oracle and session behavior
- Third-party listings (Perps.inc)
- Kinetiq Launch: deploy your own HIP-3 dex
- Fee math

## Where Markets lives on Hyperliquid

Markets by Kinetiq is a set of HIP-3 perp dexes deployed by the kmHYPE StakingManager (0x71F0...29EC). `perpDexs` on 2026-10-24 returns two:

| dex | fullName | Collateral | Status on 2026-10-24 |
| --- | --- | --- | --- |
| `mkts` | Markets By Kinetiq | USDC (spot token 0) | Live. Markets with volume: US500, USTECH, SMALL2000, USBOND, BVIV. Others are listed but `isDelisted: true` |
| `km` | Markets by Kinetiq | USDH (spot token 360) | Every market `isDelisted: true`. Kinetiq moved Markets from USDH to USDC collateral in June 2026 |

Rules for agents:
- Coin names are prefixed: `mkts:US500`, not `US500`. An unprefixed name hits Hyperliquid's main perps or fails.
- Never hardcode the market list. Read `metaAndAssetCtxs` and filter `!isDelisted`. Listings change. Example: https://markets.xyz/docs/available-assets still lists TSLA, AAPL, NVDA and others, but on 2026-10-24 `mkts:TSLA` is `isDelisted: true`. The trading API docs' own examples use `xyz:TSLA` and `xyz:GOLD`, which live on a different HIP-3 dex (`xyz`) that markets.xyz routes to.
- Many HIP-3 markets are `onlyIsolated`. Setting cross margin on them fails.
- markets.xyz the app also routes crypto perps, spot and other HIP-3 dexes through Hyperliquid builder codes (M1). "Markets" the app is wider than the `mkts` dex.

## Reading market data

All POST to `https://api.hyperliquid.xyz/info` with `content-type: application/json` (H1). All verified live 2026-10-24.

| Need | Body |
| --- | --- |
| List HIP-3 dexes and deployers | `{"type":"perpDexs"}` |
| Markets + live context (mark, funding, OI, 24h volume) | `{"type":"metaAndAssetCtxs","dex":"mkts"}` |
| Mids | `{"type":"allMids","dex":"mkts"}` |
| Order book (up to 20 levels a side) | `{"type":"l2Book","coin":"mkts:US500"}` |
| Candles | `{"type":"candleSnapshot","req":{"coin":"mkts:US500","interval":"1h","startTime":<ms>}}` |
| Spot tokens (USDC, USDH, KNTQ indices) | `{"type":"spotMeta"}` |
| A user's HIP-3 positions | `{"type":"clearinghouseState","user":"0x...","dex":"mkts"}` |

WebSocket `wss://api.hyperliquid.xyz/ws` (verified with `l2Book` on `mkts:US500`):

```json
{ "method": "subscribe", "subscription": { "type": "l2Book", "coin": "mkts:US500" } }
```

Ready-made: `npx tsx scripts/markets-snapshot.ts mkts mkts:US500`.

Node 20 has no global `WebSocket`; use Node 22+, the `ws` package, or `--experimental-websocket`.

## Trading: direct Hyperliquid API vs Markets trading API

| | Direct Hyperliquid API | Markets trading API (M2) |
| --- | --- | --- |
| Signing | You sign every action (EIP-712, msgpack action hash); use an SDK (Python `hyperliquid-python-sdk`, TS SDKs, Kinetiq's Rust `kinetiq-research/hl-rs`) | REST + JSON with an `hlk_` API key. Managed mode signs with an agent it holds; client-signed mode returns EIP-712 for you to sign |
| Asset ids, tick rounding, nonces | Your job | Done by the API |
| Builder fee | None unless you add your own builder code | Markets builder fee 2.5 bps falling to 0.2 bps with 14-day volume. Spot buys carry no builder fee |
| Testnet | Yes (Hyperliquid testnet) | No. Mainnet only |
| Custody | Your keys | Your funds stay in your Hyperliquid account; the agent can trade but never withdraw |

Pick direct API for a product that needs its own builder code (you earn the fee) or testnet. Pick the Markets API for a bot that wants the fastest path to placing HIP-3 orders.

## Markets trading API essentials (M2)

Base URL `https://trading-api.markets.xyz`. Auth header `Authorization: Bearer hlk_...` or `X-API-Key`.

Onboarding:
1. Master wallet must have deposited on Hyperliquid first, or every action is rejected.
2. Get a key at https://markets.xyz/api-access (signs a message, no transaction). Store it in a secret manager; it is shown once.
3. Approve two things with the master wallet once: the trading agent (`ApproveAgent`, shows as API wallet `kinetiq`) and the builder fee (`ApproveBuilderFee`, at the top tier).
4. `GET /v1/account/status` must show `ready_to_trade: true`. Otherwise trading returns 412 `precondition_failed`.
5. Scripted alternative: `POST /v1/sign-up/challenge` then `/v1/sign-up`, `POST /v1/managed-agent`, `POST /v1/builder-fee/approve`, each signed and submitted within 60 s.

Orders (use full HIP-3 names):

```bash
curl -s -X POST https://trading-api.markets.xyz/v1/orders \
  -H "Authorization: Bearer $API_KEY" -H 'content-type: application/json' \
  -d '{"orders":[{"coin":"mkts:US500","side":"buy","px":"700","sz":"0.02","type":{"limit":{"tif":"Alo"}},"cloid":"<uuid>"}]}'
```

The example is illustrative: confirm price, size and the market's `szDecimals` with the user before sending anything.

Rules that bite:
- Minimum order value $10, including reduce-only and partial closes.
- Prices: at most 5 significant figures and at most 6 minus `szDecimals` decimals (8 for spot). Off-tick prices are rejected, not rounded.
- Always set a fresh UUID `cloid`. After a 502, look up by `cloid` before resending; `unknownOid` right after placing can mean "not indexed yet".
- A 200 can contain per-order errors. Check every entry in `response.results`.
- Rate limit 10 req/s per account by default (reads count). Batch up to 50 orders or cancels per request.
- Dead man's switch `POST /v1/schedule-cancel` needs $1M traded volume on Hyperliquid.
- Managed accounts run in unified account mode: USDC sits in spot, so `/v1/positions` can show `accountValue: 0` on a funded account. Read `/v1/spot-balances`.
- Endpoints with `?dex=` cover one dex per call (`/v1/positions?dex=mkts`).
- Market orders are IOC limits at mid +/- `slippage_bps` (default 50).

## Oracle and session behavior (M4)

- Kaiko provides oracle prices. Mark price is the median of three components and drives liquidations.
- US regular hours use exchange prices; overnight and weekends use an internal EMA (tau 1 hour) driven by order book impact prices, bounded by external bid/ask when spreads exceed 0.5%.
- Consequence for builders: weekend and overnight marks move with the Markets order book itself. Liquidation bots and hedgers should widen thresholds outside US hours.
- Funding is hourly. Base taker fee with growth-mode discounts starts at 0.0081% (perps). Builder fees through the markets.xyz front end start at 0.05% for perps.
- HK single names are quanto: priced in HKD, settled in USDC.

## Third-party listings (M3)

Projects can list HIP-3 assets on `mkts` through Perps.inc (https://perps.inc). Kinetiq stays deployer of record (oracle relay, risk params, halt/delist); Perps.inc and the project arrange pricing and liquidity. First listing: BVIV (Volmex Bitcoin implied volatility), 29 Sep 2026. This is the low-capital route to a market on `mkts`; Launch (below) is the route to your own dex.

## Kinetiq Launch: deploy your own HIP-3 dex (L1)

Launch packages a HIP-3 dex with an LST that supplies the HYPE stake Hyperliquid requires for HIP-3 deployers. Depositors stake HYPE into your market's `EXLST`; the reserve is delegated to a validator; trading-fee buybacks plus staking rewards raise the EXLST rate.

Per-market contracts: `EXManager` (phases and roles), `EXLST` (ERC-20 share), `StakingManagerRouter` (stake, rewards, HyperCore API wallet), `LaunchFeeSplitter` (fee routing). All deployed by `EXFactory`. **No EXFactory address is published; you get it during onboarding.**

Phases: `UNBONDED -> FUNDING -> LAUNCHING -> LIVE -> WOUND_DOWN`.

`MarketParams`:

```solidity
struct MarketParams {
    address admin;
    address operator;
    address enclaver;          // pinned by Kinetiq for the first cohort
    uint256 opBond;            // >= 1000 HYPE mainnet (1 HYPE testnet), 1e10-wei aligned
    address validator;         // must be in Kinetiq's approved set
    address gate;              // optional IEXGate (onDeposit/onWithdraw hooks), 0x0 for none
    string  lstName;
    string  lstSymbol;
    uint256 marketTier;        // pinned. Tier 1: 500,000 HYPE reserve floor, 750,000 EXLST cap
    address hyperCoreDeployer; // HC address that owns the paired spot ticker
    address deployerTreasury;  // HC spot address, must already be activated on HyperCore
    uint64  buybackBps;        // 0..10000 of post-protocol remainder; typical 1000
}
```

Deploy sequence checklist:
- [ ] Email contact@kinetiq.xyz with collateral token, tier, validator preference and sub-deployer needs. Receive the config JSON template. Order: testnet, then mainnet-dryrun, then mainnet.
- [ ] Run Kinetiq's fork-based rehearsal with your real deployer address.
- [ ] Enable HyperEVM big blocks for the deployer (Hyperliquid action `{"type":"evmUserModify","usingBigBlocks":true}`, see https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/hyperevm/dual-block-architecture). The deployer must already exist on HyperCore.
- [ ] Hold `opBond` HYPE on HyperEVM (not HyperCore spot).
- [ ] `EXFactory.deployMarket{value: opBond}(params)`.
- [ ] Hold about 6 USDC (activation token) on HyperEVM. `EXFactory.activateMarket(marketId, tokenId, amount)`. One-way bridge to HyperCore; wait for confirmation.
- [ ] `EXFactory.bondMarket(marketId)`. Market is FUNDING.
- [ ] Operator: `EXManager.fund()` once reserve >= tier floor, then `EXManager.launch(walletSignedData)` with the enclave-signed EIP-712 payload (registers the HC API wallet via CoreWriter action 9).
- [ ] Ongoing: sub-deployer addresses you control call HyperCore `perpDeploy` variants (`registerAsset`, `setOracle`, halts). Rotate API wallet with `updateWallet`.

Exits:
- Before bond: `EXFactory.cancelMarket(marketId, recipient)` after `unwindDelay` (1 day testnet, 7 days mainnet). Activation USDC already bridged is not recoverable.
- After bond: `setUnwindPhase(true)` then `unwind()` after `unwindDelay`. From LIVE it also needs Kinetiq's HyperCore attestation and a minimum link age `minLinkAgeForUnwind` (183 days on mainnet, 1 day on testnet, per L1).
- Slashing under HIP-3 is absorbed pro-rata by all EXLST holders, including the deployer bond. Confirmations pay the smaller of queue-time and confirm-time amounts.

Audits listed on https://kinetiq.xyz/docs/launch: Cantina (June 2026) and Zero Cool (May 2026), PDFs linked from that page.

## Fee math

Launch markets (L1): Hyperliquid keeps 50% of HIP-3 trading fees. Kinetiq takes 10% of the remaining DEX share (5% of total). The remaining 45% splits by `buybackBps`.

| buybackBps | Hyperliquid | Kinetiq | Buyback to EXLST | Deployer treasury |
| --- | --- | --- | --- | --- |
| 1000 (typical) | 50 | 5 | 4.5 | 40.5 |
| 0 | 50 | 5 | 0 | 45 |
| 5000 | 50 | 5 | 22.5 | 22.5 |

Rows other than 1000 are computed from the stated formula, not quoted.
