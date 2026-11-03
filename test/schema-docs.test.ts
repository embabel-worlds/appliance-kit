import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import * as vc from '../src/vc/index.ts'
import { createCypherHint, cypherFragmentCompletions } from '../src/studio-kit/index.ts'

/*
 * WHAT A NAME MEANS, wherever a person reads it (embabel/me#3525). The schema already carries a
 * description and a type for most labels, properties and declared edges, and marks which labels
 * cannot open a pattern; completion and hover used to show names only, and a person learned that
 * `MATCH (r:ConfigRun)` needs `(me:AssistantUser)-[:HAS_CONFIG]->` from the refusal.
 *
 * The schema below is the config catalog's shape as `GET /kg/studio/schema` serves it.
 */
const schema: vc.GraphSchema = {
  labels: [
    { label: 'AssistantUser', properties: [], anchor: true, description: 'You — the person signed in.' },
    {
      label: 'ConfigRun',
      anchor: false,
      description: 'One code-mode execution that actually happened (config catalog; read-only).',
      properties: [
        { name: 'at', type: 'string', description: "When it ran, as ISO-8601 text (wrap it in datetime() to compare it with a date)." },
        { name: 'success', type: 'boolean', description: 'Exit 0 AND no validator violations — not the same as COMPLETED.' },
        { name: 'scriptName', type: 'any' },
        { name: 'runId', type: 'any', description: 'runId' },
      ],
    },
    { label: 'ConfigView', anchor: false, properties: [{ name: 'name', type: 'string', description: "The view's name." }] },
    { label: 'Document', anchor: true, properties: [{ name: 'title', type: 'string' }] },
  ],
  relationships: [
    { from: 'AssistantUser', type: 'HAS_CONFIG', to: 'ConfigRun', description: 'Code-mode executions, newest first.' },
    { from: 'AssistantUser', type: 'HAS_CONFIG', to: 'ConfigView', description: "The world's saved views." },
  ],
}

describe('reading what the schema says of a name', () => {
  it('a property keeps its type and description; propertiesOf still answers names alone', () => {
    assert.deepEqual(vc.propertiesOf(schema, 'ConfigRun'), ['at', 'success', 'scriptName', 'runId'])
    assert.equal(vc.propertyDetails(schema, 'ConfigRun')[1]?.type, 'boolean')
    assert.equal(vc.propertyDoc(vc.propertyDetails(schema, 'ConfigRun')[0]!), 'string — When it ran, as ISO-8601 text (wrap it in datetime() to compare it with a date).')
    // `any` says nothing, so it is not shown as if it were a type; nor is a description that is the name.
    assert.equal(vc.propertyDoc({ name: 'scriptName', type: 'any' }), '')
    assert.equal(vc.propertyDoc({ name: 'runId', type: 'any', description: 'runId' }), '')
  })

  it('a reach-only label knows its way in, from what the schema marks', () => {
    assert.deepEqual(vc.labelDoors(schema, 'ConfigRun'), [
      { anchor: 'AssistantUser', type: 'HAS_CONFIG', direction: 'out', description: 'Code-mode executions, newest first.' },
    ])
    assert.deepEqual(vc.labelDoors(schema, 'Document'), [], 'a label that opens a pattern needs no door')
    assert.equal(vc.anchoredPattern(vc.labelDoors(schema, 'ConfigRun')[0]!, 'ConfigRun', 'r'), '(me:AssistantUser)-[:HAS_CONFIG]->(r:ConfigRun)')
    assert.equal(vc.anchoredPattern(vc.labelDoors(schema, 'ConfigRun')[0]!, 'ConfigRun', 'me'), '(me2:AssistantUser)-[:HAS_CONFIG]->(me:ConfigRun)')
  })

  it("a reach-only label's doc says how it is reached, after what it is", () => {
    assert.equal(
      vc.labelDoc(schema, 'ConfigRun'),
      'One code-mode execution that actually happened (config catalog; read-only).\n\n' +
        'Reached only from an anchor — MATCH (c:ConfigRun) alone is refused. Write (me:AssistantUser)-[:HAS_CONFIG]->(c:ConfigRun).',
    )
    assert.equal(vc.labelDoc(schema, 'Document'), '', 'nothing declared, nothing to say')
  })

  it('a relationship with both ends known reads that edge; otherwise the ends it joins', () => {
    assert.equal(vc.relationshipDoc(schema, 'HAS_CONFIG', 'AssistantUser', 'ConfigRun'), '(:AssistantUser)-[:HAS_CONFIG]->(:ConfigRun)\nCode-mode executions, newest first.')
    assert.equal(
      vc.relationshipDoc(schema, 'HAS_CONFIG', 'AssistantUser'),
      '(:AssistantUser)-[:HAS_CONFIG]->(:ConfigRun)\n(:AssistantUser)-[:HAS_CONFIG]->(:ConfigView)',
    )
  })
})

