import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { DocumentsClient, newOperationId } from '../src/client/documents.ts'
import { classifySource } from '../src/client/citations.ts'
import type { RequestSpec } from '../src/client/transport.ts'

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
