# Kinetiq contract and network reference

Every value here was copied from an official source (URL beside it) and, where marked **on-chain**, read back live on 2026-10-24 (Africa/Lagos). Values marked **verify before use** come from a secondary source or have a known discrepancy. Never use an address that is not in this file or in an official Kinetiq page you just opened.

## Contents
- Networks (chain IDs, RPCs, explorers)
- HyperEVM mainnet: kHYPE
- HyperEVM mainnet: kmHYPE (Markets by Kinetiq)
- HyperEVM mainnet: institutional LSTs (iHYPE program)
- HyperCore / Hyperliquid API identifiers
- Elysium testnet (99801)
- HyperEVM testnet (998) bridge contracts for Elysium
- Not published yet / not found
- How to re-verify an address yourself

Primary sources:
- S1 = https://kinetiq.xyz/docs/contracts-and-audits (last updated 28 Apr 2026)
- S2 = https://elysium.kinetiq.xyz/docs/contract-addresses (last updated 20 Oct 2026)
- S3 = https://elysium.kinetiq.xyz/docs/connecting-to-elysium
- S4 = Hyperliquid info API, `POST https://api.hyperliquid.xyz/info` (live, read 2026-10-24)
- S5 = viem `viem/chains` (`hyperEvm`, `hyperliquidEvmTestnet`)
- S6 = https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/hyperevm

## Networks

| Network | Chain ID | RPC | Explorer | Source |
| --- | --- | --- | --- | --- |
| HyperEVM mainnet | 999 | https://rpc.hyperliquid.xyz/evm | https://hyperevmscan.io (verify before use) | S5, S6 |
| HyperEVM testnet | 998 | https://rpc.hyperliquid-testnet.xyz/evm | testnet.hyperevm-explorer.xyz (third party, verify before use) | S5 |
| Elysium testnet | 99801 (0x185d9) | https://testnet-rpc.elysium.kinetiq.xyz (public, shared) | https://elysium.kinetiq.xyz/testnet-explorer | S2, S3; on-chain chainId check |
| Elysium testnet (Alchemy) | 99801 | https://elysium-testnet.g.alchemy.com/v2/{API_KEY}, wss://elysium-testnet.g.alchemy.com/v2/{API_KEY} | same | S3, https://www.alchemy.com/docs/reference/elysium-api-quickstart |
| Elysium mainnet | NOT PUBLISHED | Alchemy pattern elysium-mainnet.g.alchemy.com (verify before use) | NOT PUBLISHED | S3 says "coming soon"; mainnet announced for 9 Nov 2026 |

