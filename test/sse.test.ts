import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { createSseParser } from '../src/client/sse.ts'

describe('createSseParser', () => {
  it('reads a named event with its data', () => {
    const p = createSseParser()
    assert.deepEqual(p.push('event: query.started\ndata: {"a":1}\n\n'), [
      { event: 'query.started', data: '{"a":1}' },
    ])
  })

  it('buffers a frame split across chunks — the whole reason it is incremental', () => {
    const p = createSseParser()
    assert.deepEqual(p.push('event: stage.started\nda'), [])
    assert.deepEqual(p.push('ta: {"stage":1}\n\n'), [{ event: 'stage.started', data: '{"stage":1}' }])
  })

  it('returns several events arriving in one chunk, in order', () => {
    const p = createSseParser()
    const events = p.push('event: a\ndata: 1\n\nevent: b\ndata: 2\n\n')
    assert.deepEqual(events.map((e) => e.event), ['a', 'b'])
  })

  it('defaults an unnamed frame to `message`, per the spec', () => {
    assert.deepEqual(createSseParser().push('data: hello\n\n'), [{ event: 'message', data: 'hello' }])
  })

  it('joins multi-line data with newlines rather than concatenating it', () => {
    assert.deepEqual(createSseParser().push('data: one\ndata: two\n\n'), [{ event: 'message', data: 'one\ntwo' }])
  })

  it('strips exactly one space after the colon, keeping the rest of the value', () => {
    assert.deepEqual(createSseParser().push('data:  padded\n\n'), [{ event: 'message', data: ' padded' }])
  })

  it('handles CRLF, which otherwise leaves \\r on the JSON and breaks the parse', () => {
    assert.deepEqual(createSseParser().push('event: x\r\ndata: {"a":1}\r\n\r\n'), [
      { event: 'x', data: '{"a":1}' },
    ])
  })

  it('ignores comment keep-alives, which servers send to hold the connection open', () => {
    const p = createSseParser()
    assert.deepEqual(p.push(': keep-alive\n\n'), [])
    assert.deepEqual(p.push('event: real\ndata: 1\n\n'), [{ event: 'real', data: '1' }])
  })

  it('carries an id when the stream sends one, and omits the key when it does not', () => {
    assert.deepEqual(createSseParser().push('id: 7\ndata: x\n\n'), [{ event: 'message', data: 'x', id: '7' }])
    assert.ok(!('id' in createSseParser().push('data: x\n\n')[0]!))
  })

  it('does not emit a frame that never terminated', () => {
    // A stream cut off mid-event must yield nothing rather than half an event.
    assert.deepEqual(createSseParser().push('event: partial\ndata: {"a"'), [])
  })
})
