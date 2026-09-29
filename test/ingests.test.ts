import assert from 'node:assert/strict'
import { afterEach, beforeEach, describe, it, mock } from 'node:test'
import { DocumentsClient } from '../src/client/documents.ts'
import { type IngestFollowUpdate, type IngestJob, type IngestJobState, followIngest } from '../src/client/ingests.ts'
import { type Outcome, failure, ok } from '../src/client/outcome.ts'
import { HttpTransport, type RequestSpec } from '../src/client/transport.ts'

const job = (state: IngestJobState, updatedAt: string, extra: Partial<IngestJob> = {}): IngestJob => ({
  id: 'j1', name: 'big-book.epub', state, progress: null, startedAt: '2026-09-29T08:00:00Z', updatedAt, ...extra,
})

/** An appliance that answers each poll with the next scripted outcome, repeating the last. */
function scripted(...answers: Outcome<IngestJob>[]) {
  let polls = 0
  return {
    get polls() { return polls },
    read: async (): Promise<Outcome<IngestJob>> => answers[Math.min(polls++, answers.length - 1)]!,
  }
}

/** Lets the follow loop's awaited read and its next pause both be reached. */
const settle = async () => { for (let i = 0; i < 5; i++) await Promise.resolve() }

/** Advance fake time in poll-sized steps, so every pause in between fires in order. */
async function run(ms: number, step = 2_000) {
  for (let t = 0; t < ms; t += step) {
    await settle()
    mock.timers.tick(step)
  }
  await settle()
}

