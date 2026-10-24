// Read-only snapshot of Markets by Kinetiq HIP-3 perps via Hyperliquid's public info API.
// No API key, no signing. Source for request shapes:
// https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/info-endpoint
// Run: npx tsx markets-snapshot.ts [dex] [coin]   e.g. npx tsx markets-snapshot.ts mkts mkts:US500
const INFO = 'https://api.hyperliquid.xyz/info'
const KMHYPE_STAKING_MANAGER = '0x71f0019cc7fa79e4f42587fb7b9a817d8d2429ec' // kinetiq.xyz/docs/contracts-and-audits

async function info<T>(body: unknown): Promise<T> {
  const r = await fetch(INFO, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
  if (!r.ok) throw new Error(`info ${JSON.stringify(body)} -> HTTP ${r.status}`)
  return r.json() as Promise<T>
}

async function main() {
  const dex = process.argv[2] ?? 'mkts'
  const dexes = await info<any[]>({ type: 'perpDexs' })
  const kinetiqDexes = dexes.filter((d) => d && d.deployer?.toLowerCase() === KMHYPE_STAKING_MANAGER)
  console.log('HIP-3 dexes deployed by the kmHYPE StakingManager:', kinetiqDexes.map((d) => `${d.name} (${d.fullName})`).join(', '))

  const [meta, ctxs] = await info<[any, any[]]>({ type: 'metaAndAssetCtxs', dex })
  console.log(`\ndex=${dex} collateralToken=${meta.collateralToken} (spot token index; 0 = USDC)`)
  meta.universe.forEach((u: any, i: number) => {
    const c = ctxs[i]
    const status = u.isDelisted ? 'DELISTED' : 'live'
    console.log(`${u.name.padEnd(16)} ${status.padEnd(8)} maxLev ${String(u.maxLeverage).padEnd(3)} ${u.onlyIsolated ? 'isolated-only ' : ''}mark ${c.markPx} 24hVol ${Number(c.dayNtlVlm).toFixed(0)} OI ${c.openInterest} funding ${c.funding}`)
  })

  const coin = process.argv[3] ?? meta.universe.find((u: any) => !u.isDelisted)?.name
  if (coin) {
    const book = await info<any>({ type: 'l2Book', coin })
    const [bids, asks] = book.levels
    console.log(`\n${coin} top of book: bid ${bids[0]?.px ?? '-'} x ${bids[0]?.sz ?? '-'} | ask ${asks[0]?.px ?? '-'} x ${asks[0]?.sz ?? '-'}`)
  }
}
main().catch((e) => { console.error(e); process.exit(1) })
