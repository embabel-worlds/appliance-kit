import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { runGate, verdictOf } from '../src/react/features/query/runGate.ts'

/*
 * WHEN QUERY STUDIO'S RUN BUTTON MAY BE PRESSED.
 *
 * Only the engine's verdict that a query breaks the schema may hold Run back. A preflight that
 * could not REACH a verdict — absent, signed out, unreachable, failing — says nothing about the
 * query, and treating its silence as a "no" left Run dead with a blank pill. The run itself
 * reports whatever the engine finds wrong.
 */
const failure = (kind: 'unsupported' | 'unauthorized' | 'refused' | 'unreachable' | 'failed', message: string, status?: number) =>
  ({ ok: false as const, kind, message, ...(status === undefined ? {} : { status }) })
const verdict = (ok: boolean, violations: string[] = []) => ({ ok: true as const, value: { ok, violations } })

describe('the Run gate', () => {
  const q = 'MATCH (n) RETURN n'

  it('opens on a schema-valid verdict for the text in the editor', () => {
    const gate = runGate(verdictOf(q, verdict(true)), q, false)
    assert.deepEqual(gate, { enabled: true, tone: 'ok', text: '✓ schema-valid', violations: [] })
  })

  it('stays shut on a verdict about text the editor no longer holds', () => {
    assert.equal(runGate(verdictOf(q, verdict(true)), 'MATCH (m) RETURN m', false).enabled, false)
    assert.equal(runGate(verdictOf(q, verdict(false, ['x'])), 'MATCH (m) RETURN m', false).enabled, false)
  })

  it('stays shut on schema violations, and says how many', () => {
    const gate = runGate(verdictOf(q, verdict(false, ['no such label', 'no such property'])), q, false)
    assert.equal(gate.enabled, false)
    assert.equal(gate.tone, 'error')
    assert.equal(gate.text, '2 schema problem(s)')
    assert.deepEqual(gate.violations, ['no such label', 'no such property'])
  })

  it('fails open when the appliance cannot be reached, naming why', () => {
    const gate = runGate(verdictOf(q, failure('unreachable', 'The appliance did not answer within 30000ms')), q, false)
    assert.equal(gate.enabled, true)
    assert.equal(gate.tone, 'caution')
    assert.match(gate.text, /couldn't validate/)
    assert.match(gate.text, /did not answer within 30000ms/)
    assert.match(gate.text, /Run will ask the engine directly/)
  })

  it('fails open on a rejected session, naming the status', () => {
    const gate = runGate(verdictOf(q, failure('unauthorized', 'Session expired', 401)), q, false)
    assert.equal(gate.enabled, true)
    assert.match(gate.text, /HTTP 401/)
    assert.match(gate.text, /Session expired/)
  })

  it('fails open on a forbidden or failing preflight', () => {
    for (const outcome of [failure('unauthorized', '', 403), failure('failed', 'boom', 503), failure('refused', 'bad body', 400)]) {
      const gate = runGate(verdictOf(q, outcome), q, false)
      assert.equal(gate.enabled, true, `${outcome.kind} ${outcome.status}`)
      assert.match(gate.text, new RegExp(`HTTP ${outcome.status}`))
      assert.deepEqual(gate.violations, [])
    }
  })

  it('opens for every later text once the appliance has no preflight at all', () => {
    const absent = verdictOf(q, failure('unsupported', 'Not Found', 404))
    const now = runGate(absent, q, false)
    assert.equal(now.enabled, true)
    assert.notEqual(now.text, '', 'never a blank pill')
    assert.match(now.text, /Run will ask the engine directly/)
    assert.equal(runGate(absent, 'MATCH (m) RETURN m', false).enabled, true, 'a later edit is not waiting on a verdict that will never come')
  })

  it('holds Run while a verdict is on its way', () => {
    assert.deepEqual(runGate({ state: 'pending' }, q, false), { enabled: false, tone: null, text: '…', violations: [] })
  })

  it('never opens while a run is in flight, or with nothing to run', () => {
    for (const v of [verdictOf(q, verdict(true)), verdictOf(q, failure('unsupported', '', 404)), verdictOf(q, failure('failed', '', 500))]) {
      assert.equal(runGate(v, q, true).enabled, false)
      assert.equal(runGate(v, '', false).enabled, false)
    }
  })
})
