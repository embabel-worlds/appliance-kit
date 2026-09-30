import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { AgentsClient } from '../src/client/agents.ts'
import { CronClient } from '../src/client/cron.ts'
import { failure, ok, type Outcome } from '../src/client/outcome.ts'
import type { RequestSpec, Transport } from '../src/client/transport.ts'

/*
 * The request each method sends, and the one piece of reading this client does itself: a refusal
 * arrives as `refused` in a 409 body, not as `error`, so without the lift a sponsor would see
 * "Request refused (409)" instead of the appliance's sentence about why.
 */
class RecordingTransport implements Transport {
  readonly sent: RequestSpec[] = []
  constructor(private readonly reply: Outcome<unknown>) {}
  async send<T>(spec: RequestSpec): Promise<Outcome<T>> {
    this.sent.push(spec)
    return this.reply as Outcome<T>
  }
}

const agent = { name: 'chaser', job: 'chase late invoices' }

describe('AgentsClient', () => {
  it('moves a routine on the ladder with its name, and the whole agent without one', async () => {
    const transport = new RecordingTransport(ok({ agent, refused: null }))
    const agents = new AgentsClient(transport)
    await agents.setStage('chaser', 'observing', 'note-failure')
    await agents.setStage('ops desk', 'off')
    assert.deepEqual(transport.sent, [
      { method: 'POST', path: '/api/v1/agents/chaser/stage', body: { stage: 'observing', routine: 'note-failure' } },
      { method: 'POST', path: '/api/v1/agents/ops%20desk/stage', body: { stage: 'off' } },
    ])
  })

  it('answers a change with the agent as it now stands', async () => {
    const result = await new AgentsClient(new RecordingTransport(ok({ agent, refused: null }))).sign('chaser')
    assert.deepEqual(result, { ok: true, value: agent })
  })

  it('carries the server sentence of a 409 refusal, not the status line', async () => {
    const said = 'chaser cannot go on duty yet. It needs its sponsor\'s signature on version 1.'
    const transport = new RecordingTransport(failure('refused', 'Request refused (409)', 409, { agent: null, refused: said }))
    const result = await new AgentsClient(transport).setStage('chaser', 'on')
    assert.equal(result.ok, false)
    assert.equal(!result.ok && result.kind, 'refused')
    assert.equal(!result.ok && result.message, said)
  })

  it('leaves other failures as the transport read them', async () => {
    const gone = failure('unsupported', 'no such route', 404)
    const result = await new AgentsClient(new RecordingTransport(gone)).sign('chaser')
    assert.deepEqual(result, gone)
  })
})

describe('CronClient', () => {
  it('sends the words as they were written and allows the model its time', async () => {
    const transport = new RecordingTransport(ok({ cron: '0 0 8 * * MON-FRI' }))
    const result = await new CronClient(transport).compileSchedule('every weekday at 8')
    assert.deepEqual(transport.sent, [{ method: 'POST', path: '/api/v1/cron/compile-schedule', body: { schedule: 'every weekday at 8' }, timeoutMs: 60_000 }])
    assert.deepEqual(result, { ok: true, value: { cron: '0 0 8 * * MON-FRI' } })
  })
})
