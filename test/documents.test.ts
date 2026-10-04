import assert from 'node:assert/strict'
import { afterEach, beforeEach, describe, it, mock } from 'node:test'
import { DEFAULT_INGEST_TIMEOUT_MS, DocumentsClient, newOperationId } from '../src/client/documents.ts'
import { classifySource } from '../src/client/citations.ts'
import { ApplianceClient } from '../src/client/index.ts'
import { HttpTransport, type RequestSpec } from '../src/client/transport.ts'

/** Records the spec each call produced; the shape of the REQUEST is what these tests are about. */
function recordingTransport(reply: unknown = {}) {
  const sent: RequestSpec[] = []
  return {
    sent,
    transport: {
      async send<T>(spec: RequestSpec) {
        sent.push(spec)
        return { ok: true as const, value: reply as T }
      },
    },
  }
}

describe('DocumentsClient.ask', () => {
  it('drops empty filters rather than sending them — `from: ""` is not a date range', async () => {
    const { transport, sent } = recordingTransport()
    await new DocumentsClient(transport).ask({ question: 'what changed?', from: '', to: '', topK: 0 })

    const body = sent[0]!.body as Record<string, unknown>
    assert.equal('from' in body, false)
    assert.equal('to' in body, false)
    assert.equal('topK' in body, false)
    assert.equal(body['question'], 'what changed?')
    // The server distinguishes retrieval from retrieval-plus-prose; this surface always wants prose.
    assert.equal(body['answer'], true)
  })

  it('sends the filters that ARE set', async () => {
    const { transport, sent } = recordingTransport()
    await new DocumentsClient(transport).ask({
      question: 'renewal terms', dateField: 'modified', from: '2026-01-01', to: '2026-06-30', topK: 8,
    })

    assert.deepEqual(sent[0]!.body, {
      question: 'renewal terms', history: [], answer: true,
      window: { field: 'modified', from: '2026-01-01', to: '2026-06-30' }, topK: 8,
    })
  })

  it('sends a date range as the one window object the appliance reads, never as loose fields', async () => {
    const { transport, sent } = recordingTransport()
    const client = new DocumentsClient(transport)

    await client.ask({ question: 'q', dateField: 'created', from: '2026-03-01' })
    const body = sent[0]!.body as Record<string, unknown>
    assert.deepEqual(body['window'], { field: 'created', from: '2026-03-01' })
    for (const loose of ['dateField', 'from', 'to']) assert.equal(loose in body, false, `${loose} is not a field the appliance reads`)

    // A field with no bound is not a range, so no window at all.
    await client.ask({ question: 'q', dateField: 'created' })
    assert.equal('window' in (sent[1]!.body as Record<string, unknown>), false)

    // The appliance's default field, stated rather than left to it.
    await client.ask({ question: 'q', to: '2026-06-30' })
    assert.deepEqual((sent[2]!.body as Record<string, unknown>)['window'], { field: 'modified', to: '2026-06-30' })
  })

  it('sends the corpus tag when one is chosen, and omits it when not', async () => {
    const { transport, sent } = recordingTransport()
    const client = new DocumentsClient(transport)

    await client.ask({ question: 'q', tag: 'papers' })
    assert.equal((sent[0]!.body as Record<string, unknown>)['tag'], 'papers')

    // "" is the all-documents choice in a select, and must not narrow to a tag named "".
    await client.ask({ question: 'q', tag: '' })
    assert.equal('tag' in (sent[1]!.body as Record<string, unknown>), false)
  })

  it('sends the one document to read when one is chosen, and omits it when not', async () => {
    const { transport, sent } = recordingTransport()
    const client = new DocumentsClient(transport)

    await client.ask({ question: 'q', uri: 'upload://w/spec.md' })
    assert.equal((sent[0]!.body as Record<string, unknown>)['uri'], 'upload://w/spec.md')

    // No document chosen is every document, and must not narrow to one named "".
    await client.ask({ question: 'q', uri: '' })
    assert.equal('uri' in (sent[1]!.body as Record<string, unknown>), false)
  })

  it('carries the operation id as the header the appliance echoes on progress events', async () => {
    const { transport, sent } = recordingTransport()
    await new DocumentsClient(transport).ask({ question: 'q' }, { operationId: 'ask-abc' })

    assert.equal(sent[0]!.headers?.['X-Embabel-Operation-Id'], 'ask-abc')
  })

  it('omits the header entirely when no id was given — an empty one would match nothing', async () => {
    const { transport, sent } = recordingTransport()
    await new DocumentsClient(transport).ask({ question: 'q' })

    assert.equal(sent[0]!.headers, undefined)
  })
})

