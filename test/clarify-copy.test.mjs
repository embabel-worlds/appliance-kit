import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync, readdirSync } from 'node:fs'
import ts from 'typescript'
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { JSDOM } from 'jsdom'
import { CopyButton, Status, failureMessage } from '../dist/esm/react/features/studio/chrome.js'

const dom = new JSDOM('<div id="root"></div>')
for (const key of ['window', 'document', 'navigator']) Object.defineProperty(globalThis, key, { value: dom.window[key], configurable: true })
globalThis.IS_REACT_ACT_ENVIRONMENT = true

test('studio failures distinguish access, missing capability and connection recovery', () => {
  const f = (kind, status, message = 'Server detail') => failureMessage({ ok: false, kind, status, message }, 'run the view')
  assert.match(f('unauthorized', 401), /Sign in again/)
  assert.doesNotMatch(f('unauthorized', undefined), /401|403/)
  assert.match(f('unauthorized', 403), /administrator.*access/)
  assert.doesNotMatch(f('unauthorized', 403), /Sign in again/)
  assert.match(f('unsupported', 404), /Could not run the view \(HTTP 404\).*not available/)
  assert.doesNotMatch(f('unsupported', 404), /predates|older/)
  assert.match(f('unreachable', 0), /HTTP 0.*connection.*Server detail/)
  assert.match(f('failed', 503), /Could not run the view \(HTTP 503\).*Server detail/)
  for (const kind of ['unauthorized', 'unsupported', 'unreachable', 'failed', 'refused']) {
    for (const status of [undefined, 401, 403, 404, 503]) {
      const text = f(kind, status)
      assert.ok(text.includes('Server detail'), `${kind}/${status}: server detail lost`)
      assert.equal(/HTTP \d+/.test(text), status !== undefined)
      if (status !== undefined) assert.ok(text.includes(`HTTP ${status}`))
      assert.match(text, /^(Could not|You are not allowed|Sign in again)/)
    }
  }
})

test('every kit failure caller supplies an infinitive action, including hook and refinement alternatives', () => {
  const root = new URL('../src/', import.meta.url)
  let count = 0
  const check = action => assert.match(action, /^(list|check|load|save|dry-run|open|change|delete|run|prepare|refresh|stop|refine|generate|start|capture|pin) /)
  for (const path of readdirSync(root, { recursive: true }).filter(p => p.endsWith('.tsx'))) {
    const source = ts.createSourceFile(path, readFileSync(new URL(path, root), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
    const calls = []
    const visit = node => { if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) calls.push(node); ts.forEachChild(node, visit) }
    visit(source)
    const checkArgument = node => {
      if (ts.isConditionalExpression(node)) { checkArgument(node.whenTrue); checkArgument(node.whenFalse); return }
      if (ts.isIdentifier(node) && node.text === 'action') {
        const loads = calls.filter(c => c.expression.text === 'useLoadable')
        assert.equal(loads.length, 2)
        loads.forEach(c => checkArgument(c.arguments[1])); return
      }
      check(ts.isTemplateExpression(node) ? node.head.text : node.text)
    }
    for (const call of calls.filter(c => c.expression.text === 'failureMessage')) { count++; checkArgument(call.arguments[1]) }
  }
  assert.equal(count, 33)
  assert.throws(() => check('saved views'))
  assert.throws(() => check('listing documents'))
})

test('studio copy acknowledges only a completed write and announces a recoverable failure', async () => {
  const root = createRoot(document.querySelector('#root'))
  let finish
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: () => new Promise(resolve => { finish = resolve }) } })
  await act(async () => root.render(React.createElement(CopyButton, { label: 'Copy as CSV', text: 'a,b' })))
  const button = document.querySelector('button')
  await act(async () => button.click())
  assert.equal(button.textContent, 'Copy as CSV')
  await act(async () => finish())
  assert.equal(button.textContent, 'Copied')
  navigator.clipboard.writeText = async () => { throw Error('Permission denied') }
  await act(async () => button.click())
  assert.equal(button.textContent, 'Copy failed — check browser clipboard access')
  assert.equal(button.getAttribute('aria-live'), 'polite')
  await act(async () => root.unmount())
})

test('unavailable clipboard offers a context-specific alternative, never a futile retry', async () => {
  const root = createRoot(document.querySelector('#root'))
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined })
  for (const secure of [false, true]) {
    Object.defineProperty(window, 'isSecureContext', { configurable: true, value: secure })
    await act(async () => root.render(React.createElement(CopyButton, { label: 'Copy', text: 'value' })))
    await act(async () => document.querySelector('button').click())
    assert.match(document.querySelector('button').textContent, secure ? /clipboard-enabled browser/ : /HTTPS/)
    assert.doesNotMatch(document.querySelector('button').textContent, /try again|Copied/)
  }
  await act(async () => root.unmount())
})

test('studio action feedback retains status and error announcement semantics', async () => {
  const root = createRoot(document.querySelector('#root'))
  await act(async () => root.render(React.createElement(Status, { tone: 'error' }, 'Run failed')))
  assert.equal(document.querySelector('.status').getAttribute('role'), 'alert')
  await act(async () => root.render(React.createElement(Status, { tone: 'ok' }, 'Saved')))
  assert.equal(document.querySelector('.status').getAttribute('role'), 'status')
  await act(async () => root.unmount())
})