Other Elysium testnet endpoints (S3, explorer pages):
- Faucet: https://elysium.kinetiq.xyz/testnet-faucet
- Bridge UI: https://elysium.kinetiq.xyz/testnet-bridge
- Contract verification (Blockscout API, no key): `https://testnet.elysium.kinetiq.xyz/api/verify` (source: https://testnet.elysium.kinetiq.xyz/verify-contract). Chainstack docs give `https://elysium.kinetiq.xyz/api/` as an alternative.
- Conduit-hosted explorer serving `/tx/` paths (useful for wallet configs): https://explorer-elysium-testnet.t.conduit.xyz (source: https://docs.chainstack.com/docs/elysium-tooling, verify before use)

Traps:
- `elysiumTestnet` exported by `viem/chains` is Vulcan Forged's Elysium (chain ID 1338, LAVA). It is a different chain. Use `defineChain` with ID 99801 (see `scripts/chains.ts`).
- Community posts on X list "Chain ID 99901" for Elysium. That is wrong. The RPC returns 99801.
- Mainnet values for Elysium are not out. Do not guess them from the testnet ones.

## HyperEVM mainnet (999): kHYPE

Source S1. **on-chain** = read back with viem on 2026-10-24.

| Contract | Address | Notes |
| --- | --- | --- |
| kHYPE token | 0xfD739d4e423301CE9385c1fb8850539D657C296D | on-chain: name "Kinetiq Staked HYPE", 18 decimals, totalSupply about 9.96M |
| StakingManager | 0x393D0B87Ed38fc779FD9611144aE649BA6082109 | on-chain: minStakeAmount 5 HYPE, maxStakeAmount 0, stakingLimit 0, withdrawalDelay 604800 s, unstakeFeeRate 0 |
| StakingAccountant | 0x9209648Ec9D448EF57116B73A2f081835643dc7A | on-chain: kHYPEToHYPE(1e18) = 1.0269987... HYPE |
| ValidatorManager | 0x4b797A93DfC3D18Cf98B7322a2b142FA8007508f | |
| OracleManager | 0x192826e470bd65FDC2CB472eDd834D096233049b | |
| DefaultOracle | 0xefbcCc6E33DA1C1ef638cBc0F044968D0f590fED | S1 lists the same address for DefaultOracle and OracleAdapter |
| OracleAdapter | 0xefbcCc6E33DA1C1ef638cBc0F044968D0f590fED | see above |
| PauserRegistry | 0xac03CABA51e17c86c921E1f6CBFBdC91F8BB2E6b | **verify before use**: S1 shows this text but its explorer link points to 0x752E76ea71960Da08644614E626c9F9Ff5a50547 |
| Operator | 0x23A4604cDFe8e9e2e9Cf7C10D7492B0F3f4B4038 | |

Interfaces (IStakingManager, IKHYPE, IStakingAccountant): https://kinetiq.xyz/assets/share/contract-interfaces/khype.zip (linked from S1).
Audited source (April 2025 snapshot): https://github.com/code-423n4/2025-04-kinetiq

## HyperEVM mainnet (999): kmHYPE (Markets by Kinetiq)

Source S1.

| Contract | Address | Notes |
| --- | --- | --- |
| kmHYPE token | 0x360C140E5344A1A0593D44B4ea6Fc7C3DAf0C473 | on-chain: name "Kinetiq Markets LST", 18 decimals |
| StakingManager | 0x71F0019cC7fa79E4f42587FB7b9a817D8d2429EC | on-chain: min 5 HYPE, withdrawalDelay 604800 s, unstakeFeeRate 0 (docs say 0.10% fee; verify before relying on either). S4 confirms this address is the HIP-3 deployer of the `km` and `mkts` dexes |
| StakingAccountant | 0x5901e744759561C63309865Ef8822aBb041655E2 | on-chain: kHYPEToHYPE(1e18) = 1.0182377... (function names are shared with kHYPE) |
| ExchangeRouter | 0x6AB31532382Ba5cD5E8b5D343Cf5995906bb8DD8 | |
| ExchangeManager | 0x4ef8bBaceE867eFd6Faa684B30ecD12DF74C4A48 | |
| ValidatorManager | 0x3899b60878c742a18A46A31Ad208bddfA19Fd266 | |
| OracleManager | 0x673C57b16F3855CB08030290654bb5E26Ac8E273 | |
| DefaultOracle | 0x9c2Fc9AE6261d08EA8f1dBe53F58C99F7eF9FCA2 | |
| OracleAdapter | 0xD477333725258d5174e91c959c2f5A71Ed681a30 | |
| PauserRegistry | 0xcE8018B29C36423F6A512b384B56B25e069Da79e | |
| GlobalConfig | 0x32C00306e872cC216cF144C2D8c7aFb3Cd4BB0F8 | |
| BlockedWithdrawalQueue | 0x22850d7cFbA41aE241BE61FC56295Db0C159a4ec | |
| GhostLST | 0x74323CD0Db2FD826CadCc90153995F1E2b1d0801 | |
| Operator | 0x4459872f33d7e3b61238a6edc7611463c25D82Fa | |

HIP-3 fee recipient for both Kinetiq dexes (S4, `perpDexs`): 0xbcd4071d023bf2aae484d724c130b5af6f0ca0d2.

## HyperEVM mainnet (999): institutional LSTs (iHYPE program)

Source S1. Same contract pattern as kHYPE (token, StakingManager, StakingAccountant, Operator). Integrate only if your product targets that institution's users.

| LST | Token | StakingManager | StakingAccountant | Operator |
| --- | --- | --- | --- | --- |
| flowHYPE | 0x86d96fF0E78Dba9570b00f75807ce21213a19f3d | 0xfdd35c5179E8594E237031dd945E0584Af29572b | 0x968c6AB57CDe284eABA42D811b633BF27BdACC03 | 0x992d51A0d910985946A71F1eb5a4831736Db80f5 |
| HiHYPE | 0x4f322145aBedb2b39f69e7d4531AB4B2e6483154 | 0xaD492f9CADcccE9c3c213edd8aE55c152cD3A3ad | 0x62E6fa898761dE2345aB3d507b72c422a2829733 | 0x0A3600f3F36bbBF306ce7e9fD93aF7e845908Cf1 |
| asxnHYPE | 0x8599F2eFA5064C666B920E71381b5aaBc7Bb27F6 | 0x0c5d890Cf52973aE4A7b10fA7EE18e146d13D87B | 0x2312Dd3349De01C2370b5BFFe3Ce5B4f69eAb797 | 0x3eAC994c86DA01538ad5dE1d0fb7BE6CC550b06c |
| hylqHYPE | 0x498edC41Fa92530920a95483dea7a6CCe91F1C5c | 0x09B4cdA849037D1717e91D201EE416bf1c113895 | 0x5D544F496FC2E7189375e749E4813dA82a91Cb9e | 0xb73E42C4Ad32eD15BED4cba22Ba380449a4f60d5 |

## HyperCore / Hyperliquid API identifiers

Source S4 (`spotMeta`, `perpDexs`). These come from Hyperliquid's API, not from Kinetiq docs.

| Item | Value |
| --- | --- |
| KNTQ spot token | index 124, HyperEVM contract 0x000000000000780555bd0bca3791f89f9542c2d6 |
| USDC spot token | index 0, HyperEVM contract 0x6b9e773128f453f5c2c60935ee2de2cbc5390a24 |
| USDH spot token | index 360, HyperEVM contract 0x111111a1a0667d36bd57c0a9f569b98057111111 |
| HIP-3 dex `mkts` ("Markets By Kinetiq") | collateralToken 0 (USDC). The live Markets venue |
| HIP-3 dex `km` ("Markets by Kinetiq") | collateralToken 360 (USDH). Every market reads `isDelisted: true` on 2026-10-24. Markets moved from USDH to USDC collateral in June 2026 (Kinetiq announcements) |

## Elysium testnet (99801)

Source S2. **on-chain** = code present and/or token metadata read on 2026-10-24.

| Contract | Address | Notes |
| --- | --- | --- |
| Multicall3 | 0xcA11bde05977b3631167028862bE2a173976CA11 | on-chain: code present |
| WHYPE (canonical) | 0xCD57F65c2B0e5881CFC2E609F7CD53b746E1F234 | on-chain: symbol WHYPE, 18 decimals |
| USDC (canonical) | 0x7D29d8047B905000459c0E80c34a26CeedcB47b2 | on-chain: symbol USDC, 6 decimals |
| L2 Gateway router | 0x89659883a9d980925733B0A698F117AAb65ac718 | |
| L2 ERC-20 gateway | 0x30545d8b24185DdFe83E75aB6939f867b664e2E1 | |
| ElysiumBridgeFactory | 0xb94A38a4aC46970559E89E566f2486a3Fc56BE5a | mirror bridge, Elysium-native tokens |
| Bridge wallet gateway | 0x7255150a0340852Fe4B4B5657C5AcE6c09a4F959 | |
| ArbSys precompile | 0x0000000000000000000000000000000000000064 | stock Nitro; on-chain: arbBlockNumber() answers |
| ArbRetryableTx precompile | 0x000000000000000000000000000000000000006E | stock Nitro |
| NodeInterface | 0x00000000000000000000000000000000000000C8 | stock Nitro virtual contract (not listed in S2) |

Look-alike WHYPE and USDC tokens exist on testnet (S2 and building-on-elysium page). Check the address, not the symbol.

## HyperEVM testnet (998): Elysium parent-chain contracts

Source S2.

| Contract | Address |
| --- | --- |
| Rollup | 0xEbf08e34941fd93a0Fc1cD89dbBF7447267039Df |
| Bridge | 0x36dAbc3CEE2E1084B7d04c8015Ef68Cac78f4f37 |
| Inbox | 0x11178Df40CBf87a4343f4B3F8B09B366ceFA8Ec0 |
| Outbox | 0x87391D602aaffB3Fe8051EcCDb75d6EEe8C31060 |
| Sequencer inbox | 0xb5B1a0AebfFeF819Ec3F8c39a17b5C4E70A001E3 |
| Rollup event inbox | 0x5ad7539049Ba2184Be320977B866a6341f4A5F1C |
| Challenge manager | 0x0754429325CF02835CA17FcFBa9fc059cb2835B6 |
| L1 Gateway router | 0x1aAE2caD8B0249905492087EF230FcCEa3707C45 |
| L1 ERC-20 gateway | 0x792487eF5E423104bec94e8c58E814e5E0450cEA |
| Mirror gateway | 0x08922Faa84aC2a54aa3cFD3725b03ca256F52Da2 |
| ElysiumMirrorFactory | 0xcaDb9986F3727177d48FA07294E1730f9D19290b |

HyperEVM testnet USDC (Circle): 0x2B3370eE501B4a559b57D449569354196457D8Ab. Source: third-party Tilt docs. **verify before use**.

## Not published yet / not found

Do not fill these in from memory or from a block explorer search:
- Elysium mainnet chain ID, RPC, explorer, canonical tokens, bridge contracts (expected around 9 Nov 2026).
- Launch (Exchange-as-a-Service) mainnet contracts: EXFactory, EXManager, EXLST, StakingManagerRouter, LaunchFeeSplitter. The deployer guide describes their functions but no address list was found. Get them from contact@kinetiq.xyz during onboarding.
- Earn vault (vkHYPE, Veda) contract address.
- kHYPE or kmHYPE deployments on HyperEVM testnet (998).
- sKNTQ staking contract address.
- HyperCore market-data precompile address and `ElysiumCoreWriter` predeploy address on Elysium (arrive with an ArbOS upgrade about 4 weeks after mainnet).

## How to re-verify an address yourself

```bash
# chain ID of an RPC
cast chain-id --rpc-url https://testnet-rpc.elysium.kinetiq.xyz           # 99801
# token metadata
cast call 0xfD739d4e423301CE9385c1fb8850539D657C296D "name()(string)" --rpc-url https://rpc.hyperliquid.xyz/evm
# code exists
cast code 0xcA11bde05977b3631167028862bE2a173976CA11 --rpc-url https://testnet-rpc.elysium.kinetiq.xyz
# HIP-3 deployers
curl -s https://api.hyperliquid.xyz/info -H 'content-type: application/json' -d '{"type":"perpDexs"}'
```
