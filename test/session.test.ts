import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { type SessionBinding, completeQuery, pipelineText, planLine } from '../src/vc/session.ts'
import { createSessionCypherHint } from '../src/studio-kit/hints.ts'
import * as Vc from '../src/vc/index.ts'

const bindings: SessionBinding[] = []
const byName = (n: string) => bindings.find((b) => b.name === n)
const byVar = (v: string) => [...bindings].reverse().find((b) => b.variable === v)
const bind = (name: string, variable: string, label: string, pipeline: string[]) => {
  bindings.push({ name, variable, label, members: 1, pipeline })
}

describe('the session grammar — real Cypher, one clause at a time', () => {
  it('an opening MATCH implies RETURN from the user’s own variable and captures', () => {
    const p = planLine('MATCH (c:Chunk)', null, '_1', byName, byVar)
    assert.equal(p.cypher, 'MATCH (c:Chunk) RETURN c')
    assert.equal(p.captureAs, '_1')
    assert.deepEqual(p.pipeline, ['MATCH (c:Chunk)'])
    bind('_1', 'c', 'Chunk', p.pipeline!)
  })

  it('WHERE is the next clause — it narrows the newest binding, and the pipeline reads as one query', () => {
    const p = planLine("WHERE c.source CONTAINS 'contract'", bindings.at(-1)!, '_2', byName, byVar)
    assert.equal(p.cypher, "MATCH (c:`$_1`) WHERE c.source CONTAINS 'contract' RETURN c")
    assert.deepEqual(p.pipeline, ['MATCH (c:Chunk)', "WHERE c.source CONTAINS 'contract'"])
    bind('_2', 'c', 'Chunk', p.pipeline!)
  })

  it('AND folds onto the previous WHERE, parenthesized so precedence cannot rebind it', () => {
    const p = planLine('AND c.chunk_index = 0', bindings.at(-1)!, '_3', byName, byVar)
    assert.equal(p.cypher, 'MATCH (c:`$_2`) WHERE c.chunk_index = 0 RETURN c')
    assert.equal(p.pipeline!.at(-1), "WHERE c.source CONTAINS 'contract' AND (c.chunk_index = 0)")
  })

  it('OR is refused — a frozen set can only narrow, and a session must not disagree with its pipeline', () => {
    const p = planLine('OR c.text IS NOT NULL', bindings.at(-1)!, '_3', byName, byVar)
    assert.equal(p.kind, 'error')
    assert.match(p.error!, /WIDEN/)
  })

  it('a continuation MATCH re-anchors a bare bound variable and keeps the clause verbatim in the pipeline', () => {
    const p = planLine('MATCH (c)<-[:HAS_CHUNK]-(d:Document)', bindings.at(-1)!, '_3', byName, byVar)
    assert.equal(p.cypher, 'MATCH (c:`$_2`)<-[:HAS_CHUNK]-(d:Document) RETURN DISTINCT d')
    assert.equal(p.variable, 'd')
    assert.deepEqual(p.pipeline!.slice(-2), ['WITH DISTINCT c', 'MATCH (c)<-[:HAS_CHUNK]-(d:Document)'])
    bind('_3', 'd', 'Document', p.pipeline!)
  })

  it('RETURN projects the newest set — shown, not captured — and completes the pipeline', () => {
    const p = planLine('RETURN d.title, d.uri', bindings.at(-1)!, '_4', byName, byVar)
    assert.equal(p.tabular, true)
    assert.equal(
      pipelineText(p.tabularPipeline!, null),
      [
        'MATCH (c:Chunk)',
        "WHERE c.source CONTAINS 'contract'",
        'WITH DISTINCT c',
        'MATCH (c)<-[:HAS_CHUNK]-(d:Document)',
        'RETURN d.title, d.uri',
      ].join('\n'),
    )
  })

  it('a hand-typed scope reference runs as-is but its PIPELINE splices the provenance, renamed to the alias', () => {
    const p = planLine('MATCH (x:`$_2`)<-[:HAS_CHUNK]-(d2:Document) RETURN d2', bindings.at(-1)!, '_4', byName, byVar)
    assert.equal(pipelineText(p.pipeline!, null).includes('`$'), false)
    assert.match(pipelineText(p.pipeline!, null), /MATCH \(x:Chunk\)/)
  })

  it('an unlabelled return variable is shown, not captured, with the reason', () => {
    const p = planLine('MATCH (a)-->(b) RETURN b', null, '_9', byName, byVar)
    assert.equal(p.tabular, true)
    assert.match(p.note!, /no label/)
  })

  it('completeQuery makes a RETURN-less MATCH runnable everywhere, and leaves complete Cypher alone', () => {
    assert.deepEqual(completeQuery('MATCH (c:Chunk)'), { cypher: 'MATCH (c:Chunk) RETURN c', note: 'RETURN c implied' })
    assert.deepEqual(completeQuery('MATCH (c:Chunk) RETURN c.text'), { cypher: 'MATCH (c:Chunk) RETURN c.text' })
    assert.deepEqual(completeQuery('RETURN 1'), { cypher: 'RETURN 1' })
  })
})

describe('the session-aware hint', () => {
  it('completes a bound variable’s properties from a prompt that never mentions its label', () => {
    const schema = {
      labels: [{ label: 'Chunk', properties: [{ name: 'source' }, { name: 'chunk_index' }] }],
      relationships: [],
    }
    const hint = createSessionCypherHint(
      { Pos: (line: number, ch: number) => ({ line, ch }) },
      Vc as never,
      { schema: () => schema, bindings: () => [{ variable: 'c', label: 'Chunk' }] },
    )
    const line = 'WHERE c.'
    const result = hint({
      getCursor: () => ({ line: 0, ch: line.length }),
      getLine: () => line,
      getValue: () => line,
    }) as { list: string[] } | null
    assert.deepEqual(result?.list, ['chunk_index', 'source'])
  })
})