describe('DocumentsClient.setTags and remove', () => {
  it('replaces tags with a PUT of the whole list', async () => {
    const { transport, sent } = recordingTransport({ status: 'tagged', uri: 'upload://w/a.pdf', tags: ['contracts'] })
    const outcome = await new DocumentsClient(transport).setTags('upload://w/a.pdf', ['contracts'])

    assert.equal(sent[0]!.method, 'PUT')
    assert.equal(sent[0]!.path, '/api/v1/documents/tags')
    assert.deepEqual(sent[0]!.body, { uri: 'upload://w/a.pdf', tags: ['contracts'] })
    assert.ok(outcome.ok && outcome.value.tags[0] === 'contracts')
  })

  it('removes by uri as a query parameter, which the transport encodes', async () => {
    const { transport, sent } = recordingTransport()
    await new DocumentsClient(transport).remove('file:///local/contracts/a b.pdf')

    assert.equal(sent[0]!.method, 'DELETE')
    assert.equal(sent[0]!.path, '/api/v1/documents')
    assert.deepEqual(sent[0]!.query, { uri: 'file:///local/contracts/a b.pdf' })
    assert.equal(sent[0]!.body, undefined)
  })
})

describe('DocumentsClient.upload', () => {
  it('sends multipart with the filename, and never a JSON body', async () => {
    const { transport, sent } = recordingTransport()
    await new DocumentsClient(transport).upload('lease.pdf', new Uint8Array([1, 2, 3]), ['papers'])

    const spec = sent[0]!
    assert.equal(spec.body, undefined, 'a form must not also be stringified as JSON')
    assert.ok(spec.form instanceof FormData)
    const file = spec.form.get('file') as File
    assert.equal(file.name, 'lease.pdf')
  })

  it('repeats the tags field rather than joining — a tag may contain a comma', async () => {
    const { transport, sent } = recordingTransport()
    await new DocumentsClient(transport).upload('x.txt', new Uint8Array([1]), ['tax, 2026', ' papers ', ''])

    assert.deepEqual(sent[0]!.form!.getAll('tags'), ['tax, 2026', 'papers'])
  })
})

/**
 * A fake appliance that holds every request open until the test answers it, as a real one does
 * while an ingest waits for its share of the heap budget. It honours the abort signal the way
 * fetch does, so the ONLY thing that can end a request early is the kit's own timer.
 */
function queueingAppliance() {
  const pending: Array<{ url: string; answer: (body: unknown) => void }> = []
  const fetch = (url: string | URL | Request, init?: RequestInit) =>
    new Promise<Response>((resolve, reject) => {
      init?.signal?.addEventListener('abort', () => {
        const abort = new Error('aborted')
        abort.name = 'AbortError'
        reject(abort)
      })
      pending.push({
        url: String(url),
        answer: (body) => resolve({ ok: true, status: 200, text: async () => JSON.stringify(body) } as Response),
      })
    })
  return { pending, fetch: fetch as unknown as typeof globalThis.fetch }
}

/** Lets a settled promise's continuations run, so "still pending" is a fact rather than a race. */
const settle = () => new Promise<void>((resolve) => setImmediate(resolve))

function tracked<T>(promise: Promise<T>) {
  const state = { done: false }
  promise.then(() => { state.done = true }, () => { state.done = true })
  return { promise, state }
}

