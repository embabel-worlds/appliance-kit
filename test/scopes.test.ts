import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { SCOPE_NAME, scopeLabel, scopeReference, referencedScopeNames } from '../src/vc/scopes.ts'

describe('scope reference grammar', () => {
  it('spells the backtick-quoted label form', () => {
    assert.equal(scopeLabel('overdue'), '`$overdue`')
    assert.equal(scopeReference('overdue', 'b'), '(b:`$overdue`)')
    assert.equal(scopeReference('overdue'), '(x:`$overdue`)')
  })

  it('finds referenced names, first-appearance order, deduplicated', () => {
    const cypher = 'MATCH (b:`$overdue`) MATCH (o:`$vendors`) MATCH (c:`$overdue`) RETURN b'
    assert.deepEqual(referencedScopeNames(cypher), ['overdue', 'vendors'])
  })

  it('a plain label or bind variable is never a reference', () => {
    assert.deepEqual(referencedScopeNames('MATCH (b:overdue) WHERE b.amount > $min RETURN b'), [])
  })

  it('validates names as plain identifiers', () => {
    assert.ok(SCOPE_NAME.test('overdue_2'))
    assert.ok(!SCOPE_NAME.test('2bad'))
    assert.ok(!SCOPE_NAME.test('has space'))
  })
})
