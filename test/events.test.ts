import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { type VcEvent, describeVcEvent, isFailure, isTerminal } from '../src/vc/events.ts'

const base = { queryId: 'q1', userId: 'u1', seq: 1, atMs: 0 }

describe('describeVcEvent says what the engine is doing', () => {
  it('narrates a stage by its producer and target', () => {
    assert.equal(
      describeVcEvent({ ...base, type: 'stage.started', stage: 1, producer: 'companies-house', targetLabel: 'Company', anchorLabel: 'Person', anchorCount: 3 } as VcEvent),
      'Stage 1: companies-house → Company, from 3 Persons',
    )
  })

  it('singularises, because "1 records" is how a UI announces it was written carelessly', () => {
    assert.equal(
      describeVcEvent({ ...base, type: 'producer.fetch', producer: 'p', kind: 'remote', targetLabel: 'T', keyCount: 1, recordCount: 1, durationMs: 12 } as VcEvent),
      'p returned 1 record for 1 key (12 ms)',
    )
  })

  it('reads a retrieval step as an action, not a tool name', () => {
    assert.equal(
      describeVcEvent({ ...base, type: 'retrieval.step', step: 'read_document', detail: 'Q3 board pack' } as VcEvent),
      'Reading: Q3 board pack',
    )
    assert.equal(
      describeVcEvent({ ...base, type: 'retrieval.step', step: 'search_semantic', detail: 'renewal terms', results: 4 } as VcEvent),
      'Searching by meaning: renewal terms — 4 results',
    )
  })

  it('keeps an unmapped step legible rather than dropping it', () => {
    assert.equal(
      describeVcEvent({ ...base, type: 'retrieval.step', step: 'some_new_step', detail: 'x' } as VcEvent),
      'some_new_step: x',
    )
  })

  it('omits the count when a step reports none — 0 results is not the same as "not applicable"', () => {
    assert.equal(
      describeVcEvent({ ...base, type: 'retrieval.step', step: 'composing', detail: 'the answer' } as VcEvent),
      'Composing the answer: the answer',
    )
    assert.match(
      describeVcEvent({ ...base, type: 'retrieval.step', step: 'judged', detail: 'x', results: 0 } as VcEvent),
      /0 results$/,
    )
  })

  it('falls back to the bare type for an event this build predates', () => {
    // A newer appliance publishing an unknown kind must degrade to a dull line, never throw.
    assert.equal(describeVcEvent({ ...base, type: 'something.new' } as VcEvent), 'something.new')
  })

  it('reports completion with rows and what was materialized', () => {
    assert.equal(
      describeVcEvent({ ...base, type: 'query.completed', rowCount: 2, materializedLabels: ['Company'], durationMs: 900 } as VcEvent),
      'Done — 2 rows in 900 ms · materialized Company',
    )
  })
})

describe('terminal and failure classification', () => {
  it('ends on completed or rejected', () => {
    assert.equal(isTerminal({ ...base, type: 'query.completed' } as VcEvent), true)
    assert.equal(isTerminal({ ...base, type: 'query.rejected' } as VcEvent), true)
    assert.equal(isTerminal({ ...base, type: 'producer.fetch' } as VcEvent), false)
  })

  it('separates a failed producer from a failed run — a fetch can fail and the run still answer', () => {
    assert.equal(isFailure({ ...base, type: 'producer.error' } as VcEvent), true)
    assert.equal(isTerminal({ ...base, type: 'producer.error' } as VcEvent), false)
  })
})
