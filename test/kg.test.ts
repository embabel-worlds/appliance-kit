import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { KgClient, isBackgroundHandle } from '../src/client/kg.ts'
import { ok, type Outcome } from '../src/client/outcome.ts'
import type { RequestSpec, Transport } from '../src/client/transport.ts'

/**
 * Records the RequestSpec each method produces. The point of testing against the spec rather than
 * a URL string is that the spec is exactly what the Me app's IPC bridge will forward — if a method
 * is well shaped here, it forwards in one line there.
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
  return { kg: new KgClient(transport), transport }
}

describe('KgClient request shaping', () => {
  it('reads the schema', async () => {
    const { kg, transport } = client()
    await kg.schema()
    assert.deepEqual(transport.last, { method: 'GET', path: '/api/v1/admin/kg/schema' })
  })

  it('validates without executing', async () => {
    const { kg, transport } = client()
    await kg.validate('MATCH (n) RETURN n')
    assert.equal(transport.last.method, 'POST')
    assert.equal(transport.last.path, '/api/v1/admin/kg/validate')
    assert.deepEqual(transport.last.body, { cypher: 'MATCH (n) RETURN n' })
  })

  it('gives generation a longer budget than the transport default', async () => {
    const { kg, transport } = client()
    await kg.generate('who do I know')
    assert.equal(transport.last.timeoutMs, 120_000)
  })

  it('gives execution the longest budget — a cold materialize is not interactive-fast', async () => {
    const { kg, transport } = client()
    await kg.execute('MATCH (n) RETURN n')
    assert.equal(transport.last.timeoutMs, 180_000)
  })

  it('sends no mode flags for a plain synchronous execution', async () => {
    const { kg, transport } = client()
    await kg.execute('MATCH (n) RETURN n')
    assert.deepEqual(transport.last.query, {})
  })

  it('asks for a background run', async () => {
    const { kg, transport } = client()
    await kg.execute('MATCH (n) RETURN n', { background: true })
    assert.deepEqual(transport.last.query, { background: true })
  })

  it('asks for a watched run', async () => {
    const { kg, transport } = client()
    await kg.execute('MATCH (n) RETURN n', { waitSeconds: 5 })
    assert.deepEqual(transport.last.query, { waitSeconds: 5 })
  })

  it('encodes run and view names into the path', async () => {
    const { kg, transport } = client()
    await kg.run('run/with slash')
    assert.equal(transport.last.path, '/api/v1/admin/kg/runs/run%2Fwith%20slash')

    await kg.deleteView('my view')
    assert.equal(transport.last.path, '/api/v1/admin/kg/views/my%20view')
    assert.equal(transport.last.method, 'DELETE')
  })

  it('invokes a view with no arguments as an empty map, not a missing body', async () => {
    const { kg, transport } = client()
    await kg.viewInvocation('top_customers')
    assert.deepEqual(transport.last.body, { args: {} })
  })

  it('answers a parked run', async () => {
    const { kg, transport } = client()
    await kg.answer('r1', 'proceed')
    assert.equal(transport.last.path, '/api/v1/admin/kg/runs/r1/answer')
    assert.deepEqual(transport.last.body, { choice: 'proceed' })
  })
})

describe('the two shapes /execute can answer with', () => {
  it('recognises a background handle', async () => {
    const { kg } = client({ runId: 'bg1', state: 'RUNNING' })
    const outcome = await kg.execute('MATCH (n) RETURN n', { background: true })
    assert.ok(outcome.ok)
    assert.equal(isBackgroundHandle(outcome.value), true)
  })

  it('recognises a finished result', async () => {
    const { kg } = client({
      rowCount: 1,
      apiCalls: 0,
      apiCallLog: [],
      llmCalls: 0,
      llmCallLog: [],
      durationMs: 3,
      error: null,
      cypher: 'MATCH (n) RETURN n',
      rows: [{ n: 'Alice' }],
    })
    const outcome = await kg.execute('MATCH (n) RETURN n')
    assert.ok(outcome.ok)
    assert.equal(isBackgroundHandle(outcome.value), false)
  })

  /*
   * A watched result that has not finished carries a `run` handle and NO rows. The empty array
   * means "not yet", never "the graph has nothing" — the one misreading that turns a slow query
   * into a wrong answer on screen.
   */
  it('a watched result with a run handle is not an empty answer', async () => {
    const { kg } = client({
      rowCount: 0,
      apiCalls: 0,
      apiCallLog: [],
      llmCalls: 0,
      llmCallLog: [],
      durationMs: 5000,
      error: null,
      cypher: 'MATCH (n) RETURN n',
      rows: [],
      run: { runId: 'r9', state: 'RUNNING', poll: '/api/v1/admin/kg/runs/r9' },
    })
    const outcome = await kg.execute('MATCH (n) RETURN n', { waitSeconds: 5 })
    assert.ok(outcome.ok)
    assert.equal(isBackgroundHandle(outcome.value), false)
    const result = outcome.value as { rows: unknown[]; run?: { runId: string } }
    assert.equal(result.rows.length, 0)
    assert.equal(result.run?.runId, 'r9', 'the handle is how a UI knows the rows are not an answer')
  })
})

