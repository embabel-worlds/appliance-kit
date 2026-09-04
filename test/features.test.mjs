import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import { JSDOM } from 'jsdom'
import { act, createElement as h } from 'react'

const dom = new JSDOM('<!doctype html><html><body></body></html>', {
  pretendToBeVisual: true,
  url: 'https://world.example/ui',
})

for (const key of [
  'window', 'document', 'navigator', 'HTMLElement', 'HTMLButtonElement', 'HTMLInputElement',
  'Event', 'KeyboardEvent', 'MouseEvent', 'MutationObserver', 'Node', 'Range', 'CSS',
]) {
  Object.defineProperty(globalThis, key, {
    configurable: true,
    writable: true,
    value: key === 'CSS' ? (dom.window.CSS ?? { escape: (value) => String(value) }) : dom.window[key],
  })
}
if (!Range.prototype.getBoundingClientRect) {
  Range.prototype.getBoundingClientRect = () => ({ left: 0, right: 0, top: 0, bottom: 0, width: 0, height: 0 })
}
if (!Range.prototype.getClientRects) Range.prototype.getClientRects = () => []
globalThis.requestAnimationFrame = dom.window.requestAnimationFrame.bind(dom.window)
globalThis.cancelAnimationFrame = dom.window.cancelAnimationFrame.bind(dom.window)
globalThis.IS_REACT_ACT_ENVIRONMENT = true
globalThis.confirm = () => true

const { createRoot } = await import('react-dom/client')
const features = await import('@embabel/appliance-kit/react/features')
const activeRoots = new Set()
const ok = (value) => ({ ok: true, value })
const refused = (message) => ({ ok: false, kind: 'refused', message, status: 400 })

async function flush() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
}

async function render(node) {
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  activeRoots.add(root)
  await act(async () => root.render(node))
  await flush()
  return { container, root }
}

const button = (container, text) => [...container.querySelectorAll('button')]
  .find((candidate) => candidate.textContent.trim().includes(text))

function setInput(input, value) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
  setter.call(input, value)
  input.dispatchEvent(new Event('input', { bubbles: true }))
}

afterEach(async () => {
  await act(async () => {
    for (const root of activeRoots) root.unmount()
  })
  activeRoots.clear()
  document.body.replaceChildren()
})