describe('followIngest — a job ends when the appliance says so, never on a clock', () => {
  beforeEach(() => mock.timers.enable({ apis: ['setTimeout', 'Date'], now: Date.parse('2026-09-29T08:00:00Z') }))
  afterEach(() => mock.timers.reset())

  it('follows the stages through to success, reporting each', async () => {
    const appliance = scripted(
      ok(job('waiting_for_memory', 't1')),
      ok(job('converting', 't2')),
      ok(job('embedding', 't3', { progress: { done: 400, total: 2111 } })),
      ok(job('writing', 't4')),
      ok(job('succeeded', 't5', { uri: 'upload://w/big-book.epub', title: 'Big Book' })),
    )
    const updates: IngestFollowUpdate[] = []
    const result = followIngest('j1', appliance.read, { onUpdate: (u) => updates.push(u) })
    await run(20_000)

    const ended = await result
    assert.equal(ended.outcome, 'succeeded')
    assert.equal(ended.outcome === 'succeeded' && ended.job.uri, 'upload://w/big-book.epub')
    assert.deepEqual(updates.map((u) => u.job?.state), ['waiting_for_memory', 'converting', 'embedding', 'writing', 'succeeded'])
    assert.deepEqual(updates[2]!.job?.progress, { done: 400, total: 2111 })
  })

  it('reports a failed job with the appliance\'s own reason', async () => {
    const appliance = scripted(ok(job('converting', 't1')), ok(job('failed', 't2', { error: 'docling timed out after PT10M' })))
    const result = followIngest('j1', appliance.read)
    await run(4_000)

    const ended = await result
    assert.equal(ended.outcome, 'failed')
    assert.equal(ended.outcome === 'failed' && ended.job.error, 'docling timed out after PT10M')
  })

  it('calls a job the appliance no longer knows lost, not failed — it may have landed', async () => {
    const appliance = scripted(ok(job('embedding', 't1')), failure('refused', 'No ingest job j1', 404, { error: 'No ingest job j1' }))
    const result = followIngest('j1', appliance.read)
    await run(4_000)

    const ended = await result
    assert.equal(ended.outcome, 'lost')
    assert.equal(ended.outcome === 'lost' && ended.last?.state, 'embedding')
  })

  it('follows a job through an appliance restart: same id back, earlier stage, then done', async () => {
    const down = failure('unreachable', 'Could not reach the appliance: ECONNREFUSED')
    const appliance = scripted(
      ok(job('embedding', 't1', { progress: { done: 900, total: 2111 } })),
      down, down, failure('failed', 'The appliance failed (502)', 502), down,
      ok(job('queued', 't2', { resumes: 1 })),
      ok(job('embedding', 't3', { resumes: 1, progress: { done: 1200, total: 2111 } })),
      ok(job('succeeded', 't4', { resumes: 1, uri: 'upload://w/big-book.epub' })),
    )
    const updates: IngestFollowUpdate[] = []
    const result = followIngest('j1', appliance.read, { onUpdate: (u) => updates.push(u) })
    await run(120_000)

    const ended = await result
    assert.equal(ended.outcome, 'succeeded', 'a restart the appliance survived is not a lost job')
    assert.equal(ended.outcome === 'succeeded' && ended.job.resumes, 1)
    const answered = updates.filter((u) => u.unreachable === null)
    assert.deepEqual(answered.map((u) => u.job?.state), ['embedding', 'queued', 'embedding', 'succeeded'])
    assert.deepEqual(answered.map((u) => u.resumed), [false, true, true, true])
    assert.ok(updates.some((u) => u.unreachable !== null && !u.resumed), 'while down, nothing is claimed yet')
  })

  it('does not call a job resumed for restarts it survived before following began', async () => {
    const appliance = scripted(ok(job('embedding', 't1', { resumes: 2 })), ok(job('succeeded', 't2', { resumes: 2 })))
    const updates: IngestFollowUpdate[] = []
    const result = followIngest('j1', appliance.read, { onUpdate: (u) => updates.push(u) })
    await run(4_000)

    await result
    assert.deepEqual(updates.map((u) => u.resumed), [false, false])
    assert.equal(updates.at(-1)?.job?.resumes, 2)
  })

  it('treats an appliance that reports no resumes as never resumed', async () => {
    const appliance = scripted(ok(job('embedding', 't1')), ok(job('succeeded', 't2')))
    const updates: IngestFollowUpdate[] = []
    const result = followIngest('j1', appliance.read, { onUpdate: (u) => updates.push(u) })
    await run(4_000)

    await result
    assert.ok(updates.every((u) => u.resumed === false))
  })

  it('keeps following through an appliance that cannot be reached, and says so meanwhile', async () => {
    const down = failure('unreachable', 'Could not reach the appliance: ECONNREFUSED')
    const appliance = scripted(
      ok(job('embedding', 't1')),
      down, down, down, failure('failed', 'The appliance failed (502)', 502),
      ok(job('succeeded', 't2')),
    )
    const updates: IngestFollowUpdate[] = []
    const result = followIngest('j1', appliance.read, { onUpdate: (u) => updates.push(u) })
    await run(120_000, 1_000)

    assert.equal((await result).outcome, 'succeeded')
    const unreachable = updates.filter((u) => u.unreachable !== null)
    assert.equal(unreachable.length, 4)
    assert.equal(unreachable[0]!.job?.state, 'embedding', 'the last known state is kept while unreachable')
    assert.equal(updates.at(-1)!.unreachable, null)
  })

  it('backs off while unreachable rather than polling at full rate', async () => {
    const appliance = scripted(failure('unreachable', 'down'))
    const controller = new AbortController()
    const result = followIngest('j1', appliance.read, { signal: controller.signal, pollMs: 1_000 })
    await run(60_000, 1_000)
    controller.abort()
    await result
    // 1 immediate, then pauses of 2, 4, 8, 16, 30 s — six polls in a minute, not sixty.
    assert.ok(appliance.polls <= 7, `polled ${appliance.polls} times in a minute while down`)
  })

  it('flags a job that has not moved as stalled, keeps following, and clears the flag when it moves', async () => {
    const still = ok(job('converting', 't1'))
    const answers: Outcome<IngestJob>[] = [...Array(8).fill(still), ok(job('embedding', 't2')), ok(job('succeeded', 't3'))]
    const updates: IngestFollowUpdate[] = []
    const result = followIngest('j1', scripted(...answers).read, {
      onUpdate: (u) => updates.push(u), pollMs: 60_000, stalledAfterMs: 300_000,
    })
    await run(600_000, 60_000)

    assert.equal((await result).outcome, 'succeeded')
    const flags = updates.map((u) => u.stalled)
    assert.deepEqual(flags.slice(0, 5), [false, false, false, false, false])
    assert.equal(flags[5], true, 'five minutes unchanged is stalled')
    assert.equal(flags[8], false, 'moving again clears it')
  })

  it('counts a progress tick as movement even when the stage is unchanged', async () => {
    const answers = Array.from({ length: 12 }, (_, i) => ok(job('embedding', 't1', { progress: { done: i * 10, total: 200 } })))
    const updates: IngestFollowUpdate[] = []
    const controller = new AbortController()
    const result = followIngest('j1', scripted(...answers).read, {
      onUpdate: (u) => updates.push(u), signal: controller.signal, pollMs: 60_000, stalledAfterMs: 120_000,
    })
    await run(600_000, 60_000)
    controller.abort()
    await result
    assert.equal(updates.some((u) => u.stalled), false)
  })

  it('never gives up on a job that is still going, however long it takes', async () => {
    const appliance = scripted(ok(job('embedding', 't1')))
    const controller = new AbortController()
    let ended = false
    const result = followIngest('j1', appliance.read, { signal: controller.signal, pollMs: 60_000 })
    void result.then(() => { ended = true })
    await run(6 * 3_600_000, 60_000) // six hours
    assert.equal(ended, false, 'following ended on its own')

    controller.abort()
    await settle()
    const stopped = await result
    assert.equal(stopped.outcome, 'aborted')
    assert.equal(stopped.outcome === 'aborted' && stopped.last?.state, 'embedding')
  })

  it('stops polling when aborted, mid-pause', async () => {
    const appliance = scripted(ok(job('embedding', 't1')))
    const controller = new AbortController()
    const result = followIngest('j1', appliance.read, { signal: controller.signal, pollMs: 60_000 })
    await settle()
    controller.abort()
    assert.equal((await result).outcome, 'aborted')
    const polls = appliance.polls
    await run(600_000, 60_000)
    assert.equal(appliance.polls, polls)
  })
})

