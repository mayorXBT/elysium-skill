# Elysium Skill

An agent skill that lets any AI coding agent build on Kinetiq: Elysium, kHYPE and Markets.

Hand this folder to Claude Code, Codex, Cursor or Grok Build and your agent knows how to scaffold, configure, deploy and verify apps on Elysium (Kinetiq's Hyperliquid L2), integrate kHYPE on HyperEVM, read and trade Markets by Kinetiq HIP-3 perps, and prepare a Kinetiq Launch market. Every address, chain ID and RPC is cited to an official source and was cross-checked on-chain or against the Hyperliquid API on 24 Oct 2026.

## What's inside

```
elysium-skill/
  SKILL.md                       routing, agent rules, 5 workflows, 20 gotchas, FAQ
  llms.txt                       one-page quick reference
  references/
    contracts.md                 addresses, chain IDs, RPCs, each with its source
    elysium.md                   scaffold, deploy, verify, bridge, roadmap, builder program
    khype-integration.md         rate reads, stake and unstake, wrapper traps, collateral pricing
    markets-and-launch.md        Hyperliquid API for mkts, Markets trading API, Launch EaaS
    starter-ideas.md             9 app ideas with build checklists
  scripts/                       read-only TypeScript checks (viem)
    chains.ts                    Elysium testnet defineChain + HyperEVM re-exports
    read-khype-rate.ts           kHYPE rate, limits, fees, pending withdrawals
    elysium-check.ts             Elysium testnet health and trap checks
    markets-snapshot.ts          Kinetiq HIP-3 dexes, live markets, top of book
    package.json, package-lock.json
```

## Install

Clone the repo first:

```bash
git clone https://github.com/mayorXBT/elysium-skill.git
```

**Claude Code**: copy it into your skills directory. Claude loads it when you mention building on Kinetiq, Elysium, kHYPE or Markets.

```bash
cp -r elysium-skill ~/.claude/skills/kinetiq        # all projects
# or: cp -r elysium-skill .claude/skills/kinetiq    # one repo only
```

**Codex**: copy it to `~/.codex/skills/kinetiq` (or `.agents/skills/kinetiq` inside your repo, depending on your Codex version), or add a line to `AGENTS.md`: "For Kinetiq, Elysium, kHYPE or Markets work, read ./elysium-skill/SKILL.md first."

**Cursor**: put the folder in your repo and add `.cursor/rules/kinetiq.mdc` with: "When working on Kinetiq, Elysium, kHYPE or Markets by Kinetiq, read elysium-skill/SKILL.md and follow its rules." You can also attach `elysium-skill/llms.txt` with `@`.

**Grok Build**: put the folder in your project and tell the agent at the start of the session: "Read elysium-skill/SKILL.md and follow it for this project." Attach `llms.txt` for quick lookups.

**Any other agent**: paste `llms.txt` into the context, then point the agent at `SKILL.md`.

## Prompt to paste into your agent

```
You have the Kinetiq skill (elysium-skill/SKILL.md). Read it and the reference file it routes to before writing code.

I want to build: <describe your app in one or two sentences>.

Rules:
- Start on testnet (Elysium testnet 99801 or HyperEVM testnet 998). Tell me which network every command targets.
- Use only addresses from references/contracts.md. If one is missing, tell me instead of guessing.
- Never ask for or write my private key. Use cast wallet import, a browser wallet, or Hardhat config variables.
- Before any transaction, show me the chain, contract, function and amounts, and wait for my yes.
- Run scripts/elysium-check.ts (or the relevant script) first to confirm the network is what we expect.

Plan the project as a checklist (scaffold, contracts, tests, deploy, verify, frontend), then build it step by step.
```

## Highlights

- **Tested gotchas.** 20 traps found by running against live chains, including: viem's `elysiumTestnet` is a different chain (1338); `block.number` on Elysium returns the HyperEVM block; HyperEVM precompiles and CoreWriter fail silently on Elysium; a plain transfer costs 21,170 gas; `maxStakeAmount` of 0 means no cap; unstaking needs an approval first; contract wrappers receive the kHYPE and withdrawal ids, not the user; the legacy `km` dex is fully delisted and Markets lives on `mkts`.
- **Starter ideas.** Nine app ideas with build checklists: kHYPE rate widget, read-only MCP server, Markets 24/7 terminal, oracle and funding alert bot, stake widget with a wrapper contract, PropAMM on Elysium, token launchpad with a graduation path, bridge tracker, Launch market planner.
- **Read-only scripts.** Three viem scripts that never sign or send:

```bash
cd scripts && npm install
npx tsx read-khype-rate.ts [yourAddress]     # HyperEVM mainnet
npx tsx elysium-check.ts                     # Elysium testnet
npx tsx markets-snapshot.ts mkts mkts:US500  # Hyperliquid API
```

Set `ELYSIUM_RPC_URL` or `HYPEREVM_RPC_URL` to use your own provider. Node 20+ (22+ recommended).

## Verify before use

Items marked "verify before use" or "NOT PUBLISHED" could not be confirmed from an official source as of 24 Oct 2026. That includes Elysium mainnet chain ID, RPC and addresses (mainnet is announced for 9 Nov 2026), Kinetiq Launch factory addresses, and the builder revenue allocation formula. When Elysium mainnet ships, update `references/contracts.md` from https://elysium.kinetiq.xyz/docs/contract-addresses. Always confirm addresses on the official docs before moving funds.

## Disclaimer

Unofficial community project. Not affiliated with, endorsed by, or maintained by Kinetiq. Nothing here is financial advice. Use at your own risk.

## License

MIT. See [LICENSE](LICENSE).

## Credit

Built by Mayor ([@mayorxbt](https://x.com/mayorxbt)).
