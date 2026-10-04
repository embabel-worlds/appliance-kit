/*
 * An agent's declared limits in a line a sponsor can read (#1783). Only what is declared is said:
 * an agent with no budget has no limits to show, and saying "unlimited" would read as a choice.
 */

import type { Agent } from '../../../client/agents.ts'

function dollars(cents: number): string {
  return cents % 100 === 0 ? `$${cents / 100}` : `$${(cents / 100).toFixed(2)}`
}

export function limitsOf(agent: Agent): string[] {
  const b = agent.budget ?? {}
  const out: string[] = []
  if (b.spendPerRunCents != null) out.push(`${dollars(b.spendPerRunCents)} a run`)
  if (b.spendPerDayCents != null) out.push(`${dollars(b.spendPerDayCents)} a day`)
  if (b.runsPerHour != null) out.push(`${b.runsPerHour} runs an hour`)
  if (b.concurrentRuns != null) out.push(`${b.concurrentRuns} at once`)
  if (b.requestsPerRun != null) out.push(`${b.requestsPerRun} requests a run`)
  if (b.writesPerDay != null) out.push(`${b.writesPerDay} writes a day`)
  if (b.expiresOn) out.push(`until ${b.expiresOn}`)
  for (const [bucket, share] of Object.entries(b.sourceShares ?? {})) {
    out.push(bucket === '*' ? `${share}% of any other source` : `${share}% of ${bucket}`)
  }
  const q = agent.qos
  if (q?.priority && q.priority !== 'business') out.push(`${q.priority} priority`)
  for (const [role, model] of Object.entries(q?.fallbacks ?? {})) out.push(`${role} falls back to ${model}`)
  return out
}
