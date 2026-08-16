import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { HandlersClient } from '../src/client/handlers.ts'
import { ok, type Outcome } from '../src/client/outcome.ts'
import type { RequestSpec, Transport } from '../src/client/transport.ts'

/**
 * The sibling of `kg.test.ts`, and the same rationale: assert the RequestSpec each method
 * produces, because the spec is exactly what the Me app's IPC bridge forwards. A method well
 * shaped here forwards in one line there.
 */
class RecordingTransport implements Transport {
  readonly sent: RequestSpec[] = []
  constructor(private readonly reply: unknown = {}) {}
  async send<T>(spec: RequestSpec): Promise<Outcome<T>> {
    this.sent.push(spec)
    return ok(this.reply as T)
  }
  get last(): RequestSpec {
    const spec = this.sent.at(-1)
    assert.ok(spec, 'nothing was sent')
    return spec
  }
}

const client = (reply: unknown = {}) => {
  const transport = new RecordingTransport(reply)
  return { handlers: new HandlersClient(transport), transport }
}

describe('HandlersClient request shaping', () => {
  /*
   * Every read is a POST. That looks wrong next to `kg.schema()`'s GET and is worth pinning: the
   * server puts the whole surface behind POST because `dry-run` executes submitted code, so if
   * these ever became GETs it would be a server change, not a client tidy-up.
   */
  it('lists over POST, like every read on this surface', async () => {
    const { handlers, transport } = client()
    await handlers.list()
    assert.deepEqual(transport.last, { method: 'POST', path: '/api/v1/admin/handlers/list', body: {} })
  })

  it('names the handler in the query, not the body, for open and delete', async () => {
    const { handlers, transport } = client()
    await handlers.open('greet')
    assert.deepEqual(transport.last, {
      method: 'POST',
      path: '/api/v1/admin/handlers/open',
      query: { name: 'greet' },
      body: {},
    })
    await handlers.delete('greet')
    assert.equal(transport.last.path, '/api/v1/admin/handlers/delete')
    assert.deepEqual(transport.last.query, { name: 'greet' })
  })

  it('leaves escaping to the transport rather than pre-encoding the name', async () => {
    const { handlers, transport } = client()
    await handlers.open('a handler/with slashes')
    // Double-encoding is the classic bug when a caller escapes AND the URLSearchParams does.
    assert.deepEqual(transport.last.query, { name: 'a handler/with slashes' })
  })

  it('validates with the body the server documents', async () => {
    const { handlers, transport } = client()
    await handlers.validate('await gateway.notify("hi")')
    assert.equal(transport.last.path, '/api/v1/admin/handlers/validate')
    assert.deepEqual(transport.last.body, { source: 'await gateway.notify("hi")' })
  })

  it('omits `current` entirely when generating fresh, and sends it when refining', async () => {
    const { handlers, transport } = client()
    await handlers.generate('watch for new PRs')
    // Not `{english, current: undefined}` — that would serialize the key as an explicit null and
    // turn a fresh write into a refinement of nothing.
    assert.deepEqual(transport.last.body, { english: 'watch for new PRs' })
    await handlers.generate('also notify me', 'const x = 1')
    assert.deepEqual(transport.last.body, { english: 'also notify me', current: 'const x = 1' })
  })

  it('gives generation and the dry run budgets longer than the transport default', async () => {
    const { handlers, transport } = client()
    await handlers.generate('anything')
    assert.equal(transport.last.timeoutMs, 120_000)
    await handlers.dryRun('const x = 1')
    assert.equal(transport.last.timeoutMs, 180_000)
    await handlers.save({ name: 'greet', source: 'const x = 1' })
    assert.equal(transport.last.timeoutMs, 60_000)
  })

  it('sends only `source` for a dry run with nothing to steer it', async () => {
    const { handlers, transport } = client()
    await handlers.dryRun('const x = 1')
    assert.deepEqual(transport.last.body, { source: 'const x = 1' })
  })

  it('carries the signal type and the sample when either is given', async () => {
    const { handlers, transport } = client()
    await handlers.dryRun('const x = 1', 'PullRequestOpened')
    assert.deepEqual(transport.last.body, { source: 'const x = 1', signalType: 'PullRequestOpened' })
    await handlers.dryRun('const x = 1', undefined, { id: 'pr-7' })
    assert.deepEqual(transport.last.body, { source: 'const x = 1', sample: { id: 'pr-7' } })
  })

  it('passes a save through as the documented request shape', async () => {
    const { handlers, transport } = client()
    await handlers.save({ name: 'greet', source: 'const x = 1', signalType: 'PullRequestOpened', autonomous: true })
    assert.deepEqual(transport.last.body, {
      name: 'greet',
      source: 'const x = 1',
      signalType: 'PullRequestOpened',
      autonomous: true,
    })
  })

  it('sends the enabled flag as a query value the transport will stringify', async () => {
    const { handlers, transport } = client()
    await handlers.setEnabled('gh-triage', false)
    assert.deepEqual(transport.last.query, { name: 'gh-triage', enabled: false })
  })

  it('sends a blank schedule rather than dropping the parameter — blank IS the clear', async () => {
    const { handlers, transport } = client()
    await handlers.setSchedule('sweep', '')
    // Dropping it would still clear the schedule today (the param is optional server-side), but
    // only by accident. Sending the blank says what was meant.
    assert.deepEqual(transport.last.query, { name: 'sweep', schedule: '' })
  })
})

describe('HandlersClient outcomes', () => {
  it('returns the server payload untouched', async () => {
    const reply = { ok: true, ranAgainst: { signalType: 'CronTick', signalId: 'cron' }, stdout: '', error: null }
    const { handlers } = client(reply)
    const outcome = await handlers.dryRun('const x = 1')
    assert.ok(outcome.ok)
    assert.deepEqual(outcome.value, reply)
  })

  it('keeps `error: null` rather than normalising it away', async () => {
    const { handlers } = client({ ok: true, ranAgainst: { signalType: 'C', signalId: 'c' }, stdout: '', error: null })
    const outcome = await handlers.dryRun('const x = 1')
    assert.ok(outcome.ok)
    // Consumers branch on the KEY's presence; a client that stripped nulls would break that.
    assert.ok('error' in outcome.value)
  })
})
