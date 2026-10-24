# kHYPE integration guide (HyperEVM mainnet, chain 999)

For apps and contracts that read, mint, redeem, price or accept kHYPE. Addresses: `contracts.md`.

Sources:
- K1 = https://kinetiq.xyz/docs/integration (official integration guide)
- K2 = https://kinetiq.xyz/docs/khype and https://kinetiq.xyz/docs/faq
- K3 = audited source snapshot, https://github.com/code-423n4/2025-04-kinetiq (`src/StakingManager.sol`, `src/KHYPE.sol`). The deployed contracts are upgradeable proxies and have changed since (for example `withdrawalRequests` now returns a 5th field, `bufferUsed`). Treat K3 as behavior reference, then confirm on-chain.
- On-chain reads: 2026-10-24 with `scripts/read-khype-rate.ts`.

## Contents
- Mental model
- Read the rate and protocol state
- Stake (mint kHYPE)
- Unstake (queue, wait, confirm)
- Writing a wrapper contract: the 4 traps
- kHYPE as collateral or in a vault
- TVL and APY numbers
- kmHYPE is not open-mint
- Minimal ABI

## Mental model

- kHYPE is a non-rebasing exchange-rate token. Balances do not grow; the HYPE value of 1 kHYPE does (K2).
- `StakingAccountant` holds the rate: `kHYPEToHYPE(uint256)` and `HYPEToKHYPE(uint256)`, both 18 decimals.
- The rate is updated about once a day when rewards are reported (K2 FAQ). Expect a step change, not a smooth curve.
- Protocol fee: 10% of staking rewards (K2). Stake minimum 5 HYPE (on-chain `minStakeAmount`).
- Exit: `queueWithdrawal` then `confirmWithdrawal` after `withdrawalDelay` (on-chain 604800 s = 7 days). Kinetiq's user-facing estimate is about 8 to 9 days end to end because of HyperCore's delegation lockup. A queued withdrawal cannot be cancelled and stops earning (K2).
- On-chain `unstakeFeeRate` reads 0 bps on 2026-10-24. It is a settable parameter: read it, do not hardcode it.

## Read the rate and protocol state

```ts
import { createPublicClient, http, parseAbi, formatEther } from 'viem'
import { hyperEvm } from 'viem/chains'

const client = createPublicClient({ chain: hyperEvm, transport: http(process.env.HYPEREVM_RPC_URL) })
const ACCOUNTANT = '0x9209648Ec9D448EF57116B73A2f081835643dc7A'
const abi = parseAbi(['function kHYPEToHYPE(uint256) view returns (uint256)'])
const hypePerKhype = await client.readContract({ address: ACCOUNTANT, abi, functionName: 'kHYPEToHYPE', args: [10n ** 18n] })
console.log(formatEther(hypePerKhype)) // about 1.027 on 2026-10-24
```