describe('the public browser feature entry point', () => {
  it('loads the real browser feature exports after browser globals exist', () => {
    for (const name of [
      'AppsSurface', 'PinRail', 'RealmsSurface', 'SavedViewsSurface',
      'HandlerStudioSurface', 'QueryStudioSurface', 'CodingAgentsSurface',
    ]) {
      assert.equal(typeof features[name], 'function', `${name} ESM export`)
    }
  })

  it('keeps apps grouped, pinned and confined to validated same-origin scoped URLs', async () => {
    let pins = []
    const pinListeners = new Set()
    let selected = null
    const selectionListeners = new Set()
    const opened = []
    const tabs = []
    const host = {
      pins: {
        getSnapshot: () => pins,
        subscribe: (listener) => { pinListeners.add(listener); return () => pinListeners.delete(listener) },
        toggle: (pin) => { pins = pins.some((item) => item.key === pin.key) ? [] : [pin]; for (const listener of pinListeners) listener() },
        reconcile: () => {},
      },
      selectedAppKey: () => selected,
      subscribeSelection: (listener) => { selectionListeners.add(listener); return () => selectionListeners.delete(listener) },
      openApp: (app) => { selected = app ? `${app.scope ?? ''}/${app.name}` : null; opened.push(app); for (const listener of selectionListeners) listener() },
      openInNewTab: (url) => tabs.push(url),
    }
    const apps = [
      { name: 'ledger.html', scope: 'world', url: '/apps/world/ledger.html', description: 'Ledger' },
      { name: 'evil.html', scope: 'world', url: 'https://evil.example/apps/world/evil.html' },
    ]
    const { container } = await render(h(features.AppsSurface, {
      services: { listApps: async () => ok(apps), searchApps: async () => ok({ rows: [] }) },
      host,
    }))
    await act(async () => button(container, 'World template').click())
    const rows = [...container.querySelectorAll('.approw')]
    const ledger = rows.find((row) => row.textContent.includes('ledger'))
    const evil = rows.find((row) => row.textContent.includes('evil'))
    await act(async () => button(ledger, 'Open').click())
    assert.equal(opened.at(-1).name, 'ledger.html')
    await act(async () => ledger.querySelector('.app-pin').click())
    assert.equal(pins[0].key, 'world/ledger.html')
    await act(async () => button(evil, 'Open').click())
    assert.equal(opened.some((app) => app?.name === 'evil.html'), false)
    assert.deepEqual(tabs, [])
  })

  it('preserves realm install failure feedback and pending-control gating', async () => {
    let release
    const pending = new Promise((resolve) => { release = resolve })
    const services = {
      listInstalled: async () => ok([]),
      listDirectory: async () => ok({ providers: [{ provider: 'embabel', realms: [{ name: 'research', repo: 'github.com/embabel/research' }] }] }),
      refreshDirectory: async () => ok(undefined),
      installRealm: async () => pending,
      listUpdates: async () => ok({ results: [] }),
      updateRealm: async () => ok({ summary: 'current' }),
      updateAll: async () => ok({ results: [] }),
      searchRealms: async () => ok({ rows: [] }),
      listTours: async () => ok([]),
    }
    const { container } = await render(h(features.RealmsSurface, {
      services,
      host: { openTour() {}, confirmUpdateAll: async () => true },
    }))
    const install = button(container, 'Install')
    await act(async () => install.click())
    assert.equal(install.disabled, true)
    await act(async () => release(refused('repository is private')))
    await flush()
    assert.match(container.textContent, /repository is private/)
  })

  it('requires host confirmation before updating every realm', async () => {
    let updates = 0
    let confirm = false
    const services = {
      listInstalled: async () => ok([{ name: 'research', version: '1', description: 'Research' }]),
      listDirectory: async () => ok({ providers: [] }),
      refreshDirectory: async () => ok(undefined),
      installRealm: async () => ok({ installed: true }),
      listUpdates: async () => ok({ results: [{ name: 'research', behind: true }] }),
      updateRealm: async () => ok({ summary: 'current' }),
      updateAll: async () => { updates += 1; return ok({ results: [] }) },
      searchRealms: async () => ok({ rows: [] }),
      listTours: async () => ok([]),
    }
    const { container } = await render(h(features.RealmsSurface, {
      services,
      host: { openTour() {}, confirmUpdateAll: async () => confirm },
    }))
    await act(async () => button(container, 'Update 1').click())
    assert.equal(updates, 0)
    confirm = true
    await act(async () => button(container, 'Update 1').click())
    assert.equal(updates, 1)
  })

  it('runs grouped views with typed parameters and hands a typed handler draft to the host', async () => {
    const runs = []
    const drafts = []
    const views = [{ name: 'Overdue', source: 'finance', cypher: 'MATCH (n)', params: { state: { default: 'late' } } }]
    const services = {
      kg: {
        views: async () => ok(views),
        runView: async (name, args) => { runs.push([name, args]); return ok({ rows: [{ id: 1 }], rowCount: 1 }) },
        viewInvocation: async () => ok({ cypher: 'MATCH (n)' }),
        deleteView: async () => ok({ deleted: true }),
        refreshView: async () => ok({ refreshed: true }),
      },
      watches: {
        list: async () => ok([{ id: 'w1', lensId: 'Overdue', name: 'Overdue', cron: null, enabled: true, delivery: { channel: 'signal' } }]),
        create: async (value) => ok({ id: 'w1', ...value, enabled: true }),
        delete: async () => ok(undefined), run: async () => ok(undefined),
        runs: async () => ok([]), changes: async () => ok([]), deliveries: async () => ok([]),
      },
    }
    const host = {
      selectedView: () => null, subscribeSelection: () => () => {},
      onOpenInStudio() {}, onCreateHandler: (draft) => drafts.push(draft),
    }
    const { container } = await render(h(features.SavedViewsSurface, { services, host }))
    await act(async () => button(container, 'finance').click())
    await act(async () => button(container, 'Overdue').click())
    await act(async () => button(container, 'Run').click())
    assert.deepEqual(runs, [['Overdue', { state: 'late' }]])
    await act(async () => button(container, 'Write an agent').click())
    assert.deepEqual(drafts, [{ signalType: 'view.Overdue.changed', view: 'Overdue' }])
  })

  it('treats a save payload with ok false as failure and keeps enabling separate', async () => {
    let enableCalls = 0
    const services = {
      kg: { schema: async () => ok({ labels: [], relationships: [] }) },
      handlers: {
        list: async () => ok({ yours: [], available: [] }),
        open: async () => refused('absent'),
        validate: async () => ok({ valid: true, violations: [], durationMs: 1 }),
        dryRun: async () => ok({ ok: true, stdout: '', ranAgainst: {} }),
        setEnabled: async () => { enableCalls += 1; return ok({ enabled: true }) },
        delete: async () => ok({ deleted: true }),
      },
      generateHandler: async () => ok({ source: '', valid: true, attempts: 1 }),
      saveHandler: async () => ok({ ok: false, message: 'validation failed' }),
      gatewayInterfaces: async () => ok('export interface GatewayContext {}'),
      signalTypes: async () => ok([]), worldSkills: async () => ok([]),
    }
    const { container } = await render(h(features.HandlerStudioSurface, { services }))
    const name = [...container.querySelectorAll('input')].find((input) => input.placeholder === 'pr-triage')
    await act(async () => setInput(name, 'triage'))
    await act(async () => button(container, 'Save agent').click())
    await flush()
    assert.match(container.textContent, /validation failed/)
    assert.equal(enableCalls, 0)
  })

  it('blocks invalid query execution and aborts a live progress subscription on unmount', async () => {
    let executeCalls = 0
    let signal
    const history = { read: () => [], write() {} }
    const session = { read: () => null, write() {} }
    const base = {
      runs: async () => ok([]), schema: async () => ok({ labels: [], relationships: [] }),
      kill: async () => ok({ killed: true }), generate: async () => ok({ cypher: '' }),
      refine: async () => ok({ cypher: '' }), saveView: async () => ok({ saved: true }),
      scopes: async () => ok({ scopes: [] }), pinScope: async () => ok({ pinned: true }),
      deleteScope: async () => ok({ deleted: true }),
    }
    const invalidServices = {
      kg: { ...base, validate: async () => ok({ ok: false, violations: ['bad query'] }), execute: async () => { executeCalls += 1; return ok({ rows: [] }) } },
      fills: { list: async () => ok([]), create: async () => ok({ id: 'f' }), delete: async () => ok(undefined) },
      subscribeProgress() {},
    }
    let rendered = await render(h(features.QueryStudioSurface, { services: invalidServices, host: { history, interactive: { session } } }))
    const cm = rendered.container.querySelector('.CodeMirror').CodeMirror
    await act(async () => cm.setValue('not cypher'))
    assert.equal(button(rendered.container, 'Run').disabled, true)
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 750)) })
    assert.equal(executeCalls, 0)
    assert.match(rendered.container.textContent, /1 schema problem/)

    await act(async () => rendered.root.unmount())
    activeRoots.delete(rendered.root)
    const liveServices = {
      ...invalidServices,
      kg: { ...base, validate: async () => ok({ ok: true, violations: [] }), execute: async () => new Promise(() => {}) },
      subscribeProgress: (_onEvent, nextSignal) => { signal = nextSignal },
    }
    rendered = await render(h(features.QueryStudioSurface, { services: liveServices, host: { history, interactive: { session } } }))
    await act(async () => rendered.container.querySelector('.CodeMirror').CodeMirror.setValue('MATCH (n) RETURN n'))
    assert.equal(button(rendered.container, 'Run').disabled, true)
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 750)) })
    assert.equal(button(rendered.container, 'Run').disabled, false)
    await act(async () => rendered.container.querySelector('.CodeMirror').CodeMirror.setValue('MATCH (m) RETURN m'))
    assert.equal(button(rendered.container, 'Run').disabled, true)
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 750)) })
    assert.equal(button(rendered.container, 'Run').disabled, false)
    await act(async () => button(rendered.container, 'Run').click())
    assert.equal(signal.aborted, false)
    await act(async () => rendered.root.unmount())
    activeRoots.delete(rendered.root)
    assert.equal(signal.aborted, true)
  })

  it('keeps null MCP history unknown and sends credentials only to host rendering', async () => {
    const rendered = []
    const services = {
      probeMcp: async () => ok({ status: undefined }),
      getMcpMode: async () => ok({ mode: 'ASSISTANT', modes: ['ASSISTANT', 'DEVELOPER'] }),
      setMcpMode: async (mode) => ok({ message: `${mode} active` }),
    }
    const host = {
      initialBaseUrl: 'https://world.example',
      currentCredential: () => ({ kind: 'bearer', value: 'secret-token' }),
      renderConnection: (command) => { rendered.push(command); return `${command.client} ${command.baseUrl} ${command.credential.value}` },
    }
    const { container } = await render(h(features.CodingAgentsSurface, { services, host }))
    assert.match(container.textContent, /not available|could not report|unknown/i)
    assert.equal(container.textContent.includes('secret-token'), false)
    assert.equal(rendered.every((command) => command.credential.value === 'secret-token'), true)
  })

  it('preserves session rewind numbering after holes', () => {
    assert.equal(features.rewoundCounter(['_1', '_3', '$named']), 3)
    assert.equal(features.rewoundCounter([]), 0)
  })
})
