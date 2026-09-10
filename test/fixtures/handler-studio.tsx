import React from 'react'
import { createRoot } from 'react-dom/client'
import '../../css/index.css'
import '../../css/features.css'
import { ok } from '../../src/client/outcome.ts'
import { HandlerStudioSurface } from '../../src/react/features/handlers/HandlerStudioSurface.tsx'
import type { HandlerStudioServices } from '../../src/react/features/contracts.ts'

const actions = [
  {
    name: 'Observe invoices', description: 'Observe overdue invoices', source: "console.log(signal?.invoiceId)",
    signalType: 'InvoiceOverdue', schedule: '0 0 9 * * *', autonomous: false, active: false,
    inputTypeNames: ['Invoice'], outputTypeName: 'void', skills: ['collections'],
  },
  {
    name: 'Act on reviews', description: 'Prepare review follow-up', source: "console.log(signal?.repository)",
    signalType: 'PullRequestReviewed', schedule: undefined, autonomous: false, active: true,
    inputTypeNames: ['PullRequest'], outputTypeName: 'void', skills: ['issues'],
  },
  {
    name: 'Running digest', description: 'Send the daily digest', source: "console.log('digest')",
    signalType: '*', schedule: '0 0 8 * * *', autonomous: true, active: true,
    inputTypeNames: [], outputTypeName: 'void', skills: [],
  },
]
let available = [{ name: 'Realm follow-up', signalType: 'CustomerNeedsReply' }]

function note(text: string) {
  const output = document.querySelector('#fixture-events')
  if (output) output.textContent = text
}

const services: HandlerStudioServices = {
  kg: { schema: async () => ok({ labels: [], relationships: [] }) },
  handlers: {
    list: async () => ok({
      yours: actions.map((action) => ({
        ...action,
        inputTypeNames: [...action.inputTypeNames],
        skills: [...action.skills],
      })),
      available: available.map((action) => ({ ...action })),
    }),
    open: async (name) => {
      const found = actions.find((action) => action.name === name)
      return found
        ? ok({ ...found, inputTypeNames: [...found.inputTypeNames], skills: [...found.skills] })
        : { ok: false, kind: 'refused', message: `No agent named ${name}`, status: 400 }
    },
    validate: async () => ok({ valid: true, violations: [], durationMs: 4, ok: true }),
    dryRun: async () => ok({ ok: true, stdout: 'Fixture dry run', ranAgainst: { signalType: 'fixture', signalId: 'sample-1' } }),
    setEnabled: async (name, enabled) => {
      const action = actions.find((candidate) => candidate.name === name)
      if (action) action.active = enabled
      else {
        const adopted = available.find((candidate) => candidate.name === name)
        if (adopted) {
          actions.push({ ...adopted, description: name, source: "console.log('adopted')", schedule: undefined,
            autonomous: false, active: enabled, inputTypeNames: [], outputTypeName: 'void', skills: [] })
          available = available.filter((candidate) => candidate.name !== name)
        }
      }
      note(`${name}: ${enabled ? 'watching' : 'stood down'}`)
      return ok({ ok: true, name, enabled })
    },
    delete: async () => ok({ ok: true, message: 'deleted' }),
  },
  generateHandler: async () => ok({ source: "console.log('generated')", valid: true, attempts: 1, durationMs: 1, ok: true, violations: [] }),
  saveHandler: async (request) => {
    const index = actions.findIndex((action) => action.name === request.name)
    const active = index >= 0 ? actions[index]!.active : false
    const saved = { ...request, active, signalType: request.signalType ?? '*', autonomous: request.autonomous ?? false,
      description: request.description ?? request.name, schedule: request.schedule, inputTypeNames: request.inputTypeNames ?? [],
      outputTypeName: request.outputTypeName ?? 'void', skills: request.skills ?? [] }
    if (index >= 0) actions[index] = saved
    else actions.push(saved)
    note(`${request.name}: saved in place`)
    return ok({ ok: true, message: 'Saved in fixture.' })
  },
  gatewayInterfaces: async () => ok('export interface GatewayContext {}'),
  signalTypes: async () => ok([
    { typeName: 'InvoiceOverdue', fields: ['invoiceId', 'customerId', 'amount'], count: 23, lastSeen: '2026-09-08T08:00:00Z' },
    { typeName: 'PullRequestReviewed', fields: ['repository', 'reviewer', 'decision'], count: 7, lastSeen: '2026-09-07T18:00:00Z' },
  ]),
  worldSkills: async () => ok([{ name: 'collections', description: 'Safe collections workflow' }]),
}

createRoot(document.querySelector('#root')!).render(
  <React.StrictMode>
    <header style={{ padding: '16px 20px 0' }}>
      <strong>Deterministic Agents review fixture</strong>
      <p className="hint">No appliance or DevTools overrides. Mutations: <output id="fixture-events">none</output></p>
    </header>
    <HandlerStudioSurface services={services} />
  </React.StrictMode>,
)