For a full readout (limits, delay, fee, a user's pending withdrawals) run `npx tsx scripts/read-khype-rate.ts [address]`.

Batch reads with Multicall3 (`client.multicall`), which viem's `hyperEvm` chain already configures.

## Stake (mint kHYPE)

`StakingManager.stake()` is payable. Send native HYPE (at least `minStakeAmount`). kHYPE is minted to `msg.sender` (K3 line `kHYPE.mint(msg.sender, kHYPEAmount)`). Sending plain HYPE to the StakingManager also stakes through its `receive()` (K3).

Checks before sending:
1. `paused` state: a paused manager reverts. Surface the revert reason to the user.
2. `msg.value >= minStakeAmount()`.
3. `maxStakeAmount()` and `stakingLimit()` read 0 on mainnet. In K3, 0 means "no cap" (`if (maxStakeAmount > 0) require(...)`). Only enforce them when they are non-zero.
4. Slippage: quote `HYPEToKHYPE(value)` and compare with the minted amount if your contract wraps the call.

```ts
// Frontend, wagmi/viem. Always show the user: amount, StakingManager address, network (999), and quoted kHYPE out.
await walletClient.writeContract({
  address: '0x393D0B87Ed38fc779FD9611144aE649BA6082109',
  abi: parseAbi(['function stake() payable']),
  functionName: 'stake',
  value: parseEther('10'),
})
```

## Unstake (queue, wait, confirm)

1. `kHYPE.approve(StakingManager, amount)`. K3 pulls the tokens with `kHYPE.transferFrom(msg.sender, address(this), amount)`, so an allowance is needed. Kinetiq's TypeScript sample in K1 skips this step; add it.
2. `StakingManager.queueWithdrawal(amount)`. The id is `nextWithdrawalId(user)` read before the call.
3. Wait until `withdrawalRequests(user, id).timestamp + withdrawalDelay()` has passed. Show a countdown, not a promise of an exact day.
4. `StakingManager.confirmWithdrawal(id)` or `batchConfirmWithdrawals(uint256[])`. HYPE is sent to `msg.sender` with a low-level call.

For users who want out now, the faster path is a swap on a DEX or aggregator, at market price. Show the price impact next to the 7 to 9 day queue so they can choose.

## Writing a wrapper contract: the 4 traps

K1's Solidity samples (`KinetiqDepositor`, `KinetiqWithdrawer`, `AdvancedKinetiqDepositor`) are illustrations. Copied as-is into a contract that users call, they break:

1. **kHYPE lands in your contract, not the user's wallet.** `stake()` mints to `msg.sender`, which is your contract. Measuring `kHYPE.balanceOf(user)` before and after (as K1 does) always yields 0. Measure your own balance, then `transfer` to the user or account for it internally.
2. **Withdrawals belong to your contract.** `queueWithdrawal` pulls kHYPE from your contract and records the request under your contract's address. `nextWithdrawalId`, `withdrawalRequests` and `confirmWithdrawal` are keyed by your contract. Keep your own `user => ids` map and pull the user's kHYPE in first.
3. **Your contract must accept HYPE.** `confirmWithdrawal` sends HYPE with `call{value:}`. Add `receive()` and forward the amount to the user, with reentrancy protection.
4. **The "validation" sample reverts on mainnet.** `require(msg.value <= maxStakeAmount())` and `require(totalStaked + msg.value <= stakingLimit())` fail when those return 0, which they do today. Guard with `> 0` like the protocol does. Also, `totalStaked()` is cumulative deposits (K3: net = totalStaked + rewards - totalClaimed), so it is not a live TVL figure.

Foundry fork test to catch all four (no keys, no gas):

```bash
forge test --fork-url https://rpc.hyperliquid.xyz/evm -vvv
```

```solidity
// test sketch: deal HYPE to a user, call your wrapper, assert user's kHYPE balance increased by ~HYPEToKHYPE(amount)
vm.deal(user, 10 ether);
vm.prank(user);
wrapper.stakeFor{value: 10 ether}(user, minOut);
assertApproxEqRel(kHYPE.balanceOf(user), accountant.HYPEToKHYPE(10 ether), 1e15);
```

## kHYPE as collateral or in a vault

- Price: `HYPE/USD price * kHYPEToHYPE(1e18) / 1e18`. This is the redemption value, not the market price. During stress kHYPE can trade below it on DEXs. Lending markets usually take min(redemption value, market TWAP) or add a depeg circuit breaker. Document which you chose.
- The rate updates about daily and only goes up in normal operation. Slashing or a bad report can lower it. Do not assume monotonic increase in liquidation math.
- Never read the rate from a DEX pool spot price in the same transaction (flash-loan manipulable).
- Liquidators need an exit. Liquidity for kHYPE on HyperEVM DEXs is the real limit on LTV, not the 7-day redemption.
- ERC-4626 vaults: kHYPE is plain ERC-20 with 18 decimals and no transfer hooks other than pause (K3 `_update` is `whenNotPaused`). Handle a paused token: transfers revert while paused.
- Kinetiq Earn (vkHYPE vault by Veda) is Kinetiq's own kHYPE strategy vault. Its address is not published in the docs; do not integrate without it from an official page.

## TVL and APY numbers

- TVL in HYPE: `kHYPEToHYPE(kHYPE.totalSupply())`. On 2026-10-24: about 10.2M HYPE (supply about 9.96M kHYPE x 1.027).
- APY: sample `kHYPEToHYPE(1e18)` at two block timestamps at least 7 days apart and annualize. Rates step daily, so short windows are noisy.

## kmHYPE is not open-mint

kmHYPE (Markets by Kinetiq LST) uses the same contract family, so the same ABI works for reads (`StakingAccountant` 0x5901...55E2 returns about 1.018 HYPE per kmHYPE). But its StakingManager has `whitelistEnabled() == true` on-chain (2026-10-24), so `stake()` from an arbitrary address reverts with "Address not whitelisted". Kinetiq allocates kmHYPE minting (sKNTQ tiers, institutions). For an app, buy kmHYPE on a DEX or integrate it as a read-only collateral asset. Kinetiq's kmHYPE page also describes a 0.10% withdrawal fee; on-chain `unstakeFeeRate` reads 0, so read the live value.

## Minimal ABI

Verified against mainnet on 2026-10-24 (reads) and K3 (writes):

```ts
export const stakingManagerAbi = parseAbi([
  'function stake() payable',
  'function queueWithdrawal(uint256 kHYPEAmount)',
  'function confirmWithdrawal(uint256 withdrawalId)',
  'function batchConfirmWithdrawals(uint256[] withdrawalIds)',
  'function minStakeAmount() view returns (uint256)',
  'function maxStakeAmount() view returns (uint256)',
  'function stakingLimit() view returns (uint256)',
  'function totalStaked() view returns (uint256)',
  'function totalClaimed() view returns (uint256)',
  'function totalQueuedWithdrawals() view returns (uint256)',
  'function withdrawalDelay() view returns (uint256)',
  'function unstakeFeeRate() view returns (uint256)',
  'function whitelistEnabled() view returns (bool)',
  'function nextWithdrawalId(address) view returns (uint256)',
  'function withdrawalRequests(address user, uint256 id) view returns ((uint256 hypeAmount, uint256 kHYPEAmount, uint256 kHYPEFee, uint256 bufferUsed, uint256 timestamp))',
])
export const stakingAccountantAbi = parseAbi([
  'function kHYPEToHYPE(uint256) view returns (uint256)',
  'function HYPEToKHYPE(uint256) view returns (uint256)',
])
```

`batchConfirmWithdrawals` and the `total*` getters come from K3; the deployed proxy answered `totalClaimed`, `totalQueuedWithdrawals` and `whitelistEnabled` on 2026-10-24. Official interface files: https://kinetiq.xyz/assets/share/contract-interfaces/khype.zip
