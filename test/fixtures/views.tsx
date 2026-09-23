import React from 'react'
import { createRoot } from 'react-dom/client'
import '../../css/index.css'
import '../../css/features.css'
import { ok, type Outcome } from '../../src/client/outcome.ts'
import type { KgView } from '../../src/client/kg.ts'
import { SavedViewsSurface } from '../../src/react/features/views/SavedViewsSurface.tsx'
import type { SavedViewsDestination, ViewsServices } from '../../src/react/features/contracts.ts'

/*
 * The Views window with fixed data, for looking at: `node scripts/fixture.mjs views`. The host box is
 * sized like a desk window so the one-scroller layout is judged at the size it ships at.
 */

let views: KgView[] = [
  {
    name: 'open_invoices_by_customer', source: 'ledger', materialized: false,
    description: 'Unpaid bills grouped by the organization that owes them.',
    cypher: [
      'MATCH (o:Organization)<-[:BILLED_BY]-(b:Bill)',
      "WHERE b.status <> 'paid' AND b.amount >= $minDue",
      'OPTIONAL MATCH (o)-[:IN_INDUSTRY]->(i:Industry)',
      'RETURN o.name AS customer, i.name AS industry, count(b) AS openInvoices,',
      '       sum(b.amount) AS totalDue, min(b.due) AS oldestDue',
      'ORDER BY totalDue DESC',
    ].join('\n'),
    params: { minDue: { type: 'number', default: 500, description: 'Only customers owing at least this much' } },
  },
  {
    name: 'overdue_over_60_days', source: 'saved', materialized: false, description: 'Bills more than 60 days past due.',
    cypher: 'MATCH (b:Bill)-[:BILLED_BY]->(o:Organization)\nWHERE b.status <> \'paid\'\nRETURN o.name AS customer, b.amount AS amount, b.due AS due\nLIMIT $limit',
    params: { limit: { type: 'int', default: 50 } },
  },
  { name: 'meetings_this_week', materialized: false, description: 'Meetings on the calendar this week.', cypher: 'MATCH (m:Meeting) RETURN m', params: {} },
]

const names = ['Acme Freight', 'Birchline Studio', 'Corvid Analytics', 'Delta Orchard', 'Emberfield Energy', 'Fathom Marine',
  'Glasshouse Labs', 'Harbour & Vine', 'Ironbark Civil', 'Juniper Health', 'Kestrel Aero', 'Lumen Retail', 'Meridian Legal',
  'Northgate Foods', 'Orbit Logistics', 'Pinecrest Schools', 'Quarry Row Builders', 'Redfern Media', 'Saltmarsh Brewing',
  'Tidewater Insurance', 'Umber Textiles', 'Vantage Mining', 'Willow Creek Dairy', 'Xylo Instruments', 'Yarra Bikes',
  'Zenith Clinics', 'Ashgrove Motors', 'Bluewren Travel', 'Cedar & Stone', 'Driftwood Cafés', 'Eastwind Solar', 'Foxglove Pharmacy']
const rows = names.map((customer, i) => ({
  customer, industry: ['Logistics', 'Design', 'Software', 'Agriculture', 'Energy'][i % 5], openInvoices: 1 + (i * 7) % 9,
  totalDue: 48000 - i * 1350, oldestDue: `2026-0${1 + (i % 8)}-1${i % 9}`, currency: 'AUD', region: ['NSW', 'VIC', 'QLD', 'WA'][i % 4],
  contact: ['A. Nakamura', 'B. Okafor', 'C. Lindqvist', 'D. Moreau'][i % 4], lastEmailed: `2026-09-${10 + (i % 12)}`,
  accountOwner: ['E. Haddad', 'F. Castillo', 'G. Petrov'][i % 3], meetingsQtd: i % 6,
}))
const result = (label: string): Outcome<any> => ok({ rows: rows.map((row) => ({ ...row, via: label })), rowCount: rows.length, durationMs: 42 })

let route: string | null = 'open_invoices_by_customer'
const listeners = new Set<() => void>()
const services: ViewsServices = {
  kg: {
    views: async () => ok(views),
    schema: async () => ok({ labels: [], relationships: [] } as any),
    runView: async () => result('saved'),
    execute: async () => result('edited'),
    saveView: async (spec) => {
      views = [...views.filter((v) => v.name !== spec.name), { ...spec, source: 'saved', params: spec.params ?? {}, description: spec.description ?? '', materialized: false } as KgView]
      return ok({ ok: true, name: spec.name })
    },
    viewInvocation: async () => ok({ name: 'x', cypher: 'RETURN 1' }),
    deleteView: async () => ok({ deleted: true } as any),
    refreshView: async () => ok({ refreshed: true } as any),
  } as ViewsServices['kg'],
  watches: {
    list: async () => ok([]), create: async () => ok({} as any), delete: async () => ok(undefined), run: async () => ok(undefined),
    runs: async () => ok([]), changes: async () => ok([]), deliveries: async () => ok([]),
  },
}
const host = {
  selectedView: () => route,
  subscribeSelection: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener) } },
  navigateToView: (name: string | null, destination: SavedViewsDestination) => { route = name ? `${name}${destination === 'open' ? '' : `/${destination}`}` : null },
  onOpenInStudio() {},
  onCreateHandler() {},
}

const style = document.createElement('style')
style.textContent = `
  html, body { margin: 0; background: #070a12; }
  .fixture-window { width: 1000px; height: 600px; min-width: 720px; min-height: 480px; margin: 24px; padding: 12px;
    resize: both; overflow: hidden; box-sizing: border-box; border: 1px solid #1f2a40; border-radius: 12px; }
  .fixture-window > .viewspage-selected { height: 100%; min-height: 0; }
`
document.head.append(style)
const root = document.querySelector('#root')
if (root) {
  root.className = 'fixture-window'
  createRoot(root).render(<SavedViewsSurface services={services} host={host} />)
}
