import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { DocumentsClient } from '../src/client/documents.ts'
import type { IngestJob } from '../src/client/ingests.ts'
import { HttpTransport } from '../src/client/transport.ts'

/*
 * A client closed mid-batch finds its batch again by listing the caller's jobs: they outlive the
 * page that started them.
 */

const job = (id: string, state: IngestJob['state']): IngestJob => ({
  id, name: `${id}.epub`, state, progress: null, startedAt: '2026-09-30T01:00:00Z', updatedAt: '2026-09-30T01:00:05Z',
})

function appliance(status: number, body: unknown) {
  const sent: Array<{ url: string; method: string }> = []
  const client = new DocumentsClient(new HttpTransport({
    baseUrl: '',
    fetch: (async (url: string, init: RequestInit) => {
      sent.push({ url: String(url), method: init.method ?? 'GET' })
      return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
    }) as typeof fetch,
  }))
  return { client, sent }
}

describe('listIngests', () => {
  it('reads the caller\'s jobs, newest first as the appliance sent them', async () => {
    const { client, sent } = appliance(200, { jobs: [job('b', 'embedding'), job('a', 'succeeded')] })
    const listed = await client.listIngests()

    assert.equal(sent[0]!.method, 'GET')
    assert.equal(sent[0]!.url, '/api/v1/documents/ingests')
    assert.deepEqual(listed.ok && listed.value.jobs.map((j) => [j.id, j.state]), [['b', 'embedding'], ['a', 'succeeded']])
  })

  it('an appliance older than ingest jobs is not ok, so a client simply has nothing to re-attach', async () => {
    const { client } = appliance(404, { timestamp: '2026-09-30T01:00:00Z', status: 404, error: 'Not Found', path: '/api/v1/documents/ingests' })
    const listed = await client.listIngests()

    assert.equal(listed.ok, false)
  })
})
