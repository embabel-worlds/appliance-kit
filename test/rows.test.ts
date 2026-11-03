import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { INTERNAL_PROPERTIES, isInternalProperty, rowColumns, rowGraph, rowsToCsv, rowsToMarkdown, shownValue } from '../src/vc/index.ts'

/*
 * WHAT YOU COPY IS WHAT YOU SAW: columns in first-seen order (the table's own
 * rule), null as empty, objects as JSON — plus each format's escaping, which is
 * where hand-rolled serializers quietly corrupt a paste.
 */
describe('result rows, serialized', () => {
  const rows = [
    { title: 'Renewal terms', score: 0.92, tags: ['legal', 'contract'] },
    { title: 'Notes | draft', score: null, extra: 'seen "later", ok?\nsecond line' },
  ]

  it('orders columns as the table renders them — union, first seen first', () => {
    assert.deepEqual(rowColumns(rows), ['title', 'score', 'tags', 'extra'])
  })

  it('markdown escapes pipes and flattens newlines — a broken row is worse than a joined line', () => {
    const md = rowsToMarkdown(rows)
    assert.equal(md.split('\n').length, 4, 'header + separator + one line per row')
    assert.match(md, /\| title \| score \| tags \| extra \|/)
    assert.match(md, /Notes \\\| draft/, 'the pipe in the value must not open a column')
    assert.match(md, /seen "later", ok\? second line/, 'the newline joins, the row survives')
    assert.match(md, /\| \["legal","contract"\] \|/, 'lists paint as JSON, same as the table')
  })

  it('csv quotes what needs quoting and doubles inner quotes', () => {
    const csv = rowsToCsv(rows)
    const lines = csv.split('\n')
    assert.equal(lines[0], 'title,score,tags,extra')
    assert.match(csv, /"\[""legal"",""contract""\]"/, 'JSON list: quoted, inner quotes doubled')
    assert.match(csv, /"seen ""later"", ok\?\nsecond line"/, 'newline survives inside quotes')
    assert.match(csv, /Renewal terms,0.92/, 'plain fields stay unquoted')
  })

  it('serializes nothing from nothing', () => {
    assert.equal(rowsToMarkdown([]), '')
    assert.equal(rowsToCsv([]), '')
  })
})

/*
 * WHAT THE GRAPH VIEW DRAWS: every entity in every cell, once. The shapes are the studio execute's
 * own (embabel/me#3528) — the fromText row below is what a live appliance answered.
 */
describe('result rows, drawn', () => {
  const ada = { name: 'Ada Lovelace', __type: 'Pioneer', __labels: ['Pioneer'], __elementId: '4:e:1' }
  const engine = { name: 'Analytical Engine', __type: 'Machine', __labels: ['Machine'], __elementId: '4:e:2' }
  const worked = { __type: 'WORKED_ON', __elementId: '5:e:3', __startElementId: '4:e:1', __endElementId: '4:e:2' }

  it('reads nodes and relationships out of a row, captioned by name, without the __ keys', () => {
    const graph = rowGraph([{ p: ada, w: worked, m: engine }])
    assert.deepEqual(graph.nodes.map((n) => [n.id, n.caption, n.labels, n.placeholder]), [
      ['4:e:1', 'Ada Lovelace', ['Pioneer'], false],
      ['4:e:2', 'Analytical Engine', ['Machine'], false],
    ])
    assert.deepEqual(graph.nodes[0]!.properties, { name: 'Ada Lovelace' })
    assert.deepEqual(graph.edges, [{ id: '5:e:3', type: 'WORKED_ON', source: '4:e:1', target: '4:e:2', properties: {} }])
  })

  it('keeps each entity once, however many rows return it', () => {
    const graph = rowGraph([{ p: ada, m: engine }, { p: ada, m: engine }, { p: ada }])
    assert.equal(graph.nodes.length, 2)
  })

  it('walks lists, paths and nested maps', () => {
    const graph = rowGraph([{ path: [ada, worked, engine], extra: { holder: { inner: [ada] } }, n: 3 }])
    assert.deepEqual(graph.nodes.map((n) => n.id), ['4:e:1', '4:e:2'])
    assert.equal(graph.edges.length, 1)
  })

  it('adds a marked placeholder for an end the rows did not return, replaced if a later cell holds it', () => {
    const alone = rowGraph([{ w: worked }])
    assert.deepEqual(alone.nodes.map((n) => [n.id, n.placeholder]), [['4:e:1', true], ['4:e:2', true]])
    const later = rowGraph([{ w: worked }, { p: ada }])
    assert.deepEqual(later.nodes.map((n) => [n.id, n.placeholder]), [['4:e:1', false], ['4:e:2', true]])
  })

  it('finds nothing in plain values — the graph view then stays hidden', () => {
    const graph = rowGraph([{ hobby: 'Chess', where: 'indoors' }, { tags: ['a', 'b'], meta: { n: 1 } }])
    assert.deepEqual(graph, { nodes: [], edges: [] })
  })

  it('captions a node with no name-like property by its first label', () => {
    const graph = rowGraph([{ n: { __labels: ['Thing', 'Other'], __elementId: '4:e:9', size: 3 } }])
    assert.equal(graph.nodes[0]!.caption, 'Thing')
  })
})

/*
 * BOOKKEEPING IS NOT DATA: an entity's tenancy stamps, its extractor and its `__` keys are hidden
 * wherever its properties are shown, and everything else is kept. The node below is what a live
 * appliance answered for `ai.fromText`.
 */
describe('an entity\'s properties, as shown', () => {
  const extracted = {
    userId: 'demo_assistant', worldId: 'demo_assistant', workspaceId: 'w', visibleTo: ['demo'],
    sourceSpan: 'Ada Lovelace', extractedBy: 'vc_extraction:ByRoleModelSelectionCriteria(role=vc_extraction)',
    name: 'Ada Lovelace', __type: 'Pioneer', __labels: ['Pioneer'], __elementId: '4:e:1',
  }

  it('names the hidden fields in one list, and treats any __ key as bookkeeping', () => {
    assert.deepEqual([...INTERNAL_PROPERTIES].sort(), ['extractedBy', 'userId', 'visibleTo', 'workspaceId', 'worldId'])
    assert.equal(isInternalProperty('__anything'), true)
    assert.equal(isInternalProperty('name'), false)
    assert.equal(isInternalProperty('sourceSpan'), false)
  })

  it('the graph panel shows the node\'s own properties and its label', () => {
    const node = rowGraph([{ p: extracted }]).nodes[0]!
    assert.deepEqual(node.properties, { sourceSpan: 'Ada Lovelace', name: 'Ada Lovelace' })
    assert.deepEqual(node.labels, ['Pioneer'])
  })

  it('a table cell and what Copy writes hide the same fields, inside lists and paths too', () => {
    assert.deepEqual(shownValue({ p: [extracted] }), { p: [{ sourceSpan: 'Ada Lovelace', name: 'Ada Lovelace' }] })
    assert.doesNotMatch(rowsToCsv([{ p: extracted }]), /demo_assistant|vc_extraction|__elementId/)
    assert.match(rowsToMarkdown([{ p: extracted }]), /"sourceSpan":"Ada Lovelace"/)
  })

  it('a column somebody projected by name is their question, and is shown', () => {
    assert.deepEqual(shownValue({ userId: 'u1', name: 'x' }), { userId: 'u1', name: 'x' })
    assert.match(rowsToCsv([{ owner: 'demo_assistant' }]), /demo_assistant/)
  })
})
