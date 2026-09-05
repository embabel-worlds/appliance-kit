import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { afterEach, describe, it } from 'node:test'
import { JSDOM } from 'jsdom'
import postcss from 'postcss'
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

function observeEditorDisposal(editor) {
  const offCalls = []
  let removeCalls = 0
  const originalOff = editor.off
  const wrapper = editor.getWrapperElement()
  const originalRemove = wrapper.remove
  editor.off = function (event, handler) {
    offCalls.push({ event, handler })
    return originalOff.call(this, event, handler)
  }
  wrapper.remove = function () {
    removeCalls += 1
    return originalRemove.call(this)
  }
  return {
    offCalls,
    wrapper,
    removeCalls: () => removeCalls,
  }
}

afterEach(async () => {
  await act(async () => {
    for (const root of activeRoots) root.unmount()
  })
  activeRoots.clear()
  document.body.replaceChildren()
})

describe('the public browser feature entry point', () => {
  it('ships WKWebView-compatible feature-bound CSS with every extracted workflow block', () => {
    const css = readFileSync(new URL('../css/features.css', import.meta.url), 'utf8')
    const root = postcss.parse(css, { from: 'features.css' })
    assert.equal(root.nodes.some((node) => node.type === 'atrule' && node.name === 'scope'), false)

    const intentionalBodyPortals = ['.CodeMirror-hint', 'li.CodeMirror-hint-active', '#deftip']
    root.walkRules((rule) => {
      for (let parent = rule.parent; parent; parent = parent.parent) {
        if (parent.type === 'atrule' && /keyframes$/i.test(parent.name)) return
      }
      for (const selector of rule.selector.split(',').map((part) => part.trim())) {
        if (intentionalBodyPortals.some((portal) => selector.startsWith(portal))) continue
        assert.equal(
          selector.startsWith(':where(.kit-feature)'),
          true,
          `${selector} stays inside a feature root`,
        )
      }
    })
    for (const rootClass of ['studio', 'viewspage', 'agents', 'pinrail', 'apps']) {
      assert.match(css, new RegExp(`:where\\(\\.kit-feature\\)\\.${rootClass}\\b`))
      assert.match(css, new RegExp(`:where\\(\\.kit-feature\\) \\.${rootClass}\\b`))
    }
    for (const selector of [
      '.stage.acting', '.signalrow', '.signalname', '.signalfields', '.emptymenu', '.emptyroute',
      '.receipts', '.receipt-delivery', '.skillpicker', '.skillchips', '.skillchip.is-on',
      '.realm-problem', '.pinchip.is-gone',
    ]) assert.equal(css.includes(selector), true, `${selector} style`)

    const ruleFor = (selector) => root.nodes
      .flatMap((node) => node.type === 'rule' ? [node] : [])
      .find((rule) => rule.selectors?.includes(selector))
    assert.equal(
      root.nodes.some((node) => node.type === 'rule' && node.selectors?.includes(':where(.kit-feature) input:not([type])')),
      true,
      'classless text inputs receive the shared feature field skin',
    )
    assert.equal(
      root.nodes.some((node) => node.type === 'rule' && node.selectors?.some((selector) => /input\[type=['"]?(checkbox|radio)/.test(selector))),
      false,
      'native checkboxes and radios are not skinned as text fields',
    )
    assert.equal(ruleFor(':where(.kit-feature) .appgroup-head .realm-chevron')?.toString().includes('margin-left: 0'), true)
    assert.equal(ruleFor(':where(.kit-feature) .approw')?.toString().includes("grid-template-areas: 'icon body pin actions'"), true)
  })

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
    let selected = 'world/evil.html'
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
    assert.equal(container.querySelector('iframe'), null)
    assert.equal(opened.at(-1), null)
    const group = button(container, 'World template')
    assert.equal(group.getAttribute('aria-expanded'), 'true')
    await act(async () => group.click())
    assert.equal(group.getAttribute('aria-expanded'), 'false')
    await act(async () => group.click())
    const rows = [...container.querySelectorAll('.approw')]
    const ledger = rows.find((row) => row.textContent.includes('ledger'))
    const evil = rows.find((row) => row.textContent.includes('evil'))
    await act(async () => button(ledger, 'Open').click())
    assert.equal(opened.at(-1).name, 'ledger.html')
    await act(async () => ledger.querySelector('.app-pin').click())
    assert.equal(pins[0].key, 'world/ledger.html')
    const pinnedLedger = [...container.querySelectorAll('.approw')]
      .find((row) => row.textContent.includes('ledger'))
    assert.equal(pinnedLedger.querySelector('.app-pin').getAttribute('aria-label'), 'Unpin ledger')
    assert.match(container.textContent, /2 apps/)
    assert.match(container.textContent, /Apps available in this world\. Pin favorites for quick access\./)
    await act(async () => button(evil, 'Open').click())
    assert.equal(opened.some((app) => app?.name === 'evil.html'), false)
    selected = 'world/evil.html'
    await act(async () => { for (const listener of selectionListeners) listener() })
    assert.equal(container.querySelector('iframe'), null)
    assert.equal(opened.at(-1), null)
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

  it('dry-runs handlers and keeps a successful save disabled until explicit enable', async () => {
    let enableCalls = 0
    let saved = false
    let saveAttempts = 0
    const dryRuns = []
    const services = {
      kg: { schema: async () => ok({ labels: [], relationships: [] }) },
      handlers: {
        list: async () => ok({ yours: saved ? [{ name: 'triage', active: false, autonomous: false }] : [], available: [] }),
        open: async () => refused('absent'),
        validate: async () => ok({ valid: true, violations: [], durationMs: 1 }),
        dryRun: async (source, signalType) => { dryRuns.push([source, signalType]); return ok({ ok: true, stdout: 'observed', ranAgainst: { signalType: 'cron', signalId: 'tick-1' } }) },
        setEnabled: async () => { enableCalls += 1; return ok({ enabled: true }) },
        delete: async () => ok({ deleted: true }),
      },
      generateHandler: async () => ok({ source: '', valid: true, attempts: 1 }),
      saveHandler: async (request) => {
        saveAttempts += 1
        if (saveAttempts === 1) return ok({ ok: false, message: 'validation failed' })
        saved = true
        assert.equal(request.autonomous, false)
        return ok({ ok: true, message: 'saved' })
      },
      gatewayInterfaces: async () => ok('export interface GatewayContext {}'),
      signalTypes: async () => ok([]), worldSkills: async () => ok([]),
    }
    const { container } = await render(h(features.HandlerStudioSurface, { services }))
    await act(async () => button(container, 'Dry run').click())
    await flush()
    assert.equal(dryRuns.length, 1)
    assert.match(container.textContent, /observed/)
    const name = [...container.querySelectorAll('input')].find((input) => input.placeholder === 'pr-triage')
    await act(async () => setInput(name, 'triage'))
    await act(async () => button(container, 'Save agent').click())
    await flush()
    assert.match(container.textContent, /validation failed/)
    assert.equal(enableCalls, 0)
    await act(async () => button(container, 'Save agent').click())
    await flush()
    assert.match(container.textContent, /saved/)
    assert.equal(enableCalls, 0)
    await act(async () => button(container, 'Start watching').click())
    assert.equal(enableCalls, 1)
  })

  it('covers query validation, scopes, fills, interactive execution and disposal', async () => {
    let invalidExecuteCalls = 0
    let signal
    const history = { read: () => [], write() {} }
    const sessionWrites = []
    const session = { read: () => null, write: (value) => sessionWrites.push(value) }
    const scope = { name: 'recent', statement: 'MATCH (n)', outputLabel: 'Chunk', members: 2, expiresAt: 'soon' }
    const base = {
      runs: async () => ok([]), schema: async () => ok({ labels: [], relationships: [] }),
      kill: async () => ok({ killed: true }), generate: async () => ok({ cypher: '' }),
      refine: async () => ok({ cypher: '' }), saveView: async () => ok({ saved: true }),
      scopes: async () => ok({ scopes: [scope] }), pinScope: async () => ok({ pinned: true }),
      deleteScope: async () => ok({ deleted: true }),
    }
    const invalidServices = {
      kg: { ...base, validate: async () => ok({ ok: false, violations: ['bad query'] }), execute: async () => { invalidExecuteCalls += 1; return ok({ rows: [] }) } },
      fills: { list: async () => ok([]), create: async () => ok({ id: 'f' }), delete: async () => ok(undefined) },
      subscribeProgress() {},
    }
    let rendered = await render(h(features.QueryStudioSurface, { services: invalidServices, host: { history, interactive: { session } } }))
    const cm = rendered.container.querySelector('.CodeMirror').CodeMirror
    await act(async () => cm.setValue('not cypher'))
    assert.equal(button(rendered.container, 'Run').disabled, true)
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 750)) })
    assert.equal(invalidExecuteCalls, 0)
    assert.match(rendered.container.textContent, /1 schema problem/)

    await act(async () => rendered.root.unmount())
    activeRoots.delete(rendered.root)
    let fillRunning = true
    const pinned = []
    const canceled = []
    const interactiveRuns = []
    const liveServices = {
      ...invalidServices,
      kg: {
        ...base,
        pinScope: async (name) => { pinned.push(name); return ok({ pinned: true }) },
        validate: async () => ok({ ok: true, violations: [] }),
        execute: async (cypher, options = {}) => {
          if (options.captureAs) {
            interactiveRuns.push([cypher, options])
            return ok({
              rows: [{ id: 1 }],
              capturedScope: { name: options.captureAs, outputLabel: 'Chunk', members: 1, expiresAt: 'soon' },
            })
          }
          return new Promise(() => {})
        },
      },
      fills: {
        list: async () => ok(fillRunning ? [{ id: 'fill-1', label: 'Long query', cypher: 'MATCH (n)', progress: { state: 'RUNNING', ticks: 1, liveCallsTotal: 2 } }] : []),
        create: async () => ok({ id: 'fill-new' }),
        delete: async (id) => { canceled.push(id); fillRunning = false; return ok(undefined) },
      },
      subscribeProgress: (_onEvent, nextSignal) => { signal = nextSignal },
    }
    rendered = await render(h(features.QueryStudioSurface, { services: liveServices, host: { history, interactive: { session } } }))
    await act(async () => button(rendered.container, 'Pin').click())
    assert.deepEqual(pinned, ['recent'])
    await act(async () => button(rendered.container, 'Cancel').click())
    await flush()
    assert.deepEqual(canceled, ['fill-1'])
    await act(async () => button(rendered.container, 'Interactive').click())
    const sessionCm = rendered.container.querySelector('.session-cm .CodeMirror').CodeMirror
    const sessionDisposal = observeEditorDisposal(sessionCm)
    await act(async () => sessionCm.setValue('MATCH (c:Chunk)'))
    await act(async () => button(rendered.container, 'Enter').click())
    await flush()
    assert.equal(interactiveRuns.length, 1)
    assert.equal(interactiveRuns[0][1].captureAs, '_1')
    assert.equal(sessionWrites.at(-1).bindings[0].name, '_1')

    await act(async () => button(rendered.container, 'Query').click())
    const mainCm = rendered.container.querySelector('.studio-pane-query .CodeMirror').CodeMirror
    const mainDisposal = observeEditorDisposal(mainCm)
    await act(async () => mainCm.setValue('MATCH (n) RETURN n'))
    assert.equal(button(rendered.container, 'Run').disabled, true)
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 750)) })
    assert.equal(button(rendered.container, 'Run').disabled, false)
    await act(async () => mainCm.setValue('MATCH (m) RETURN m'))
    assert.equal(button(rendered.container, 'Run').disabled, true)
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 750)) })
    assert.equal(button(rendered.container, 'Run').disabled, false)
    await act(async () => button(rendered.container, 'Run').click())
    assert.equal(signal.aborted, false)
    const editorWrappers = [...rendered.container.querySelectorAll('.CodeMirror')]
    assert.equal(editorWrappers.length, 2)
    await act(async () => rendered.root.unmount())
    activeRoots.delete(rendered.root)
    assert.equal(signal.aborted, true)
    assert.deepEqual(mainDisposal.offCalls.map(({ event }) => event), ['change', 'inputRead'])
    assert.equal(mainDisposal.offCalls.every(({ handler }) => typeof handler === 'function'), true)
    assert.equal(mainDisposal.removeCalls(), 1)
    assert.deepEqual(sessionDisposal.offCalls.map(({ event }) => event), ['beforeChange', 'inputRead'])
    assert.equal(sessionDisposal.offCalls.every(({ handler }) => typeof handler === 'function'), true)
    assert.equal(sessionDisposal.removeCalls(), 1)
    assert.equal(editorWrappers.includes(mainDisposal.wrapper), true)
    assert.equal(editorWrappers.includes(sessionDisposal.wrapper), true)
    assert.equal(editorWrappers.every((wrapper) => !wrapper.isConnected), true)
  })

  it('blocks late studio loads and clears pending validation on replacement and unmount', async () => {
    let resolveHandlerSurface
    const slowHandlerSurface = new Promise((resolve) => { resolveHandlerSurface = resolve })
    let oldHandlerValidations = 0
    const handlerServices = (gatewayInterfaces, label) => ({
      kg: { schema: async () => ok({ labels: [{ label }], relationships: [] }) },
      handlers: {
        list: async () => ok({ yours: [], available: [] }), open: async () => refused('absent'),
        validate: async () => { oldHandlerValidations += 1; return ok({ valid: true, violations: [] }) },
        dryRun: async () => ok({ ok: true, stdout: '', ranAgainst: {} }),
        setEnabled: async () => ok({ enabled: true }), delete: async () => ok({ deleted: true }),
      },
      generateHandler: async () => ok({ source: '', valid: true, attempts: 1 }),
      saveHandler: async () => ok({ ok: true, message: 'saved' }), gatewayInterfaces,
      signalTypes: async () => ok([]), worldSkills: async () => ok([]),
    })
    let rendered = await render(h(features.HandlerStudioSurface, {
      services: handlerServices(async () => slowHandlerSurface, 'Stale'),
    }))
    const oldHandlerWrapper = rendered.container.querySelector('.CodeMirror')
    const freshHandlerServices = handlerServices(async () => ok('export interface WorldTools {\n  fresh(): void;\n}\nexport type GatewayContext = WorldTools;'), 'Fresh')
    await act(async () => rendered.root.render(h(features.HandlerStudioSurface, { services: freshHandlerServices })))
    await flush()
    assert.match(rendered.container.textContent, /fresh/)
    await act(async () => resolveHandlerSurface(ok('export interface WorldTools {\n  stale(): void;\n}\nexport type GatewayContext = WorldTools;')))
    await flush()
    assert.doesNotMatch(rendered.container.textContent, /stale/)
    const handlerCm = rendered.container.querySelector('.CodeMirror').CodeMirror
    await act(async () => handlerCm.setValue('console.log(1)'))
    await act(async () => rendered.root.unmount())
    activeRoots.delete(rendered.root)
    await new Promise((resolve) => setTimeout(resolve, 1550))
    assert.equal(oldHandlerValidations, 0)
    assert.equal(oldHandlerWrapper.isConnected, false)

    let resolveOldSchema
    const oldSchema = new Promise((resolve) => { resolveOldSchema = resolve })
    let queryValidations = 0
    const queryServices = (schema) => ({
      kg: {
        runs: async () => ok([]), schema, validate: async () => { queryValidations += 1; return ok({ ok: true, violations: [] }) },
        execute: async () => ok({ rows: [] }), kill: async () => ok({ killed: true }),
        generate: async () => ok({ cypher: '' }), refine: async () => ok({ cypher: '' }), saveView: async () => ok({ saved: true }),
        scopes: async () => ok({ scopes: [] }), pinScope: async () => ok({ pinned: true }), deleteScope: async () => ok({ deleted: true }),
      },
      fills: { list: async () => ok([]), create: async () => ok({ id: 'f' }), delete: async () => ok(undefined) },
      subscribeProgress() {},
    })
    const queryHost = { history: { read: () => [], write() {} }, interactive: { session: { read: () => null, write() {} } } }
    rendered = await render(h(features.QueryStudioSurface, { services: queryServices(async () => oldSchema), host: queryHost }))
    await act(async () => rendered.root.render(h(features.QueryStudioSurface, {
      services: queryServices(async () => ok({ labels: [{ label: 'Fresh' }], relationships: [] })), host: queryHost,
    })))
    await flush()
    assert.match(rendered.container.textContent, /Fresh/)
    await act(async () => resolveOldSchema(ok({ labels: [{ label: 'Stale' }], relationships: [] })))
    await flush()
    assert.doesNotMatch(rendered.container.textContent, /Stale/)
    const queryWrappers = [...rendered.container.querySelectorAll('.CodeMirror')]
    await act(async () => queryWrappers[0].CodeMirror.setValue('MATCH (n)'))
    await act(async () => rendered.root.unmount())
    activeRoots.delete(rendered.root)
    await new Promise((resolve) => setTimeout(resolve, 750))
    assert.equal(queryValidations, 0)
    assert.equal(queryWrappers.every((wrapper) => !wrapper.isConnected), true)
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
    assert.equal(container.firstElementChild.classList.contains('kit-feature'), true)
    assert.equal(container.firstElementChild.classList.contains('kit-feature-coding-agents'), true)
    assert.match(container.textContent, /not available|could not report|unknown/i)
    assert.equal(container.textContent.includes('secret-token'), false)
    assert.equal(rendered.every((command) => command.credential.value === 'secret-token'), true)
  })

  it('preserves session rewind numbering after holes', () => {
    assert.equal(features.rewoundCounter(['_1', '_3', '$named']), 3)
    assert.equal(features.rewoundCounter([]), 0)
  })
})