/** Records each request, answering from `reply`. */
function recording(reply: (spec: RequestSpec) => Outcome<unknown>) {
  const sent: RequestSpec[] = []
  return {
    sent,
    transport: {
      async send<T>(spec: RequestSpec) {
        sent.push(spec)
        return reply(spec) as Outcome<T>
      },
    },
  }
}

describe('DocumentsClient ingest jobs', () => {
  it('starts an upload as multipart to the jobs endpoint, with a short deadline for the bytes only', async () => {
    const { transport, sent } = recording(() => ok(job('queued', 't0')))
    const started = await new DocumentsClient(transport).startUpload('a.pdf', new Uint8Array([1]), ['papers', ' '])

    assert.equal(started.ok && started.value.state, 'queued')
    assert.equal(sent[0]!.method, 'POST')
    assert.equal(sent[0]!.path, '/api/v1/documents/ingests')
    assert.equal(sent[0]!.body, undefined)
    assert.deepEqual(sent[0]!.form?.getAll('tags'), ['papers'])
    assert.equal((sent[0]!.form?.get('file') as File).name, 'a.pdf')
    assert.equal(sent[0]!.timeoutMs, 120_000)
  })

  it('starts a URL ingest as JSON to the jobs endpoint', async () => {
    const { transport, sent } = recording(() => ok(job('queued', 't0')))
    await new DocumentsClient(transport).startIngestUrl('https://example.org/r', ['web'])
    assert.equal(sent[0]!.path, '/api/v1/documents/ingests/url')
    assert.deepEqual(sent[0]!.body, { url: 'https://example.org/r', tags: ['web'] })
  })

  it('reads one job by its encoded id', async () => {
    const { transport, sent } = recording(() => ok(job('embedding', 't1')))
    await new DocumentsClient(transport).ingestJob('j/1')
    assert.equal(sent[0]!.method, 'GET')
    assert.equal(sent[0]!.path, '/api/v1/documents/ingests/j%2F1')
  })

  it('follows through the client, ending on the appliance\'s word', async () => {
    const states: IngestJobState[] = ['embedding', 'succeeded']
    let i = 0
    const { transport } = recording(() => ok(job(states[Math.min(i++, 1)]!, `t${i}`)))
    const result = await new DocumentsClient(transport).followIngest('j1', { pollMs: 1 })
    assert.equal(result.outcome, 'succeeded')
  })
})

describe('telling an old appliance from a lost job, over HTTP', () => {
  const client = (status: number, body: unknown) => new DocumentsClient(new HttpTransport({
    baseUrl: '',
    fetch: (async () => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })) as typeof fetch,
  }))

  it('an appliance without ingest jobs answers startUpload as unsupported, so a caller can fall back', async () => {
    const outcome = await client(404, { timestamp: '2026-09-29T08:00:00Z', status: 404, error: 'Not Found', path: '/api/v1/documents/ingests' })
      .startUpload('a.pdf', new Uint8Array([1]))
    assert.equal(!outcome.ok && outcome.kind, 'unsupported')
  })

  it('a job the appliance does not know is refused with 404, which following reports as lost', async () => {
    const c = client(404, { error: 'No ingest job j1' })
    const read = await c.ingestJob('j1')
    assert.equal(!read.ok && read.kind, 'refused')
    assert.equal(!read.ok && read.status, 404)
    const result = await c.followIngest('j1')
    assert.equal(result.outcome, 'lost')
    assert.equal(result.outcome === 'lost' && result.message, 'No ingest job j1')
  })
})
