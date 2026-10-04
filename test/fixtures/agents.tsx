import React from 'react'
import { createRoot } from 'react-dom/client'
import '../../css/index.css'
import '../../css/features.css'
import { ok } from '../../src/client/outcome.ts'
import type { Agent } from '../../src/client/agents.ts'
import type { Upcoming } from '../../src/client/agentRuns.ts'
import { AgentsSurface } from '../../src/react/features/agents/AgentsSurface.tsx'
import type { AgentsServices } from '../../src/react/features/contracts.ts'

/*
 * The Agents window with fixed data, for looking at: `node scripts/fixture.mjs agents`. Two agents
 * that only talk, one available and one waiting on its sponsor, beside a worker with a persona, so
 * the conversational card is judged next to the card it simplifies. `#chaser` or `#onboarding-buddy` in
 * the URL opens that one first.
 */

const base: Pick<Agent, 'owners' | 'operators' | 'state' | 'origin' | 'duties' | 'needs' | 'signedBy' | 'signedAt'> = {
  owners: ['priya'], operators: [], state: 'active', origin: 'world', duties: [], needs: [],
  signedBy: 'priya', signedAt: '2026-09-29T10:00:00Z',
}

let agents: Agent[] = [
  {
    ...base, name: 'concierge', job: 'Answers questions about the business for staff and customers.',
    routing: 'opening hours, prices, bookings and who to call', persona: 'warm-host', sponsor: 'priya',
    stage: 'on', version: 3, unsignedChanges: ['persona: warm-host → brisk-host'], routines: [],
  },
  {
    ...base, name: 'onboarding-buddy', job: 'Walks new starters through their first week.',
    routing: 'where things are, who does what', persona: 'patient-guide', sponsor: null,
    stage: 'off', version: 0, signedBy: null, signedAt: null, unsignedChanges: [], routines: [],
    needs: ['a sponsor', "its sponsor's signature on version 1"],
  },
  {
    ...base, name: 'chaser', job: 'Chases overdue invoices.', routing: 'late payers', persona: 'warm-host', sponsor: 'priya',
    stage: 'on', version: 1, unsignedChanges: [],
    routines: [{ name: 'note-failure', description: 'Notes a failed payment', trigger: 'every day at 08:00', stage: 'on', firing: 'on', missing: false }],
  },
]

const empty: Upcoming = { agent: '', firings: [], onSignals: [], expected: [], inFlight: [], counts: { runsLastHour: 0, writesToday: 0, requestsToday: 0 } }

const services: AgentsServices = {
  listAgents: async () => ok(agents),
  setStage: async (name, stage) => {
    agents = agents.map((a) => (a.name === name ? { ...a, stage } : a))
    return ok(agents.find((a) => a.name === name)!)
  },
  sign: async (name) => {
    agents = agents.map((a) => (a.name === name ? { ...a, version: a.version + 1, unsignedChanges: [] } : a))
    return ok(agents.find((a) => a.name === name)!)
  },
  versions: async () => ok([]),
  listRuns: async () => ok([]),
  getRun: async () => ok({ receipts: [] } as any),
  upcoming: async () => ok(empty),
}

const style = document.createElement('style')
style.textContent = `html, body { margin: 0; background: #070a12; } #root { padding: 24px; max-width: 1100px; }`
document.head.append(style)
const root = document.querySelector('#root')
if (root) createRoot(root).render(<AgentsSurface services={services} initialAgent={location.hash.slice(1) || undefined} />)
