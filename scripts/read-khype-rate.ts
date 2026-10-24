// Read-only: reads kHYPE <-> HYPE exchange rate and StakingManager parameters on HyperEVM mainnet.
// Addresses and ABI fragments are taken from https://kinetiq.xyz/docs/integration
// and https://kinetiq.xyz/docs/contracts-and-audits. No private key, no transactions.
// Run: npx tsx read-khype-rate.ts [optionalUserAddress]
import { createPublicClient, formatEther, http, parseAbi, parseEther, isAddress } from 'viem'
import { hyperEvm } from 'viem/chains' // id 999, https://rpc.hyperliquid.xyz/evm

const KHYPE = '0xfD739d4e423301CE9385c1fb8850539D657C296D'
const STAKING_MANAGER = '0x393D0B87Ed38fc779FD9611144aE649BA6082109'
const STAKING_ACCOUNTANT = '0x9209648Ec9D448EF57116B73A2f081835643dc7A'

const accountantAbi = parseAbi([
  'function HYPEToKHYPE(uint256 HYPEAmount) view returns (uint256)',
  'function kHYPEToHYPE(uint256 kHYPEAmount) view returns (uint256)',
])
const managerAbi = parseAbi([
  'function minStakeAmount() view returns (uint256)',
  'function maxStakeAmount() view returns (uint256)',
  'function stakingLimit() view returns (uint256)',
  'function totalStaked() view returns (uint256)',
  'function withdrawalDelay() view returns (uint256)',
  'function unstakeFeeRate() view returns (uint256)',
  'function nextWithdrawalId(address user) view returns (uint256)',
  'function withdrawalRequests(address user, uint256 id) view returns ((uint256 hypeAmount, uint256 kHYPEAmount, uint256 kHYPEFee, uint256 bufferUsed, uint256 timestamp))',
])
const erc20Abi = parseAbi([
  'function totalSupply() view returns (uint256)',
  'function balanceOf(address) view returns (uint256)',
])

const client = createPublicClient({ chain: hyperEvm, transport: http(process.env.HYPEREVM_RPC_URL) })

async function main() {
  const one = parseEther('1')
  const read = (address: `0x${string}`, abi: any, functionName: string, args: any[] = []) =>
    client.readContract({ address, abi, functionName, args }) as Promise<bigint>

  const [hypePerKhype, khypePerHype, minStake, maxStake, limit, totalStaked, delay, feeBps, supply] =
    await Promise.all([
      read(STAKING_ACCOUNTANT, accountantAbi, 'kHYPEToHYPE', [one]),
      read(STAKING_ACCOUNTANT, accountantAbi, 'HYPEToKHYPE', [one]),
      read(STAKING_MANAGER, managerAbi, 'minStakeAmount'),
      read(STAKING_MANAGER, managerAbi, 'maxStakeAmount'),
      read(STAKING_MANAGER, managerAbi, 'stakingLimit'),
      read(STAKING_MANAGER, managerAbi, 'totalStaked'),
      read(STAKING_MANAGER, managerAbi, 'withdrawalDelay'),
      read(STAKING_MANAGER, managerAbi, 'unstakeFeeRate'),
      read(KHYPE, erc20Abi, 'totalSupply'),
    ])

  console.log(`block               ${await client.getBlockNumber()}`)
  console.log(`1 kHYPE  -> HYPE    ${formatEther(hypePerKhype)}`)
  console.log(`1 HYPE   -> kHYPE   ${formatEther(khypePerHype)}`)
  console.log(`minStakeAmount      ${formatEther(minStake)} HYPE`)
  console.log(`maxStakeAmount      ${formatEther(maxStake)} HYPE`)
  console.log(`stakingLimit        ${formatEther(limit)} HYPE`)
  console.log(`totalStaked         ${formatEther(totalStaked)} HYPE`)
  console.log(`kHYPE totalSupply   ${formatEther(supply)}`)
  console.log(`withdrawalDelay     ${delay} s (${Number(delay) / 86400} days, contract delay only)`)
  console.log(`unstakeFeeRate      ${feeBps} bps`)

  const user = process.argv[2]
  if (user && isAddress(user)) {
    const bal = await read(KHYPE, erc20Abi, 'balanceOf', [user])
    const next = await read(STAKING_MANAGER, managerAbi, 'nextWithdrawalId', [user])
    console.log(`\n${user}\nkHYPE balance       ${formatEther(bal)}\nnextWithdrawalId    ${next}`)
    const now = BigInt(Math.floor(Date.now() / 1000))
    for (let id = 0n; id < next; id++) {
      const r: any = await client.readContract({ address: STAKING_MANAGER, abi: managerAbi, functionName: 'withdrawalRequests', args: [user, id] })
      if (r.timestamp === 0n) continue // confirmed or empty
      const readyAt = r.timestamp + delay
      console.log(`  id ${id}: ${formatEther(r.hypeAmount)} HYPE, ${now >= readyAt ? 'READY to confirm' : `ready in ${Number(readyAt - now) / 3600} h`}`)
    }
  }
}
main().catch((e) => { console.error(e); process.exit(1) })
