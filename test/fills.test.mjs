import assert from 'node:assert/strict'
import test from 'node:test'
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { JSDOM } from 'jsdom'
import { FillsSurface } from '../dist/esm/react/features/fills/FillsSurface.js'
import { FillsClient, coveragePercent, coverageWords, fillStatusWords } from '../dist/esm/client/fills.js'

/*
 * What a sweep is allowed to claim.
 *
 * The server refuses to invent a denominator it does not have, and the whole value of this surface
 * is that it does not undo that refusal on the way to the screen. So the tests that matter are the
 * negative ones: no bar, no percentage, and no zero standing in for "unknown".
 */

const dom = new JSDOM('<div id="root"></div>')
for (const key of ['window', 'document', 'navigator']) {
  Object.defineProperty(globalThis, key, { value: dom.window[key], configurable: true })
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true

const progress = (over) => ({
  state: 'RUNNING',
  ticks: 7,
  liveCallsTotal: 120,
  liveCallsLastTick: 12,
  trend: 'CONVERGING',
  createdAt: 1_760_000_000_000,
  lastTickAt: 1_760_000_600_000,
  coverage: { keysResolved: 0, totality: 'UNKNOWN' },
  ...over,
})

const fill = (over = {}) => ({
  id: 'fill_abc',
  userId: 'u1',
  cypher: 'MATCH (c:Customer) RETURN c.id, classify(c.notes, "at-risk,fine")',
  label: 'CRM risk sweep',
  budgetPerTick: 60,
  ...over,
  progress: progress(over.progress ?? {}),
})

/** Render the surface over a fixed list and hand back the DOM, effects already flushed. */
async function render(fills) {
  const host = dom.window.document.createElement('div')
  dom.window.document.body.appendChild(host)
  const services = {
    listFills: async () => ({ ok: true, value: fills }),
    cancelFill: async () => ({ ok: true, value: undefined }),
  }
  await act(async () => {
    createRoot(host).render(React.createElement(FillsSurface, { services, refreshMs: 0 }))
  })
  return host
}

test('a sweep with a denominator shows a percentage, and one without shows none', async () => {
  const known = await render([
    fill({ progress: { coverage: { keysResolved: 12_400, keysTotal: 40_000, fractionResolved: 0.31, totality: 'KNOWN' } } }),
  ])
  const bar = known.querySelector('[role=progressbar]')
  assert.ok(bar, 'a known total should draw a bar')
  assert.equal(bar.getAttribute('aria-valuenow'), '31')
  assert.match(known.textContent, /12,400 of 40,000 \(31%\)/)
  // The bar is filled to the figure, not to a guess.
  assert.match(known.querySelector('.fill-bar-filled').getAttribute('style').replace(/\s/g, ''), /^width:31%;?$/)

  const unknown = await render([fill({ progress: { coverage: { keysResolved: 4_182, totality: 'UNKNOWN' } } })])
  assert.equal(unknown.querySelector('[role=progressbar]'), null, 'no denominator must mean no bar')
  assert.match(unknown.textContent, /4,182 assessed \(total unknown\)/)
  // Nothing anywhere may read as a percentage, and 0 must not stand in for unknown.
  assert.doesNotMatch(unknown.textContent, /%/)
  assert.doesNotMatch(unknown.textContent, /of 0\b/)
})

test('coverage is dated as a reading, because each tick replaces it rather than adding to it', async () => {
  const host = await render([
    fill({ progress: { coverage: { keysResolved: 10, keysTotal: 20, fractionResolved: 0.5, totality: 'KNOWN' } } }),
  ])
  assert.match(host.textContent, /as at /)
})

test('coveragePercent refuses rather than divides', () => {
  assert.equal(coveragePercent({ keysResolved: 3, totality: 'UNKNOWN' }), null)
  // A total that arrived anyway does not override the discriminator.
  assert.equal(coveragePercent({ keysResolved: 3, keysTotal: 9, totality: 'UNKNOWN' }), null)
  assert.equal(coveragePercent({ keysResolved: 0, keysTotal: 0, totality: 'KNOWN' }), null, 'no divide by zero')
  // KNOWN without the server's fraction still answers, from the pair.
  assert.equal(coveragePercent({ keysResolved: 1, keysTotal: 3, totality: 'KNOWN' }), 33)
  // The server's own fraction wins where both are present.
  assert.equal(coveragePercent({ keysResolved: 1, keysTotal: 3, fractionResolved: 0.9, totality: 'KNOWN' }), 90)
  assert.match(coverageWords({ keysResolved: 7, totality: 'UNKNOWN' }), /total unknown/)
})

test('a fill that cannot converge is not reported as stuck or failed', async () => {
  assert.equal(fillStatusWords(fill({ progress: { trend: 'NOT_CONVERGING' } })), 'polling, not progressing')
  assert.equal(fillStatusWords(fill({ progress: { state: 'DONE' } })), 'complete')
  assert.equal(fillStatusWords(fill({ progress: { state: 'CANCELLED' } })), 'cancelled')

  const host = await render([
    fill({
      warning: 'this fill will poll rather than converge: crime.months (ttl 60s).',
      progress: { trend: 'NOT_CONVERGING' },
    }),
  ])
  assert.match(host.textContent, /polling, not progressing/)
  assert.match(host.textContent, /crime\.months \(ttl 60s\)/)
})

test('a failed pass on a running sweep reads as a retry, not a death', async () => {
  const host = await render([fill({ progress: { lastError: 'source rate-limited' } })])
  assert.match(host.textContent, /Last failure \(retrying\): source rate-limited/)
  const done = await render([fill({ progress: { state: 'DONE', lastError: 'source rate-limited' } })])
  assert.match(done.textContent, /Failed: source rate-limited/)
})

test('the scheduler heartbeat is never shown as progress', async () => {
  const host = await render([
    fill({ progress: { ticks: 999, coverage: { keysResolved: 5, keysTotal: 10, fractionResolved: 0.5, totality: 'KNOWN' } } }),
  ])
  assert.doesNotMatch(host.textContent, /999/)
})

test('FillsClient speaks the admin fills route, escaping the id', async () => {
  const sent = []
  const transport = {
    async send(spec) {
      sent.push(spec)
      return { ok: true, value: [] }
    },
  }
  const fills = new FillsClient(transport)
  await fills.list()
  await fills.start({ cypher: 'MATCH (n) RETURN n', budgetPerTick: 60, label: 'sweep' })
  await fills.cancel('fill a/b')
  assert.deepEqual(sent, [
    { method: 'GET', path: '/api/v1/admin/kg/fills' },
    { method: 'POST', path: '/api/v1/admin/kg/fills', body: { cypher: 'MATCH (n) RETURN n', budgetPerTick: 60, label: 'sweep' } },
    { method: 'DELETE', path: '/api/v1/admin/kg/fills/fill%20a%2Fb' },
  ])
})
