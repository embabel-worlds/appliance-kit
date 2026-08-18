import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  MAX_LOG_LINES, isAtBottom, matchesFilter, pendingBehind, severityOfLevel, severityOfLine,
} from '../src/studio-kit/logs.ts'

describe('severity from a formatted line', () => {
  it('reads the level a JVM log line carries', () => {
    assert.equal(severityOfLine('15:31:40.023  WARN DeserializationUtils : Error snake-parsing'), 'warn')
    assert.equal(severityOfLine('10:18:43 ERROR Neo4jVirtualCypher : materialize failed'), 'error')
    assert.equal(severityOfLine('10:18:43  INFO operator : World warmed in 4.8s'), '')
  })

  it('needs a WORD, so prose about errors is not painted as one', () => {
    // The difference between colour that means something and colour that becomes wallpaper.
    assert.equal(severityOfLine('the walk completed with no errors'), '')
    assert.equal(severityOfLine('WARNING: rate limited'), 'warn')
  })
})

describe('severity from a structured level', () => {
  it('does not guess when the source already knows', () => {
    assert.equal(severityOfLevel('ERROR'), 'error')
    assert.equal(severityOfLevel('warn'), 'warn')
    assert.equal(severityOfLevel('INFO'), '')
    assert.equal(severityOfLevel(null), '')
  })
})

describe('the filter', () => {
  it('is a case-insensitive substring, and an empty needle keeps everything', () => {
    assert.equal(matchesFilter('[virtual-cypher] producer x', 'PRODUCER'), true)
    assert.equal(matchesFilter('[virtual-cypher] producer x', '  '), true)
    assert.equal(matchesFilter('[virtual-cypher] producer x', 'neo4j'), false)
  })
})

describe('following the tail', () => {
  it('chases only when the reader is already at the bottom', () => {
    assert.equal(isAtBottom({ scrollHeight: 1000, scrollTop: 900, clientHeight: 100 }), true)
    // Scrolled up to read something: yanking them back makes a busy log unusable.
    assert.equal(isAtBottom({ scrollHeight: 1000, scrollTop: 200, clientHeight: 100 }), false)
  })

  it('tolerates a sub-pixel scroll position, which never lands exactly on the end', () => {
    assert.equal(isAtBottom({ scrollHeight: 1000, scrollTop: 880.5, clientHeight: 100 }), true)
  })
})

describe('paused', () => {
  it('reports how far behind the frozen view has fallen, and never a negative', () => {
    assert.equal(pendingBehind(120, 100), 20)
    assert.equal(pendingBehind(100, 100), 0)
    assert.equal(pendingBehind(90, 100), 0)
  })
})

describe('the line cap', () => {
  it('is one number, so "it stopped showing me things" happens in one place', () => {
    assert.equal(MAX_LOG_LINES, 5000)
  })
})