describe('hover', () => {
  const cypher = 'MATCH (me:AssistantUser)-[:HAS_CONFIG]->(r:ConfigRun) WHERE r.success RETURN r.at'

  it('answers for a label, an alias of one, a property and a relationship', () => {
    assert.equal(vc.tokenDoc(schema, 'r:ConfigRun', 'MATCH (me:AssistantUser)-[:HAS_CONFIG]->(', cypher)?.label?.label, 'ConfigRun')
    assert.match(vc.tokenDoc(schema, 'r', 'MATCH (me:AssistantUser)-[:HAS_CONFIG]->(r:ConfigRun) WHERE ', cypher)!.text, /HAS_CONFIG/)
    assert.deepEqual(vc.tokenDoc(schema, 'at', 'MATCH (me:AssistantUser)-[:HAS_CONFIG]->(r:ConfigRun) WHERE r.success RETURN r.', cypher), {
      title: 'ConfigRun.at',
      text: 'string — When it ran, as ISO-8601 text (wrap it in datetime() to compare it with a date).',
    })
    assert.deepEqual(vc.tokenDoc(schema, ':HAS_CONFIG', 'MATCH (me:AssistantUser)-[', cypher), {
      title: ':HAS_CONFIG',
      text: '(:AssistantUser)-[:HAS_CONFIG]->(:ConfigRun)\nCode-mode executions, newest first.',
    })
  })

  it('a bare MATCH of a reach-only label is told, on hover, how it is reached', () => {
    const bare = 'MATCH (r:ConfigRun) RETURN r'
    assert.match(vc.tokenDoc(schema, 'r:ConfigRun', 'MATCH (', bare)!.text, /Write \(me:AssistantUser\)-\[:HAS_CONFIG\]->\(c:ConfigRun\)/)
  })

  it('names nothing the schema knows - no tooltip', () => {
    assert.equal(vc.tokenDoc(schema, 'WHERE', 'MATCH (d:Document) ', 'MATCH (d:Document) WHERE'), null)
  })
})

describe('completion carries what each name means', () => {
  it('properties come with their type and description', () => {
    const c = cypherFragmentCompletions(vc, schema, 'r.', 'MATCH (me:AssistantUser)-[:HAS_CONFIG]->(r:ConfigRun) RETURN r.')
    assert.deepEqual(c?.list, ['at', 'success', 'scriptName', 'runId'], 'the names are unchanged for callers that insert text alone')
    assert.deepEqual(c?.items?.[0], {
      label: 'at', text: 'at', detail: 'string',
      doc: 'When it ran, as ISO-8601 text (wrap it in datetime() to compare it with a date).',
    })
    assert.equal(c?.items?.[2]?.detail, undefined, '`any` is not shown as a type')
    assert.equal(c?.items?.[3]?.doc, undefined, 'an older appliance describing runId as "runId" says nothing')
  })

  it('a relationship comes with what it is for', () => {
    const c = cypherFragmentCompletions(vc, schema, 'MATCH (me:AssistantUser)-[:', 'MATCH (me:AssistantUser)-[:')
    assert.deepEqual(c?.list, ['HAS_CONFIG'])
    assert.match(c!.items![0]!.doc!, /ConfigRun/)
  })

  it('a reach-only label typed at the head of a pattern is offered as the pattern that reaches it', () => {
    const c = cypherFragmentCompletions(vc, schema, 'MATCH (r:ConfigR', 'MATCH (r:ConfigR')
    assert.deepEqual(c?.list, [], 'it is still never offered bare there')
    assert.deepEqual(
      c?.items?.map((i) => [i.label, i.text, i.replaceLength]),
      [['ConfigRun via AssistantUser', 'me:AssistantUser)-[:HAS_CONFIG]->(r:ConfigRun', 'r:ConfigR'.length]],
    )
  })

  it('with no stem, the head of a pattern lists openers only — not every anchored form in the world', () => {
    const c = cypherFragmentCompletions(vc, schema, 'MATCH (r:', 'MATCH (r:')
    assert.deepEqual(c?.items?.map((i) => i.label), ['AssistantUser', 'Document'])
  })

  it('the editor replaces what was typed with the anchored form', () => {
    const CodeMirrorish = { Pos: (line: number, ch: number) => ({ line, ch }) }
    const text = 'MATCH (r:ConfigR'
    const hint = createCypherHint(CodeMirrorish, vc, { schema: () => schema })
    const result = hint({ getCursor: () => ({ line: 0, ch: text.length }), getLine: () => text, getValue: () => text })
    const item = result!.list[0] as { text: string; displayText: string; from: { ch: number } }
    assert.equal(item.displayText, 'ConfigRun via AssistantUser')
    assert.equal(text.slice(0, item.from.ch) + item.text, 'MATCH (me:AssistantUser)-[:HAS_CONFIG]->(r:ConfigRun')
  })

  it('an older vc, injected without the documentation readers, completes names as before', () => {
    const { labelDoc: _a, propertyDetails: _b, labelDoors: _c, anchoredPattern: _d, labelNames: _e, relationshipDoc: _f, ...older } = vc
    const c = cypherFragmentCompletions(older as any, schema, 'r.', 'MATCH (me:AssistantUser)-[:HAS_CONFIG]->(r:ConfigRun) RETURN r.')
    assert.deepEqual(c?.list, ['at', 'success', 'scriptName', 'runId'])
    assert.deepEqual(cypherFragmentCompletions(older as any, schema, 'MATCH (r:ConfigR', 'MATCH (r:ConfigR')?.items, [])
  })
})
