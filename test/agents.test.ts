import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { AgentsClient } from '../src/client/agents.ts'
import { CronClient } from '../src/client/cron.ts'
import { ThreadsClient } from '../src/client/threads.ts'
import { AgentSuggestionsClient } from '../src/client/agentSuggestions.ts'
import { AgentRunsClient } from '../src/client/agentRuns.ts'
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
  it('throws and lifts the kill switch on its own path, not under agents', async () => {
    const transport = new RecordingTransport(ok({ halted: true, by: 'rod', at: '2026-10-02T10:00:00Z', reason: 'wrong customer' }))
    const agents = new AgentsClient(transport)
    await agents.haltStatus()
    await agents.halt('wrong customer')
    await agents.resume()
    assert.deepEqual(transport.sent, [
      { method: 'GET', path: '/api/v1/halt' },
      { method: 'POST', path: '/api/v1/halt', body: { reason: 'wrong customer' } },
      { method: 'DELETE', path: '/api/v1/halt' },
    ])
  })

  it('checks a duty by the agent and duty names, encoded', async () => {
    const transport = new RecordingTransport(ok({ agent: 'ops desk', duty: 'at risk', state: 'lapsed' }))
    await new AgentsClient(transport).checkDuty('ops desk', 'at risk')
    assert.deepEqual(transport.sent, [
      { method: 'POST', path: '/api/v1/agents/ops%20desk/duties/at%20risk/check', body: {} },
    ])
  })

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

describe('ThreadsClient', () => {
  it('lists, opens, starts and posts in threads at their paths', async () => {
    const transport = new RecordingTransport(ok({ threads: [] }))
    const threads = new ThreadsClient(transport)
    await threads.list()
    await threads.get('th 1')
    await threads.create('Northwind')
    await threads.post('th 1', '@steward is Northwind at risk?', [{ kind: 'VIEW', label: 'StewardUnacknowledgedRisk' }])
    assert.deepEqual(transport.sent, [
      { method: 'GET', path: '/api/v1/threads' },
      { method: 'GET', path: '/api/v1/threads/th%201' },
      { method: 'POST', path: '/api/v1/threads', body: { title: 'Northwind' } },
      { method: 'POST', path: '/api/v1/threads/th%201/messages', body: { text: '@steward is Northwind at risk?', attachments: [{ kind: 'VIEW', label: 'StewardUnacknowledgedRisk' }] } },
    ])
  })
})

describe('AgentSuggestionsClient', () => {
  it('lists suggestions and settles one at its own path, never under an agent of the same name', async () => {
    const transport = new RecordingTransport(ok({ suggestion: { id: 'sg 1', name: 'renewals-desk' }, refused: null }))
    const suggestions = new AgentSuggestionsClient(transport)
    await suggestions.list()
    await suggestions.draft('sg 1')
    await suggestions.adopted('sg 1')
    await suggestions.dismiss('sg 1')
    assert.deepEqual(transport.sent, [
      { method: 'GET', path: '/api/v1/agent-suggestions' },
      { method: 'POST', path: '/api/v1/agent-suggestions/sg%201/draft', body: {} },
      { method: 'POST', path: '/api/v1/agent-suggestions/sg%201/adopted', body: {} },
      { method: 'POST', path: '/api/v1/agent-suggestions/sg%201/dismiss', body: {} },
    ])
  })
})

describe('AgentRunsClient', () => {
  it('reads runs and upcoming work, and changes one firing, at the agent\'s own paths', async () => {
    const transport = new RecordingTransport(ok({ upcoming: { agent: 'steward', firings: [] }, refused: null }))
    const runs = new AgentRunsClient(transport)
    await runs.runs('steward', 20)
    await runs.run('steward', 'run 1')
    await runs.upcoming('steward')
    await runs.skip('steward', 'duty-steward-x', 'month-end')
    await runs.skip('steward', 'duty-steward-x', 'later', '2026-10-05T12:00:00Z')
    await runs.runNow('steward', 'action-brief')
    await runs.verifyReceipts()
    assert.deepEqual(transport.sent, [
      { method: 'GET', path: '/api/v1/agents/steward/runs', query: { limit: '20' } },
      { method: 'GET', path: '/api/v1/agents/steward/runs/run%201' },
      { method: 'GET', path: '/api/v1/agents/steward/upcoming' },
      { method: 'POST', path: '/api/v1/agents/steward/upcoming/skip', body: { job: 'duty-steward-x', reason: 'month-end' } },
      { method: 'POST', path: '/api/v1/agents/steward/upcoming/skip', body: { job: 'duty-steward-x', reason: 'later', until: '2026-10-05T12:00:00Z' } },
      { method: 'POST', path: '/api/v1/agents/steward/upcoming/run', body: { job: 'action-brief' } },
      { method: 'GET', path: '/api/v1/receipts/verify' },
    ])
  })
})