/*
 * The three operations the surface gained after this client's first snapshot. Added here rather
 * than in a new file because they are the same client — and their absence for a while is exactly
 * the drift the regeneration step exists to catch.
 */
describe('KgClient — the later additions', () => {
  it('refines from the existing cypher rather than regenerating around it', async () => {
    const { kg, transport } = client()
    await kg.refine('MATCH (n) RETURN n', 'only since March')
    assert.equal(transport.last.path, '/api/v1/admin/kg/refine')
    assert.deepEqual(transport.last.body, { cypher: 'MATCH (n) RETURN n', instruction: 'only since March' })
    assert.equal(transport.last.timeoutMs, 120_000)
  })

  it('puts label and property in the PATH, encoded — they are path segments, not query values', async () => {
    const { kg, transport } = client()
    await kg.propertyValues('Person', 'role')
    assert.deepEqual(transport.last, {
      method: 'GET',
      path: '/api/v1/admin/kg/schema/Person/role/values',
    })
  })

  it('encodes a label that would otherwise open a new path segment', async () => {
    const { kg, transport } = client()
    await kg.propertyValues('Odd/Label', 'a b')
    assert.equal(transport.last.path, '/api/v1/admin/kg/schema/Odd%2FLabel/a%20b/values')
  })

  it('runs a view in one call, with the execute budget', async () => {
    const { kg, transport } = client()
    await kg.runView('recent-prs', { since: '2026-03-01' })
    assert.equal(transport.last.path, '/api/v1/admin/kg/views/recent-prs/run')
    assert.deepEqual(transport.last.body, { args: { since: '2026-03-01' } })
    assert.equal(transport.last.timeoutMs, 180_000)
  })

  it('defaults a view run to no arguments rather than omitting the key', async () => {
    const { kg, transport } = client()
    await kg.runView('recent-prs')
    assert.deepEqual(transport.last.body, { args: {} })
  })
})

/*
 * The discriminator between `/execute`'s two success shapes. This has a real incident behind it:
 * the guard used to test for the ABSENCE of `rowCount`, so a perfectly good result that omitted
 * that optional-in-practice field was reported as a background handle and its rows thrown away.
 * The Worlds console showed "the appliance parked this run in the background" over a payload that
 * had the answer in it.
 */
describe('isBackgroundHandle identifies the handle, not the absence of a result', () => {
  it('reads a handle as a handle', () => {
    assert.equal(isBackgroundHandle({ runId: 'r-1', state: 'RUNNING' } as never), true)
  })

  it('reads a full result as a result', () => {
    assert.equal(isBackgroundHandle({ rowCount: 2, rows: [{ a: 1 }, { a: 2 }] } as never), false)
  })

  it('reads a result WITHOUT rowCount as a result — the bug this guard shipped with', () => {
    // The rows are right there. Anything that calls this a handle loses them.
    assert.equal(isBackgroundHandle({ rows: [{ a: 1 }], cypher: 'MATCH (n) RETURN n' } as never), false)
  })

  it('reads an empty result as a result, not a handle', () => {
    assert.equal(isBackgroundHandle({ rows: [], rowCount: 0 } as never), false)
  })
})
