import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { DocumentsClient } from '../src/client/documents.ts'
import type { IngestJob, IngestJobState } from '../src/client/ingests.ts'
import { type Outcome, ok } from '../src/client/outcome.ts'
import { HttpTransport, type RequestSpec } from '../src/client/transport.ts'

/*
 * A document whose chunks could not all be embedded is kept, not failed — and then it has to be
 * said, and fixed. The listing and a finished job carry the count; `startEmbedMissing` repairs it
 * as a job the caller follows like any other ingest.
 */

const job = (state: IngestJobState, extra: Partial<IngestJob> = {}): IngestJob => ({
  id: 'r1', name: 'Witching Hour.epub', state, progress: null,
  startedAt: '2026-09-30T01:00:00Z', updatedAt: `2026-09-30T01:00:0${state.length % 10}Z`, ...extra,
})

/** An appliance over HTTP that answers every request with [status] and [body], recording each. */
function appliance(status: number, body: unknown) {
  const sent: Array<{ url: string; method: string; body: unknown }> = []
  const client = new DocumentsClient(new HttpTransport({
    baseUrl: '',
    fetch: (async (url: string, init: RequestInit) => {
      sent.push({ url: String(url), method: init.method ?? 'GET', body: init.body ? JSON.parse(String(init.body)) : undefined })
      return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
    }) as typeof fetch,
  }))
  return { client, sent }
}

describe('startEmbedMissing', () => {
  it('posts the document uri and answers at once with a job', async () => {
    const { client, sent } = appliance(202, job('queued'))
    const started = await client.startEmbedMissing('upload://w/Witching Hour.epub')

    assert.equal(started.ok && started.value.state, 'queued')
    assert.equal(sent[0]!.method, 'POST')
    assert.equal(sent[0]!.url, '/api/v1/documents/embed-missing')
    assert.deepEqual(sent[0]!.body, { uri: 'upload://w/Witching Hour.epub' })
  })

  it('a document the world does not hold is refused with the appliance\'s own words', async () => {
    const { client } = appliance(404, { error: 'No document upload://w/gone.epub' })
    const started = await client.startEmbedMissing('upload://w/gone.epub')

    assert.equal(!started.ok && started.kind, 'refused')
    assert.equal(!started.ok && started.status, 404)
    assert.equal(!started.ok && started.message, 'No document upload://w/gone.epub')
  })

  it('an appliance with nothing to embed with is refused with 409, its reason kept in the body', async () => {
    const reason = 'No embedding model is configured. Run `embabel models` to choose one.'
    const { client } = appliance(409, { status: 'unavailable', message: reason, embeddings: { available: false } })
    const started = await client.startEmbedMissing('upload://w/a.epub')

    assert.equal(!started.ok && started.kind, 'refused')
    assert.equal(!started.ok && started.status, 409)
    assert.equal(!started.ok && (started.body as { message: string }).message, reason)
  })

  it('is followed to its end like any other ingest, reporting what is still missing', async () => {
    const states: IngestJob[] = [
      job('embedding', { progress: { done: 10, total: 40 } }),
      job('succeeded', { uri: 'upload://w/a.epub', chunks: 2111, chunksWithoutEmbeddings: 0 }),
    ]
    let polls = 0
    const sent: RequestSpec[] = []
    const transport = {
      async send<T>(spec: RequestSpec) {
        sent.push(spec)
        return ok(states[Math.min(polls++, states.length - 1)]) as Outcome<T>
      },
    }
    const result = await new DocumentsClient(transport).followIngest('r1', { pollMs: 1 })

    assert.equal(result.outcome, 'succeeded')
    assert.equal(result.outcome === 'succeeded' && result.job.chunksWithoutEmbeddings, 0)
    assert.equal(result.outcome === 'succeeded' && result.job.chunks, 2111)
    assert.ok(sent.every((s) => s.path === '/api/v1/documents/ingests/r1'), 'a repair job is read where every job is')
  })
})

describe('the missing-embedding count, where the appliance reports it', () => {
  it('a finished ingest job carries its chunk counts', async () => {
    const { client } = appliance(200, job('succeeded', { chunks: 2111, chunksWithoutEmbeddings: 40 }))
    const read = await client.ingestJob('r1')

    assert.equal(read.ok && read.value.chunks, 2111)
    assert.equal(read.ok && read.value.chunksWithoutEmbeddings, 40)
  })

  it('the listing carries each document\'s counts, and an older appliance simply omits them', async () => {
    const { client } = appliance(200, {
      documents: [
        { uri: 'upload://w/a.epub', title: 'A', chunks: 500, chunksWithoutEmbeddings: 12 },
        { uri: 'upload://w/b.epub', title: 'B' },
      ],
      totalChunks: 500,
    })
    const listed = await client.list()

    assert.ok(listed.ok)
    const [a, b] = listed.value.documents
    assert.equal(a!.chunksWithoutEmbeddings, 12)
    assert.equal(a!.chunks, 500)
    assert.equal(b!.chunksWithoutEmbeddings, undefined)
  })
})