describe('ingest timeouts — a queued ingest is not a failed one (appliance-kit#16)', () => {
  beforeEach(() => mock.timers.enable({ apis: ['setTimeout'] }))
  afterEach(() => mock.timers.reset())

  const OLD_TIMEOUT_MS = 300_000

  it('does not fail an upload held open past the old five minutes', async () => {
    const appliance = queueingAppliance()
    const client = new DocumentsClient(new HttpTransport({ baseUrl: '', fetch: appliance.fetch }))

    const upload = tracked(client.upload('big-book.pdf', new Uint8Array([1, 2, 3])))
    mock.timers.tick(OLD_TIMEOUT_MS * 4) // twenty minutes queued behind two other books
    await settle()
    assert.equal(upload.state.done, false, 'the kit gave up on an ingest that was only queued')

    appliance.pending[0]!.answer({ uri: 'upload://w/big-book.pdf' })
    const outcome = await upload.promise
    assert.equal(outcome.ok, true)
  })

  it('does not fail a URL ingest held open past the old five minutes', async () => {
    const appliance = queueingAppliance()
    const client = new DocumentsClient(new HttpTransport({ baseUrl: '', fetch: appliance.fetch }))

    const ingest = tracked(client.ingestUrl('https://example.org/report'))
    mock.timers.tick(OLD_TIMEOUT_MS + 1)
    await settle()
    assert.equal(ingest.state.done, false)

    appliance.pending[0]!.answer({})
    assert.equal((await ingest.promise).ok, true)
  })

  it('still ends a request that is genuinely stuck, at the default, and says the ingest may still land', async () => {
    const appliance = queueingAppliance()
    const client = new DocumentsClient(new HttpTransport({ baseUrl: '', fetch: appliance.fetch }))

    const upload = tracked(client.upload('stuck.pdf', new Uint8Array([1])))
    mock.timers.tick(DEFAULT_INGEST_TIMEOUT_MS - 1)
    await settle()
    assert.equal(upload.state.done, false, 'the kit gave up before its own deadline')

    mock.timers.tick(1)
    const outcome = await upload.promise

    assert.equal(outcome.ok, false)
    assert.equal(!outcome.ok && outcome.kind, 'unreachable')
    assert.equal(
      !outcome.ok && outcome.message,
      'The ingest did not finish within 60 min. The appliance may still be queueing or ingesting it and can '
        + 'still complete it — check the documents list before sending it again.',
    )
  })

  it('honours a short timeout the caller passes for one call', async () => {
    const appliance = queueingAppliance()
    const client = new DocumentsClient(new HttpTransport({ baseUrl: '', fetch: appliance.fetch }))

    const upload = client.upload('a.pdf', new Uint8Array([1]), [], { timeoutMs: 5_000 })
    mock.timers.tick(5_000)
    const outcome = await upload
    assert.equal(outcome.ok, false)
    assert.match(!outcome.ok ? outcome.message : '', /did not finish within 5 s\. The appliance may still/)

    const ingest = client.ingestUrl('https://example.org/x', [], { timeoutMs: 90_000 })
    mock.timers.tick(90_000)
    assert.match(((await ingest) as { message: string }).message, /within 90 s\./)
  })

  it('honours a timeout set once for the client, and a per-call one over it', async () => {
    const appliance = queueingAppliance()
    const client = ApplianceClient.forAppliance(
      { baseUrl: 'http://appliance', fetch: appliance.fetch },
      { documents: { ingestTimeoutMs: 120_000 } },
    )

    const upload = client.documents.upload('a.pdf', new Uint8Array([1]))
    mock.timers.tick(120_000)
    assert.match(((await upload) as { message: string }).message, /within 2 min\./)

    const longer = tracked(client.documents.upload('b.pdf', new Uint8Array([1]), [], { timeoutMs: 600_000 }))
    mock.timers.tick(120_000)
    await settle()
    assert.equal(longer.state.done, false, 'the per-call timeout wins over the client one')
    appliance.pending[1]!.answer({})
    assert.equal((await longer.promise).ok, true)
  })

  it('leaves every other request on the generic timeout sentence', async () => {
    const appliance = queueingAppliance()
    const transport = new HttpTransport({ baseUrl: '', fetch: appliance.fetch, timeoutMs: 1_000 })

    const listing = new DocumentsClient(transport).list()
    mock.timers.tick(1_000)
    assert.equal(((await listing) as { message: string }).message, 'The appliance did not answer within 1000ms')
  })
})

describe('newOperationId', () => {
  it('does not repeat within one millisecond, which is when two windows would collide', () => {
    const ids = new Set(Array.from({ length: 200 }, () => newOperationId()))
    assert.equal(ids.size, 200)
  })
})

describe('classifySource', () => {
  it('labels a web page by host and path, dropping the query string', () => {
    const s = classifySource('https://example.gov.au/reports/2026?utm_source=x&session=y')
    assert.equal(s.kind, 'web')
    assert.equal(s.label, 'example.gov.au/reports/2026')
    // The LINK keeps everything — only the visible label is trimmed.
    assert.equal(s.url, 'https://example.gov.au/reports/2026?utm_source=x&session=y')
  })

  it('decodes a file:// path and reports it as the APPLIANCE sees it', () => {
    const s = classifySource('file:///local/notes/Q1%20review.pdf')
    assert.equal(s.kind, 'file')
    assert.equal(s.containerPath, '/local/notes/Q1 review.pdf')
    // No host path, and no url: a browser cannot open this and must not offer to.
    assert.equal(s.url, undefined)
  })

  it('refuses to guess about anything else', () => {
    assert.equal(classifySource('s3://bucket/key').kind, 'opaque')
    assert.equal(classifySource(null).kind, 'opaque')
    assert.equal(classifySource('').label, 'unknown source')
  })
})
