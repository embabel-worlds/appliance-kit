import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { RequestsClient } from '../src/client/requests.ts'
import { failure, ok, type Outcome } from '../src/client/outcome.ts'
import type { RequestSpec, Transport } from '../src/client/transport.ts'

/*
 * What each decision sends, and the one reading this client does itself: a refused decision says
 * why in `refused`, and a surface must show that sentence, not "Request refused (409)".
 */
class RecordingTransport implements Transport {
  readonly sent: RequestSpec[] = []
  constructor(private readonly reply: Outcome<unknown>) {}
  async send<T>(spec: RequestSpec): Promise<Outcome<T>> {
    this.sent.push(spec)
    return this.reply as Outcome<T>
  }
}

const request = { id: 'req_1', routine: 'chaser', status: 'APPROVED' }

describe('RequestsClient', () => {
  it('approves and rejects through one decision route, a rejection carrying its reason', async () => {
    const transport = new RecordingTransport(ok({ request, refused: null }))
    const requests = new RequestsClient(transport)
    await requests.approve('req_1')
    await requests.reject('req 2', 'they paid by wire')
    assert.deepEqual(transport.sent, [
      { method: 'POST', path: '/api/v1/requests/req_1/decision', body: { decision: 'approve' } },
      { method: 'POST', path: '/api/v1/requests/req%202/decision', body: { decision: 'reject', reason: 'they paid by wire' } },
    ])
  })

  it('answers a decision with the request as it now stands', async () => {
    const result = await new RequestsClient(new RecordingTransport(ok({ request, refused: null }))).approve('req_1')
    assert.deepEqual(result, { ok: true, value: request })
  })

  it("lifts the appliance's own sentence out of a refused decision", async () => {
    const refusal = failure('refused', 'Request refused (409)', 409, { request: null, refused: 'this request is expired' })
    const result = await new RequestsClient(new RecordingTransport(refusal)).approve('req_1')
    assert.equal(result.ok, false)
    assert.equal(!result.ok && result.message, 'this request is expired')
  })
})
