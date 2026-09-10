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
if (!HTMLElement.prototype.scrollIntoView) HTMLElement.prototype.scrollIntoView = () => {}
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
  it('reports editor text to the host and accepts an explicit repeat handoff without replaying edits', async () => {
    const services = {
      kg: { schema: async () => ok({ labels: [], relationships: [] }),
        scopes: async () => ok({ scopes: [] }), validate: async () => ok({ ok: true }) },
      fills: { list: async () => ok([]) }, subscribeProgress() {},
    }
    const changes = []
    const props = { services, host: { history: { read: () => [], write() {} },
      interactive: { session: { read: () => null, write() {} } } },
      handedOver: 'RETURN 1', handoffRevision: 1, onCypherChange: (text) => changes.push(text) }
    const rendered = await render(h(features.QueryStudioSurface, props))
    const sections = [...rendered.container.querySelectorAll('.studio-pane')]
    assert.deepEqual(sections.map((section) => section.dataset.studioPane), ['query', 'results', 'session'])
    assert.equal(sections.every((section) => !section.hidden), true, 'all studio sections stay in page flow')
    const originalScrollIntoView = HTMLElement.prototype.scrollIntoView
    const reveals = []
    HTMLElement.prototype.scrollIntoView = function (options) { reveals.push([this.dataset.studioPane, options]) }
    try {
      await act(async () => button(rendered.container, 'Results').click())
      await act(async () => { await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))) })
      assert.equal(reveals.some(([target, options]) => target === 'results' && options.block === 'start'), true)

      rendered.container.querySelector('.studiotabs').getBoundingClientRect = () => ({ bottom: 44 })
      const tops = { query: -200, results: -100, session: 200 }
      for (const section of sections) section.getBoundingClientRect = () => ({ top: tops[section.dataset.studioPane] })
      rendered.container.querySelector('.studio-sections').dispatchEvent(new Event('scroll'))
      await act(async () => { await new Promise((resolve) => requestAnimationFrame(resolve)) })
      assert.equal(button(rendered.container, 'Results').getAttribute('aria-current'), 'page')
      tops.session = 20
      rendered.container.querySelector('.studio-sections').dispatchEvent(new Event('scroll'))
      await act(async () => { await new Promise((resolve) => requestAnimationFrame(resolve)) })
      assert.equal(button(rendered.container, 'Interactive').getAttribute('aria-current'), 'page')
    } finally {
      HTMLElement.prototype.scrollIntoView = originalScrollIntoView
    }
    const cm = rendered.container.querySelector('.CodeMirror').CodeMirror
    assert.equal(cm.getValue(), 'RETURN 1')
    assert.equal(cm.getInputField().getAttribute('aria-label'), 'Cypher query')
    assert.equal(cm.getScrollerElement().tabIndex, 0, 'the editor scroll area is keyboard reachable')
    assert.equal(changes.at(-1), 'RETURN 1')
    const runButton = [...rendered.container.querySelectorAll('button')].find(b => b.textContent.startsWith('Run ('))
    assert.equal(runButton.textContent, 'Run (⌘/Ctrl+Enter)')
    const help = rendered.container.querySelector('.editor-help')
    help.open = true
    assert.match(help.textContent, /⌘.*Enter.*Mac.*Ctrl.*Enter.*other keyboards/)
    assert.match(help.textContent, /Control.*Space.*schema/)
    assert.equal(typeof cm.getOption('extraKeys')['Cmd-Enter'], 'function')
    assert.equal(cm.getOption('extraKeys')['Cmd-Enter'], cm.getOption('extraKeys')['Ctrl-Enter'])
    await act(async () => cm.setValue('RETURN 2'))
    assert.equal(changes.at(-1), 'RETURN 2')
    await act(async () => rendered.root.render(h(features.QueryStudioSurface, { ...props })))
    assert.equal(cm.getValue(), 'RETURN 2')
    await act(async () => rendered.root.render(h(features.QueryStudioSurface, { ...props, handoffRevision: 2 })))
    assert.equal(cm.getValue(), 'RETURN 1')
  })

  it('lands a starter once and never lets a null handoff clobber later edits', async () => {
    const services = {
      kg: { schema: async () => ok({ labels: [], relationships: [] }), scopes: async () => ok({ scopes: [] }), validate: async () => ok({ ok: true }) },
      fills: { list: async () => ok([]) }, subscribeProgress() {},
    }
    const host = { history: { read: () => [], write() {} }, interactive: { session: { read: () => null, write() {} } } }
    const props = { services, host, handedOver: null, initialCypher: 'MATCH (n) RETURN n LIMIT 25' }
    const rendered = await render(h(features.QueryStudioSurface, props))
    const cm = rendered.container.querySelector('.CodeMirror').CodeMirror
    assert.equal(cm.getValue(), 'MATCH (n) RETURN n LIMIT 25')
    await act(async () => cm.setValue('RETURN 42'))
    await act(async () => rendered.root.render(h(features.QueryStudioSurface, props)))
    assert.equal(cm.getValue(), 'RETURN 42')
  })

  it('explains a refused fill instead of silently returning to idle', async () => {
    const services = {
      kg: { schema: async () => ok({ labels: [], relationships: [] }),
        scopes: async () => ok({ scopes: [] }), validate: async () => ok({ ok: true }) },
      fills: { list: async () => ok([]), create: async () => ({ ok: false, kind: 'unauthorized', status: 403, message: 'Forbidden' }) },
      subscribeProgress() {},
    }
    const host = { history: { read: () => [], write() {} }, interactive: { session: { read: () => null, write() {} } } }
    const rendered = await render(h(features.QueryStudioSurface, { services, host, handedOver: 'RETURN 1' }))
    const fill = [...rendered.container.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Fill')
    await act(async () => fill.click())
    assert.match(rendered.container.textContent, /administrator/i)
    assert.equal(fill.disabled, false)
  })

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
      '.realm-problem', '.pinchip.is-gone', '.viewrealms', '.viewrealm-head', '.viewoperation',
      '.viewspage-sidebar', '.viewspage-mobile-nav', '.viewoperation-nav', '.viewoperation-section', '.viewsibling', '.viewschema-label',
      '.view-results',
    ]) assert.equal(css.includes(selector), true, `${selector} style`)

    const ruleFor = (selector) => root.nodes
      .flatMap((node) => node.type === 'rule' ? [node] : [])
      .find((rule) => rule.selectors?.includes(selector))
    assert.ok(ruleFor(':where(.kit-feature).viewspage').nodes.some((node) =>
      node.type === 'decl' && node.prop === 'background' && node.value === 'var(--paper)'),
    'Views text needs opaque backing against bright graph nodes')
    for (const selector of [':where(.kit-feature) .viewrealm-head:focus-visible',
      ':where(.kit-feature) .viewoperation-nav-link:focus-visible',
      ':where(.kit-feature) .viewspage-mobile-nav > summary:focus-visible']) {
      assert.ok(root.nodes.some((rule) => rule.type === 'rule' && rule.selectors.includes(selector)
        && rule.nodes.some((node) => node.prop === 'box-shadow' && node.value === 'inset 0 0 0 2px var(--ink)')),
      `${selector} keeps focus paint inside its clipping parent`)
    }
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
    assert.match(css, /@media \(max-width: 700px\)/, 'realm navigator becomes a disclosure at the phone breakpoint')
    const tablet = root.nodes.find((node) => node.type === 'atrule' && node.params === '(max-width: 1100px)'
      && node.nodes.some((child) => child.type === 'rule' && child.selectors?.includes(':where(.kit-feature) .viewoperation-head')))
    const tabletHeader = tablet?.nodes.find((node) => node.type === 'rule' && node.selectors?.includes(':where(.kit-feature) .viewoperation-head'))
    const tabletSchema = tablet?.nodes.find((node) => node.type === 'rule' && node.selectors?.includes(':where(.kit-feature) .viewschema'))
    assert.equal(tabletHeader?.nodes.find((node) => node.prop === 'grid-template-columns')?.value, '1fr', 'tablet operation heading keeps the full content width')
    assert.equal(tabletSchema?.nodes.find((node) => node.prop === 'grid-template-columns')?.value, '1fr', 'tablet schema values keep a useful line width')
    assert.match(tablet?.toString() ?? '', /viewspage-sidebar[^}]*display:\s*none[\s\S]*viewspage-mobile-nav[^}]*display:\s*block/, 'tablet uses the named realm disclosure instead of a cramped rail')
    assert.match(css, /\.view-results[\s\S]*td::before/, 'mobile results name every stacked value')
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
    assert.ok(container.querySelector('.lamp.lamp-lit'), 'installed realms use the shared lit-lamp class')
    await act(async () => button(container, 'Update 1').click())
    assert.equal(updates, 0)
    confirm = true
    await act(async () => button(container, 'Update 1').click())
    assert.equal(updates, 1)
  })

  it('lands on an eight-realm operation board and expands one realm across 103 live views', async () => {
    const sizes = { World: 25, drugtrials: 6, 'gov-au': 22, 'gov-uk': 13, impromptu: 4, movie: 13, 'realm-esg': 17, 'realm-sec': 3 }
    const views = Object.entries(sizes).flatMap(([source, count]) => Array.from({ length: count }, (_, index) => ({
      name: `${source}-${index}`,
      source: source === 'World' ? undefined : source,
      description: `${source} operation ${index}`,
      cypher: 'MATCH (n) RETURN n',
      materialized: source === 'World' && index === 0,
      params: {},
    })))
    const services = {
      kg: {
        views: async () => ok(views), schema: async () => ok({ labels: [], relationships: [] }),
        runView: async () => ok({ rows: [] }), viewInvocation: async () => ok({ cypher: 'MATCH (n)' }),
        deleteView: async () => ok({ deleted: true }), refreshView: async () => ok({ refreshed: true }),
      },
      watches: {
        list: async () => ok([{ id: 'w1', lensId: 'World-0', name: 'World-0', enabled: true }]),
        create: async () => ok({}), delete: async () => ok(undefined), run: async () => ok(undefined),
        runs: async () => ok([]), changes: async () => ok([]), deliveries: async () => ok([]),
      },
    }
    const host = { selectedView: () => null, subscribeSelection: () => () => {}, onOpenInStudio() {}, onCreateHandler() {} }
    const { container } = await render(h(features.SavedViewsSurface, { services, host }))

    assert.equal(container.querySelector('.viewboard-head h2')?.textContent, 'Operation Board')
    assert.equal(container.querySelectorAll('.viewrealm').length, 8)
    assert.equal(container.querySelectorAll('.viewoperation').length, 0)
    assert.match(button(container, 'World').textContent, /25 operations.*1 materialized.*1 watched/)

    await act(async () => button(container, 'World').click())
    assert.equal(container.querySelectorAll('.viewoperation').length, 25)
    await act(async () => button(container, 'movie').click())
    assert.equal(container.querySelectorAll('.viewoperation').length, 13)
    assert.equal(button(container, 'World').getAttribute('aria-expanded'), 'false')
  })

  it('keeps a malformed selected view without cypher usable', async () => {
    const services = {
      kg: {
        views: async () => ok([{ name: 'Broken', description: 'Missing query text', materialized: false, params: {} }]),
        schema: async () => ok({ labels: [], relationships: [] }),
        runView: async () => ok({ rows: [] }), viewInvocation: async () => ok({ cypher: '' }),
        deleteView: async () => ok({ deleted: true }), refreshView: async () => ok({ refreshed: true }),
      },
      watches: {
        list: async () => ok([]), create: async () => ok({}), delete: async () => ok(undefined), run: async () => ok(undefined),
        runs: async () => ok([]), changes: async () => ok([]), deliveries: async () => ok([]),
      },
    }
    const host = { selectedView: () => 'Broken/schema', subscribeSelection: () => () => {}, onOpenInStudio() {}, onCreateHandler() {} }
    const { container } = await render(h(features.SavedViewsSurface, { services, host }))

    assert.equal(container.querySelector('.viewoperation-head h2')?.textContent, 'Broken')
    assert.match(container.textContent, /No declared schema labels were found in this operation's query/)
  })

  const c3Services = () => ({
    kg: { views: async () => ok([{ name: 'Alpha', cypher: 'RETURN 1', params: {} }]), schema: async () => ok({ labels: [], relationships: [] }) },
    watches: { list: async () => ok([]), create: async () => ok({}), delete: async () => ok(undefined), run: async () => ok(undefined), runs: async () => ok([]), changes: async () => ok([]), deliveries: async () => ok([]) },
  })
  const c3Host = { selectedView: () => 'Alpha/watch', subscribeSelection: () => () => {}, onOpenInStudio() {}, onCreateHandler() {} }

  it('C3 distinguishes unknown watch state from no watch and retains unsupported/error feedback', async () => {
    const services = c3Services(), pending = []
    services.watches.list = () => new Promise(resolve => pending.push(resolve))
    const { container, root } = await render(h(features.SavedViewsSurface, { services, host: c3Host }))
    const watch = () => container.querySelector('.viewoperation-section[data-view-pane="watch"]')
    assert.match(watch().textContent, /Checking watches/)
    assert.doesNotMatch(watch().textContent, /Watch this/)
    await act(async () => pending.forEach(resolve => resolve({ ok: false, kind: 'failed', status: 503, message: 'Watch backend detail' })))
    assert.match(watch().textContent, /HTTP 503.*Watch backend detail/)
    assert.doesNotMatch(watch().textContent, /Watch this/)
    services.watches.list = async () => ok([])
    await act(async () => button(container, 'Retry watch listing').click())
    assert.match(watch().textContent, /Watch this/)
    for (const status of [401, 403, 404]) {
      const next = c3Services()
      next.watches.list = async () => ({ ok: false, kind: status === 404 ? 'unsupported' : 'unauthorized', status, message: 'Watch backend detail' })
      await act(async () => root.render(h(features.SavedViewsSurface, { services: next, host: c3Host })))
      await flush()
      assert.ok(watch(), 'unsupported watches keep a named section instead of silently redirecting')
      assert.match(watch().textContent, new RegExp(`HTTP ${status}.*Watch backend detail`))
      assert.doesNotMatch(watch().textContent, /Watch this/)
    }
  })

  it('C3 receipt read failures cannot masquerade as no changes or no delivery', async () => {
    for (const endpoint of ['changes', 'deliveries']) {
      const services = c3Services()
      services.watches.list = async () => ok([{ id: 'w1', lensId: 'Alpha', enabled: true }])
      services.watches.runs = async () => ok([{ id: 'r1', status: 'COMPLETED' }])
      services.watches[endpoint] = async () => ({ ok: false, kind: 'failed', status: 503, message: `${endpoint} backend detail` })
      const { container } = await render(h(features.SavedViewsSurface, { services, host: c3Host }))
      const watch = container.querySelector('.viewoperation-section[data-view-pane="watch"]')
      assert.match(watch.textContent, new RegExp(`HTTP 503.*${endpoint} backend detail`))
      assert.ok(button(watch, 'Refresh receipts'))
      assert.equal(watch.querySelector('.receipt'), null)
      services.watches[endpoint] = async () => ok([])
      await act(async () => button(watch, 'Refresh receipts').click())
      assert.match(watch.querySelector('.receipt .stage').textContent, /no recorded changes/)
    }
  })

  it('C3 pending results do not claim no attempt and run failure is announced only once', async () => {
    const services = c3Services(); let finish
    services.kg.runView = () => new Promise(resolve => { finish = resolve })
    const { container } = await render(h(features.SavedViewsSurface, { services, host: c3Host }))
    await act(async () => container.querySelector('.viewoperation-section[data-view-pane="run"] .btn.primary').click())
    const results = container.querySelector('.viewoperation-section[data-view-pane="results"]')
    assert.match(results.textContent, /Running/)
    assert.doesNotMatch(results.textContent, /Nothing run yet/)
    await act(async () => finish({ ok: false, kind: 'failed', status: 503, message: 'Run backend detail' }))
    assert.match(results.textContent, /HTTP 503.*Run backend detail/)
    assert.equal([...container.querySelectorAll('[role="alert"]')].filter(e => e.textContent.includes('Run backend detail')).length, 1)
  })

  it('C3 watch action failures retain status and never claim a failed stop succeeded', async () => {
    const services = c3Services(); let watched = false
    services.watches.list = async () => ok(watched ? [{ id: 'w1', lensId: 'Alpha', enabled: true }] : [])
    services.watches.create = async () => ({ ok: false, kind: 'failed', status: 503, message: 'Create detail' })
    const { container } = await render(h(features.SavedViewsSurface, { services, host: c3Host }))
    await act(async () => button(container, 'Watch this').click())
    assert.match(container.textContent, /HTTP 503.*Create detail/)
    services.watches.create = async () => { watched = true; return ok({}) }
    await act(async () => button(container, 'Watch this').click())
    assert.match(container.textContent, /No runs listed yet/)
    assert.ok(button(container, 'Refresh receipts'))
    services.watches.run = async () => ({ ok: false, kind: 'unauthorized', status: 403, message: 'Run watch detail' })
    await act(async () => button(container, 'Run it now').click())
    assert.match(container.textContent, /HTTP 403.*administrator.*Run watch detail/)
    services.watches.delete = async () => ({ ok: false, kind: 'failed', status: 503, message: 'Stop detail' })
    await act(async () => button(container, 'Stop watching').click())
    assert.match(container.textContent, /HTTP 503.*Stop detail/)
    assert.ok(button(container, 'Run it now'))
    assert.doesNotMatch(container.textContent, /Watch stopped|Nothing is publishing/)
  })

  it('keeps only sibling navigation in the realm and renders ordered operation sections under a top nav', async () => {
    const navigations = []
    const listeners = new Set()
    let route = null
    const views = [
      { name: 'Alpha', description: 'First world operation', cypher: 'MATCH (a:AlphaLabel) RETURN a', materialized: false, params: {} },
      { name: 'Beta', description: 'Second world operation', cypher: 'MATCH (b:BetaLabel) RETURN b', materialized: false, params: {} },
      { name: 'Gamma', source: 'movie', description: 'Movie operation', cypher: 'MATCH (m:Movie) RETURN m', materialized: false, params: {} },
    ]
    const services = {
      kg: {
        views: async () => ok(views),
        schema: async () => ok({ labels: [
          { label: 'AlphaLabel', anchor: true, exhaustive: true, sampleCount: 1, properties: [] },
          { label: 'BetaLabel', anchor: true, exhaustive: true, sampleCount: 1, properties: [] },
        ], relationships: [] }),
        runView: async () => ok({ rows: [] }), viewInvocation: async () => ok({ cypher: 'MATCH (n)' }),
        deleteView: async () => ok({ deleted: true }), refreshView: async () => ok({ refreshed: true }),
      },
      watches: {
        list: async () => ok([]), create: async () => ok({}), delete: async () => ok(undefined), run: async () => ok(undefined),
        runs: async () => ok([]), changes: async () => ok([]), deliveries: async () => ok([]),
      },
    }
    const host = {
      selectedView: () => route,
      subscribeSelection: (listener) => { listeners.add(listener); return () => listeners.delete(listener) },
      navigateToView: (name, destination, replace) => { navigations.push([name, destination, replace]); route = name ? `${name}${destination === 'open' ? '' : `/${destination}`}` : null },
      onOpenInStudio() {}, onCreateHandler() {},
    }
    const { container } = await render(h(features.SavedViewsSurface, { services, host }))
    await act(async () => button(container, 'World').click())
    await act(async () => button(container, 'Alpha').click())

    assert.equal(container.querySelector('.viewspage-sidebar')?.querySelectorAll('.viewsibling').length, 2)
    assert.equal(container.querySelector('.viewspage-sidebar')?.querySelectorAll('.viewpane-link').length, 0)
    assert.equal(container.querySelector('.viewspage-mobile-nav summary')?.textContent.includes('Browse this realm'), true)
    assert.deepEqual([...container.querySelectorAll('.viewoperation-nav button')].map((item) => item.textContent), ['Run', 'Results', 'Schema', 'Watch / receipts'])
    assert.deepEqual([...container.querySelectorAll('.viewoperation-section')].map((item) => item.dataset.viewPane), ['run', 'results', 'schema', 'watch'])
    assert.deepEqual([...container.querySelectorAll('.viewoperation-section .panel-head h2')].map((item) => item.textContent), ['Run', 'Results', 'Schema', 'Watch'])
    assert.equal(container.querySelector('.viewoperation-section[data-view-pane="watch"] select')?.getAttribute('aria-label'), 'Watch schedule')
    assert.equal(container.querySelector('.viewoperation-head h2')?.textContent, 'Alpha')
    await act(async () => button(container, 'Schema').click())
    assert.equal(container.querySelectorAll('.viewoperation-section').length, 4)
    assert.equal(container.querySelectorAll('.viewschema-label').length, 1)
    await act(async () => button(container, 'Beta').click())
    assert.equal(container.querySelector('.viewoperation-head h2')?.textContent, 'Beta')
    assert.equal(button(container, 'Schema').getAttribute('aria-current'), 'page')
    assert.deepEqual(navigations.slice(-3), [
      ['Alpha', 'open', false],
      ['Alpha', 'schema', true],
      ['Beta', 'schema', false],
    ])
    await act(async () => button(container, 'Operation Board').click())
    assert.equal(container.querySelector('.viewboard-head h2')?.textContent, 'Operation Board')
    assert.deepEqual(navigations.at(-1), [null, 'open', false])
  })

  it('restores a selected operation pane, scrolls its section, and can drive a run of that same operation', async () => {
    const scrollTargets = []
    const originalScrollIntoView = HTMLElement.prototype.scrollIntoView
    HTMLElement.prototype.scrollIntoView = function (options) { scrollTargets.push([this.dataset.viewPane ?? this.dataset.pane, options]) }
    try {
    let route = 'Alpha/results'
    let runs = 0
    const listeners = new Set()
    const services = {
      kg: {
        views: async () => ok([{ name: 'Alpha', description: 'A', cypher: 'RETURN 1', materialized: false, params: {} }]),
        schema: async () => ok({ labels: [], relationships: [] }), runView: async () => { runs += 1; return ok({ rows: [{ id: 1 }], rowCount: 1 }) },
        viewInvocation: async () => ok({ cypher: 'RETURN 1' }), deleteView: async () => ok({ deleted: true }), refreshView: async () => ok({ refreshed: true }),
      },
      watches: { list: async () => ok([]), create: async () => ok({}), delete: async () => ok(undefined), run: async () => ok(undefined), runs: async () => ok([]), changes: async () => ok([]), deliveries: async () => ok([]) },
    }
    const host = {
      selectedView: () => route,
      subscribeSelection: (listener) => { listeners.add(listener); return () => listeners.delete(listener) },
      navigateToView: (name, destination) => { route = name ? `${name}/${destination}` : null },
      onOpenInStudio() {}, onCreateHandler() {},
    }
    const { container } = await render(h(features.SavedViewsSurface, { services, host }))
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 20)) })
    assert.equal(container.querySelector('.viewoperation-head h2')?.textContent, 'Alpha')
    assert.equal(button(container, 'Results').getAttribute('aria-current'), 'page')
    assert.equal(scrollTargets.some(([target, options]) => target === 'results' && options.inline === 'nearest'), true)
    scrollTargets.length = 0
    await act(async () => container.querySelector('.viewoperation-nav [data-view-pane="results"]').click())
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 20)) })
    assert.equal(scrollTargets.some(([target]) => target === 'results'), true, 'activating the current pane still scrolls its section')
    assert.match(container.textContent, /Nothing run yet/)

    route = 'Alpha/run'
    await act(async () => { for (const listener of listeners) listener() })
    await flush()
    assert.equal(runs, 1)
    assert.equal(button(container, 'Results').getAttribute('aria-current'), 'page')
    assert.equal(scrollTargets.some(([target]) => target === 'results'), true)
    } finally {
      HTMLElement.prototype.scrollIntoView = originalScrollIntoView
    }
  })

  it('preserves populated active-sibling state but resets a different sibling', async () => {
    const originalScrollIntoView = HTMLElement.prototype.scrollIntoView
    const reveals = []
    HTMLElement.prototype.scrollIntoView = function () { reveals.push(this.dataset.viewPane) }
    try {
      let route = 'Alpha'
      const calls = []
      const services = {
        kg: {
          views: async () => ok(['Alpha', 'Beta'].map((name) => ({ name, cypher: 'RETURN $minYear', source: 'movie', params: { minYear: { type: 'int', default: name === 'Alpha' ? 2000 : 1984 } } }))),
          schema: async () => ok({ labels: [], relationships: [] }),
          runView: async (name, args) => { calls.push([name, args]); return ok({ rows: [{ id: 7 }], warnings: ['server warning'] }) },
        },
        watches: {
          list: async () => ok([{ id: 'watch-1', lensId: 'Alpha', cron: '0 */15 * * * *', delivery: { channel: 'signal' } }]),
          runs: async () => ok([{ id: 'receipt-1', status: 'COMPLETED' }]), changes: async () => ok([]), deliveries: async () => ok([]),
        },
      }
      const host = {
        selectedView: () => route, subscribeSelection: () => () => {},
        navigateToView: (name, destination) => { route = name + (destination === 'open' ? '' : '/' + destination) },
        onOpenInStudio() {}, onCreateHandler() {},
      }
      const { container } = await render(h(features.SavedViewsSurface, { services, host }))
      await act(async () => setInput(container.querySelector('.paramform input'), '2017'))
      await act(async () => container.querySelector('.viewoperation-section[data-view-pane="run"] .btn.primary').click())
      await flush()
      assert.deepEqual(calls, [['Alpha', { minYear: '2017' }]])
      const watch = container.querySelector('.viewoperation-section[data-view-pane="watch"]')
      const watchText = watch.textContent
      assert.match(watchText, /watching/)
      assert.equal(watch.querySelectorAll('.receipt').length, 1)
      for (const pane of ['run', 'results', 'schema', 'watch']) {
        await act(async () => container.querySelector(`.viewoperation-nav [data-view-pane="${pane}"]`).click())
        await act(async () => { await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))) })
        const routeBefore = route
        reveals.length = 0
        await act(async () => container.querySelector('.viewspage-sidebar .viewsibling.active').click())
        await act(async () => { await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))) })
        assert.equal(container.querySelector('.paramform input').value, '2017')
        assert.equal(container.querySelector('[data-state="view.ran"]').hidden, false)
        assert.equal(container.querySelectorAll('.view-results tbody tr').length, 1)
        assert.match(container.querySelector('.results-foot .status').textContent, /server warning/)
        assert.equal(container.querySelector('.viewoperation-section[data-view-pane="watch"]'), watch)
        assert.equal(watch.textContent, watchText)
        assert.equal(route, routeBefore)
        assert.equal(container.querySelector('.viewoperation-nav-link.active').dataset.viewPane, pane)
        assert.ok(reveals.includes(pane))
        assert.equal(calls.length, 1, 'reselection does not rerun')
      }
      await act(async () => [...container.querySelectorAll('.viewspage-sidebar .viewsibling')].find(e => e.querySelector('strong').textContent === 'Beta').click())
      assert.equal(container.querySelector('.paramform input').value, '1984')
      assert.equal(container.querySelector('[data-state="view.ran"]').hidden, true)
      assert.equal(container.querySelectorAll('.view-results tbody tr').length, 0)
      assert.equal(container.querySelector('.results-foot .status').textContent, '')
      await act(async () => container.querySelector('.viewoperation-section[data-view-pane="run"] .btn.primary').click())
      assert.deepEqual(calls, [['Alpha', { minYear: '2017' }], ['Beta', { minYear: '1984' }]])
    } finally { HTMLElement.prototype.scrollIntoView = originalScrollIntoView }
  })

  for (const entry of ['mounted', 'cold']) it(`submits explicit run-route arguments for ${entry} views without stale state`, async () => {
    const originalScrollIntoView = HTMLElement.prototype.scrollIntoView
    HTMLElement.prototype.scrollIntoView = () => {}
    try {
      let route = entry === 'cold' ? 'Alpha/run?minYear=2021&optional=' : 'Alpha'
      const listeners = new Set(), calls = []
      const services = {
        kg: {
          views: async () => ok([
            { name: 'Alpha', cypher: 'RETURN $minYear', params: { minYear: { default: 2000 }, keep: { default: 'kept' }, optional: { default: 'fallback' } } },
            { name: 'Beta', cypher: 'RETURN $minYear', params: { minYear: { default: 1984 }, betaOnly: { default: 'B' } } },
            { name: 'Plain', cypher: 'RETURN 1', params: {} },
          ]),
          schema: async () => ok({ labels: [], relationships: [] }),
          runView: async (name, args) => { calls.push([name, args]); return ok({ rows: [{ name }], rowCount: 1 }) },
        },
        watches: { list: async () => ok([]) },
      }
      const host = {
        selectedView: () => route,
        subscribeSelection: listener => { listeners.add(listener); return () => listeners.delete(listener) },
        navigateToView: (name, destination) => { route = name + (destination === 'open' ? '' : '/' + destination) },
        onOpenInStudio() {}, onCreateHandler() {},
      }
      const drive = async destination => {
        await act(async () => { route = destination; for (const listener of listeners) listener() })
        await flush()
      }
      const { container } = await render(h(features.SavedViewsSurface, { services, host }))
      if (entry === 'mounted') {
        await act(async () => {
          const inputs = container.querySelectorAll('.paramform input')
          setInput(inputs[0], '2017'); setInput(inputs[1], 'custom'); setInput(inputs[2], '')
        })
        await drive('Alpha/run?minYear=2021')
      }
      assert.deepEqual(calls, [['Alpha', { minYear: '2021', keep: entry === 'mounted' ? 'custom' : 'kept' }]])
      assert.equal(container.querySelector('.paramform input').value, '2021')
      assert.equal(container.querySelector('.viewoperation-nav-link.active').dataset.viewPane, 'results')
      assert.equal(container.querySelector('[data-state="view.ran"]').hidden, false)

      await drive('Alpha/run?minYear=2022&keep=&optional=next')
      assert.deepEqual(calls[1], ['Alpha', { minYear: '2022', optional: 'next' }])
      assert.deepEqual([...container.querySelectorAll('.paramform input')].map(e => e.value), ['2022', '', 'next'])
      await drive('Alpha/run')
      assert.deepEqual(calls[2], ['Alpha', { minYear: '2022', optional: 'next' }], 'a run without query arguments uses current supplied values')
      await drive('Beta/run?minYear=1999')
      assert.deepEqual(calls[3], ['Beta', { minYear: '1999', betaOnly: 'B' }], 'a different view uses its defaults, never the previous view or arguments')
      assert.deepEqual([...container.querySelectorAll('.paramform input')].map(e => e.value), ['1999', 'B'])
      await drive('Plain/run')
      assert.deepEqual(calls[4], ['Plain', {}], 'a parameterless view receives an empty argument object')
      assert.equal(calls.length, 5, 'every driven route executes exactly once')
    } finally { HTMLElement.prototype.scrollIntoView = originalScrollIntoView }
  })

  it('C3 bottom following preserves a short pending Watch deep link and the final supported pane', async () => {
    const frames = () => act(async () => { await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))) })
    for (const height of [844, 667]) for (const owned of [false, true]) for (const unsupported of [false, true]) {
      const services = c3Services(), pending = [], navigations = []
      services.watches.list = () => new Promise(resolve => pending.push(resolve))
      let route = 'Alpha/watch'
      const host = { ...c3Host, selectedView: () => route, navigateToView: (name, pane, replace) => { navigations.push([pane, replace]); route = `${name}/${pane}` } }
      const { container, root } = await render(h(features.SavedViewsSurface, { services, host }))
      await frames()
      const operation = container.querySelector('.viewspage-operation')
      operation.style.overflowY = owned ? 'auto' : 'visible'
      const scroller = owned ? operation : document.documentElement
      const descriptors = Object.fromEntries(['clientHeight', 'scrollHeight', 'scrollTop'].map(key => [key, Object.getOwnPropertyDescriptor(scroller, key)]))
      try {
        for (const [key, value] of Object.entries({ clientHeight: height, scrollHeight: height + 1000, scrollTop: 1000 })) Object.defineProperty(scroller, key, { configurable: true, writable: true, value })
        container.querySelector('.viewoperation-nav').getBoundingClientRect = () => ({ bottom: 44 })
        for (const [index, section] of [...container.querySelectorAll('.viewoperation-section')].entries()) section.getBoundingClientRect = () => ({ top: -200 + index * 100 })
        const follow = async () => { (owned ? operation : window).dispatchEvent(new Event('scroll')); await frames() }
        await follow()
        assert.equal(route, 'Alpha/watch', `${height}: pending short Watch remains the destination`)
        assert.equal(button(container, 'Watch / receipts').getAttribute('aria-current'), 'page')
        await act(async () => pending.forEach(resolve => resolve(unsupported ? { ok: false, kind: 'unsupported', status: 404, message: 'Watch unavailable' } : ok([]))))
        await follow()
        const final = unsupported ? 'schema' : 'watch'
        assert.equal(route, `Alpha/${final}`)
        assert.equal(button(container, unsupported ? 'Schema' : 'Watch / receipts').getAttribute('aria-current'), 'page')
        const count = navigations.length
        await follow(); await follow()
        assert.equal(navigations.length, count, 'unchanged bottom never loops or grows history')
        scroller.scrollTop = 800
        await follow()
        assert.equal(route, 'Alpha/schema', 'Schema away from bottom is not forced to Watch')
        assert.ok(navigations.every(([, replace]) => replace === true))
        if (unsupported) {
          services.watches.list = async () => ok([])
          await act(async () => button(container, 'Retry watch listing').click())
          scroller.scrollTop = 1000
          await follow()
          assert.equal(route, 'Alpha/watch', 'successful retry restores Watch as the final supported pane')
        }
      } finally {
        for (const [key, descriptor] of Object.entries(descriptors)) { if (descriptor) Object.defineProperty(scroller, key, descriptor); else delete scroller[key] }
        await act(async () => root.unmount())
        activeRoots.delete(root)
      }
    }
  })

  it('reveals a scroll-followed pane in the nav without fighting the document scroll', async () => {
    const scrollTargets = []
    const originalScrollIntoView = HTMLElement.prototype.scrollIntoView
    HTMLElement.prototype.scrollIntoView = function (options) {
      const kind = this.closest('.viewoperation-nav') ? 'nav' : 'section'
      scrollTargets.push([kind, this.dataset.viewPane, options])
      if (kind === 'nav') this.parentElement.scrollLeft = 45
    }
    try {
      let route = 'Alpha/results'
      const navigations = []
      const services = {
        kg: {
          views: async () => ok([{ name: 'Alpha', description: 'A', cypher: 'RETURN 1', materialized: false, params: {} }]),
          schema: async () => ok({ labels: [], relationships: [] }), runView: async () => ok({ rows: [] }),
          viewInvocation: async () => ok({ cypher: 'RETURN 1' }), deleteView: async () => ok({ deleted: true }), refreshView: async () => ok({ refreshed: true }),
        },
        watches: { list: async () => ok([]), create: async () => ok({}), delete: async () => ok(undefined), run: async () => ok(undefined), runs: async () => ok([]), changes: async () => ok([]), deliveries: async () => ok([]) },
      }
      const host = {
        selectedView: () => route, subscribeSelection: () => () => {},
        navigateToView: (name, destination, replace) => { navigations.push([name, destination, replace]); route = `${name}/${destination}` },
        onOpenInStudio() {}, onCreateHandler() {},
      }
      const { container } = await render(h(features.SavedViewsSurface, { services, host }))
      await act(async () => { await new Promise((resolve) => setTimeout(resolve, 20)) })
      scrollTargets.length = 0
      const nav = container.querySelector('.viewoperation-nav')
      Object.defineProperty(nav, 'getBoundingClientRect', { configurable: true, value: () => ({ bottom: 44 }) })
      for (const [index, section] of [...container.querySelectorAll('.viewoperation-section')].entries()) {
        Object.defineProperty(section, 'getBoundingClientRect', { configurable: true, value: () => ({ top: -200 + index * 60 }) })
      }

      await act(async () => {
        window.dispatchEvent(new Event('scroll'))
        await new Promise((resolve) => setTimeout(resolve, 20))
      })

      assert.equal(button(container, 'Watch / receipts').getAttribute('aria-current'), 'page')
      assert.deepEqual(navigations.at(-1), ['Alpha', 'watch', true])
      assert.equal(nav.scrollLeft, 45)
      assert.deepEqual(scrollTargets, [['nav', 'watch', { block: 'nearest', inline: 'nearest' }]])
    } finally {
      HTMLElement.prototype.scrollIntoView = originalScrollIntoView
    }
  })

  it('keeps scroll following enabled after reselecting the active sibling on a non-Run pane', async () => {
    const scrollTargets = []
    const originalScrollIntoView = HTMLElement.prototype.scrollIntoView
    HTMLElement.prototype.scrollIntoView = function (options) {
      scrollTargets.push([this.closest('.viewoperation-nav') ? 'nav' : 'section', this.dataset.viewPane, options])
    }
    try {
      let route = 'Alpha'
      const navigations = []
      const views = [
        { name: 'Alpha', description: 'A', cypher: 'RETURN 1', materialized: false, params: {} },
        { name: 'Beta', description: 'B', cypher: 'RETURN 2', materialized: false, params: {} },
      ]
      const services = {
        kg: {
          views: async () => ok(views), schema: async () => ok({ labels: [], relationships: [] }), runView: async () => ok({ rows: [] }),
          viewInvocation: async () => ok({ cypher: 'RETURN 1' }), deleteView: async () => ok({ deleted: true }), refreshView: async () => ok({ refreshed: true }),
        },
        watches: { list: async () => ok([]), create: async () => ok({}), delete: async () => ok(undefined), run: async () => ok(undefined), runs: async () => ok([]), changes: async () => ok([]), deliveries: async () => ok([]) },
      }
      const host = {
        selectedView: () => route, subscribeSelection: () => () => {},
        navigateToView: (name, destination, replace) => { navigations.push([name, destination, replace]); route = name ? `${name}${destination === 'open' ? '' : `/${destination}`}` : null },
        onOpenInStudio() {}, onCreateHandler() {},
      }
      const { container } = await render(h(features.SavedViewsSurface, { services, host }))
      await act(async () => container.querySelector('.viewoperation-nav [data-view-pane="watch"]').click())
      await act(async () => { await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))) })
      scrollTargets.length = 0

      await act(async () => container.querySelector('.viewspage-sidebar .viewsibling.active').click())
      await act(async () => { await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))) })
      assert.equal(scrollTargets.some(([kind, pane]) => kind === 'section' && pane === 'watch'), true)
      scrollTargets.length = 0

      const nav = container.querySelector('.viewoperation-nav')
      Object.defineProperty(nav, 'getBoundingClientRect', { configurable: true, value: () => ({ bottom: 44 }) })
      for (const [index, section] of [...container.querySelectorAll('.viewoperation-section')].entries()) {
        Object.defineProperty(section, 'getBoundingClientRect', { configurable: true, value: () => ({ top: -200 + index * 100 }) })
      }
      await act(async () => {
        window.dispatchEvent(new Event('scroll'))
        await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
      })

      assert.equal(button(container, 'Schema').getAttribute('aria-current'), 'page')
      assert.deepEqual(navigations.at(-1), ['Alpha', 'schema', true])
      assert.deepEqual(scrollTargets, [['nav', 'schema', { block: 'nearest', inline: 'nearest' }]])

      scrollTargets.length = 0
      const routeBeforeResize = route
      await act(async () => {
        window.dispatchEvent(new Event('resize'))
        window.dispatchEvent(new Event('scroll')) // Reflow must not cancel the queued restore.
        await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
      })
      assert.equal(route, routeBeforeResize, 'resize preserves the selected pane URL')
      assert.deepEqual(scrollTargets, [
        ['nav', 'schema', { block: 'nearest', inline: 'nearest' }],
        ['section', 'schema', { block: 'start', inline: 'nearest' }],
      ], 'resize restores the active section when its scroll owner changes')
    } finally {
      HTMLElement.prototype.scrollIntoView = originalScrollIntoView
    }
  })

  it('keeps ordinary operation entry visible and does not let a stale open destination block scroll following', async () => {
    const scrollTargets = []
    const originalScrollIntoView = HTMLElement.prototype.scrollIntoView
    HTMLElement.prototype.scrollIntoView = function (options) { scrollTargets.push([this.dataset.viewPane, options]) }
    try {
      let route = 'Alpha'
      const listeners = new Set()
      const navigations = []
      const services = {
        kg: {
          views: async () => ok([{ name: 'Alpha', description: 'A', cypher: 'RETURN 1', materialized: false, params: {} }]),
          schema: async () => ok({ labels: [], relationships: [] }), runView: async () => ok({ rows: [] }),
          viewInvocation: async () => ok({ cypher: 'RETURN 1' }), deleteView: async () => ok({ deleted: true }), refreshView: async () => ok({ refreshed: true }),
        },
        watches: { list: async () => ok([]), create: async () => ok({}), delete: async () => ok(undefined), run: async () => ok(undefined), runs: async () => ok([]), changes: async () => ok([]), deliveries: async () => ok([]) },
      }
      const host = {
        selectedView: () => route, subscribeSelection: (listener) => { listeners.add(listener); return () => listeners.delete(listener) },
        navigateToView: (name, destination, replace) => { navigations.push([name, destination, replace]); route = name ? `${name}${destination === 'open' ? '' : `/${destination}`}` : null },
        onOpenInStudio() {}, onCreateHandler() {},
      }
      const { container } = await render(h(features.SavedViewsSurface, { services, host }))
      await act(async () => { await new Promise((resolve) => setTimeout(resolve, 20)) })
      assert.deepEqual(scrollTargets, [], 'a fresh default deep link preserves the operation identity and return affordance')
      await act(async () => button(container, 'Operation Board').click())
      await act(async () => button(container, 'Alpha').click())
      await act(async () => { await new Promise((resolve) => setTimeout(resolve, 20)) })
      assert.deepEqual(scrollTargets, [], 'opening from the board preserves the operation header')

      route = 'Alpha/open'
      await act(async () => { for (const listener of listeners) listener() })
      await flush()
      const nav = container.querySelector('.viewoperation-nav')
      Object.defineProperty(nav, 'getBoundingClientRect', { configurable: true, value: () => ({ bottom: 44 }) })
      for (const [index, section] of [...container.querySelectorAll('.viewoperation-section')].entries()) {
        Object.defineProperty(section, 'getBoundingClientRect', { configurable: true, value: () => ({ top: -200 + index * 100 }) })
      }
      await act(async () => {
        window.dispatchEvent(new Event('scroll'))
        await new Promise((resolve) => setTimeout(resolve, 20))
      })
      assert.equal(button(container, 'Schema').getAttribute('aria-current'), 'page')
      assert.deepEqual(navigations.at(-1), ['Alpha', 'schema', true])
    } finally {
      HTMLElement.prototype.scrollIntoView = originalScrollIntoView
    }
  })

  it('runs grouped views with typed parameters and hands a typed handler draft to the host', async () => {
    const runs = []
    const drafts = []
    const views = [{ name: 'Overdue', source: 'finance', cypher: 'MATCH (n)', params: { state: { default: 'late' } } }]
    const services = {
      kg: {
        views: async () => ok(views), schema: async () => ok({ labels: [], relationships: [] }),
        runView: async (name, args) => { runs.push([name, args]); return ok({ rows: Array.from({ length: 103 }, (_, id) => ({ id })), rowCount: 103 }) },
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
    await act(async () => container.querySelector('.viewspage-operation .panel .btn.primary').click())
    assert.deepEqual(runs, [['Overdue', { state: 'late' }]])
    assert.equal(container.querySelector('.view-results td')?.dataset.label, 'id')
    assert.equal(container.querySelectorAll('.view-results tbody tr').length, 103)
    assert.equal(container.querySelector('.view-results tbody tr:last-child td')?.textContent, '102')
    await act(async () => button(container, 'Watch / receipts').click())
    await act(async () => button(container, 'Write an agent').click())
    assert.deepEqual(drafts, [{ signalType: 'view.Overdue.changed', view: 'Overdue' }])
    await act(async () => button(container, 'Results').click())
    assert.equal(container.querySelectorAll('.view-results tbody tr').length, 103)
  })

  it('opens an existing agent as an identity-preserving, field-preserving edit', async () => {
    const saved = []
    const existing = {
      name: 'invoice-watch',
      description: 'Escalates overdue invoices',
      source: "console.log('old')",
      signalType: 'InvoiceOverdue',
      schedule: '0 0 9 * * *',
      autonomous: true,
      inputTypeNames: ['Invoice'],
      outputTypeName: 'Escalation',
      skills: ['collections'],
    }
    const services = {
      kg: { schema: async () => ok({ labels: [], relationships: [] }) },
      handlers: {
        list: async () => ok({ yours: [{ ...existing, active: true }], available: [] }),
        open: async () => ok(existing),
        validate: async () => ok({ valid: true, violations: [], durationMs: 1 }),
        dryRun: async () => ok({ ok: true, stdout: '', ranAgainst: { signalType: 'cron', signalId: 'tick-1' } }),
        setEnabled: async () => ok({ enabled: true }),
        delete: async () => ok({ deleted: true }),
      },
      generateHandler: async () => ok({ source: '', valid: true, attempts: 1 }),
      saveHandler: async (request) => { saved.push(request); return ok({ ok: true, message: 'updated' }) },
      gatewayInterfaces: async () => ok('export interface GatewayContext {}'),
      signalTypes: async () => ok([]), worldSkills: async () => ok([]),
    }
    const { container } = await render(h(features.HandlerStudioSurface, { services }))
    const editor = container.querySelector('.CodeMirror').CodeMirror
    assert.equal(editor.getInputField().getAttribute('aria-label'), 'Agent code')
    assert.equal(editor.getScrollerElement().tabIndex, 0)
    await act(async () => button(container, 'invoice-watch').click())
    await flush()

    const fields = [...container.querySelectorAll('.saveform input')]
    assert.equal(fields[0].value, existing.name)
    assert.equal(fields[0].readOnly, true)
    assert.equal(fields[0].disabled, false)
    assert.match(container.textContent, /Name identifies this agent\. Saving updates it in place\./)
    assert.equal(fields[1].value, existing.signalType)
    assert.equal(fields[2].value, existing.schedule)
    assert.equal(fields[3].checked, true)

    await act(async () => button(container, 'Save agent').click())
    await flush()
    assert.deepEqual(saved, [existing])

    await act(async () => button(container, 'New agent').click())
    const freshFields = [...container.querySelectorAll('.saveform input')]
    assert.equal(freshFields[0].value, '')
    assert.equal(freshFields[0].readOnly, false)
    assert.equal(freshFields[1].value, '')
    assert.equal(freshFields[2].value, '')
    assert.equal(freshFields[3].checked, false)
    assert.equal(container.querySelector('.CodeMirror').CodeMirror.getValue().includes('triggered by'), true)
  })

  it('New agent resets a newly saved agent before creating another', async () => {
    const saved = []
    let yours = []
    const services = {
      kg: { schema: async () => ok({ labels: [], relationships: [] }) },
      handlers: {
        list: async () => ok({ yours: yours.map((entry) => ({ ...entry })), available: [] }),
        open: async () => refused('absent'),
        validate: async () => ok({ valid: true, violations: [], durationMs: 1 }),
        dryRun: async () => ok({ ok: true, stdout: '', ranAgainst: { signalType: 'cron', signalId: 'tick-1' } }),
        setEnabled: async () => ok({ enabled: true }), delete: async () => ok({ deleted: true }),
      },
      generateHandler: async () => ok({ source: '', valid: true, attempts: 1 }),
      saveHandler: async (request) => {
        saved.push(request)
        yours = [{ ...request, active: false, autonomous: request.autonomous ?? false }]
        return ok({ ok: true, message: 'saved' })
      },
      gatewayInterfaces: async () => ok('export interface GatewayContext {}'),
      signalTypes: async () => ok([]),
      worldSkills: async () => ok([{ name: 'collections', description: 'Collections' }]),
    }
    const { container } = await render(h(features.HandlerStudioSurface, { services }))
    const form = () => [...container.querySelectorAll('.saveform input')]
    const editor = container.querySelector('.CodeMirror').CodeMirror

    await act(async () => setInput(form()[0], 'first-agent'))
    await act(async () => setInput(form()[1], 'FirstSignal'))
    await act(async () => setInput(form()[2], '0 0 9 * * *'))
    await act(async () => form()[3].click())
    await act(async () => button(container, 'collections').click())
    await act(async () => editor.setValue("console.log('first')"))
    await act(async () => button(container, 'Save agent').click())
    await flush()
    assert.equal(form()[0].readOnly, true)

    await act(async () => button(container, 'New agent').click())
    assert.equal(form()[0].value, '')
    assert.equal(form()[0].readOnly, false)
    assert.equal(form()[1].value, '')
    assert.equal(form()[2].value, '')
    assert.equal(form()[3].checked, false)
    assert.equal(button(container, 'collections').getAttribute('aria-pressed'), 'false')
    assert.match(editor.getValue(), /triggered by/)

    await act(async () => setInput(form()[0], 'second-agent'))
    await act(async () => editor.setValue("console.log('second')"))
    await act(async () => button(container, 'Save agent').click())
    await flush()
    assert.deepEqual(saved.map(({ name }) => name), ['first-agent', 'second-agent'])
  })

  it('keeps the opened form in sync across watching, acting, idle, and watching again', async () => {
    const saves = []
    const enabled = []
    const action = {
      name: 'watcher', description: 'Watcher', source: "console.log('watch')", signalType: 'IssueChanged',
      schedule: '0 0 8 * * *', autonomous: false, active: true, inputTypeNames: ['Issue'], outputTypeName: 'void', skills: ['issues'],
    }
    const openShape = () => { const { active: _active, ...spec } = action; return { ...spec, inputTypeNames: [...spec.inputTypeNames], skills: [...spec.skills] } }
    const services = {
      kg: { schema: async () => ok({ labels: [], relationships: [] }) },
      handlers: {
        list: async () => ok({ yours: [{ ...action, inputTypeNames: [...action.inputTypeNames], skills: [...action.skills] }], available: [] }),
        open: async () => ok(openShape()),
        validate: async () => ok({ valid: true, violations: [], durationMs: 1 }),
        dryRun: async () => ok({ ok: true, stdout: '', ranAgainst: { signalType: 'cron', signalId: 'tick-1' } }),
        setEnabled: async (name, value) => { enabled.push([name, value]); action.active = value; return ok({ enabled: value }) },
        delete: async () => ok({ deleted: true }),
      },
      generateHandler: async () => ok({ source: '', valid: true, attempts: 1 }),
      saveHandler: async (request) => { saves.push(request); Object.assign(action, request); return ok({ ok: true, message: 'saved' }) },
      gatewayInterfaces: async () => ok('export interface GatewayContext {}'),
      signalTypes: async () => ok([]), worldSkills: async () => ok([]),
    }
    const { container } = await render(h(features.HandlerStudioSurface, { services }))
    await act(async () => button(container, 'watcher').click())
    await act(async () => button(container, 'Start acting').click())
    await flush()
    await act(async () => button(container, 'Save agent').click())
    await flush()
    assert.deepEqual(saves.map(({ autonomous }) => autonomous), [true, true])

    await act(async () => button(container, 'Stand down').click())
    await flush()
    await act(async () => button(container, 'Start watching').click())
    await flush()
    await act(async () => button(container, 'Save agent').click())
    await flush()
    assert.deepEqual(enabled, [['watcher', false], ['watcher', true]])
    assert.deepEqual(saves.map(({ autonomous }) => autonomous), [true, true, false, false])
  })

  it('offers deterministic agent state transitions with labels naming their result', async () => {
    const opened = []
    const enabled = []
    const saved = []
    const source = (name, autonomous) => ({
      name, description: `${name} agent`, source: `console.log('${name}')`, signalType: 'IssueChanged',
      schedule: '0 0 8 * * *', autonomous, inputTypeNames: ['Issue'], outputTypeName: 'void', skills: ['issues'],
    })
    const services = {
      kg: { schema: async () => ok({ labels: [], relationships: [] }) },
      handlers: {
        list: async () => ok({ yours: [
          { ...source('idle', false), active: false },
          { ...source('watcher', false), active: true },
          { ...source('actor', true), active: true },
        ], available: [{ name: 'realm-observer', signalType: 'IssueChanged' }] }),
        open: async (name) => { opened.push(name); return ok(source(name, name === 'actor')) },
        validate: async () => ok({ valid: true, violations: [], durationMs: 1 }),
        dryRun: async () => ok({ ok: true, stdout: '', ranAgainst: { signalType: 'cron', signalId: 'tick-1' } }),
        setEnabled: async (name, value) => { enabled.push([name, value]); return ok({ enabled: value }) },
        delete: async () => ok({ deleted: true }),
      },
      generateHandler: async () => ok({ source: '', valid: true, attempts: 1 }),
      saveHandler: async (request) => { saved.push(request); return ok({ ok: true, message: 'updated' }) },
      gatewayInterfaces: async () => ok('export interface GatewayContext {}'),
      signalTypes: async () => ok([]), worldSkills: async () => ok([]),
    }
    const { container } = await render(h(features.HandlerStudioSurface, { services }))
    assert.deepEqual(
      [...container.querySelectorAll('.handler-row .btn')].map((candidate) => candidate.textContent.trim()),
      ['Start watching', 'Delete', 'Start acting', 'Delete', 'Stand down', 'Delete', 'Start watching'],
    )

    await act(async () => button(container, 'Start watching').click())
    await act(async () => button(container, 'Start acting').click())
    await act(async () => button(container, 'Stand down').click())
    await flush()
    assert.deepEqual(enabled, [['idle', true], ['actor', false]])
    assert.deepEqual(opened, ['watcher'])
    assert.deepEqual(saved, [{ ...source('watcher', false), autonomous: true }])
    assert.match(container.textContent, /Acting agents must stand down before returning to watching/)

    globalThis.confirm = () => false
    await act(async () => [...container.querySelectorAll('.handler-row')].at(-1).querySelector('button.btn').click())
    await flush()
    assert.equal(enabled.some(([name]) => name === 'realm-observer'), false)
    assert.equal([...container.querySelectorAll('.handler-row')].at(-1).textContent.includes('realm-observer'), true)
    globalThis.confirm = () => true
  })

  it('completes only fields declared by the selected signal type', async () => {
    const services = {
      kg: { schema: async () => ok({ labels: [], relationships: [] }) },
      handlers: {
        list: async () => ok({ yours: [], available: [] }), open: async () => refused('absent'),
        validate: async () => ok({ valid: true, violations: [], durationMs: 1 }),
        dryRun: async () => ok({ ok: true, stdout: '', ranAgainst: { signalType: 'cron', signalId: 'tick-1' } }),
        setEnabled: async () => ok({ enabled: true }), delete: async () => ok({ deleted: true }),
      },
      generateHandler: async () => ok({ source: '', valid: true, attempts: 1 }),
      saveHandler: async () => ok({ ok: true, message: 'saved' }),
      gatewayInterfaces: async () => ok('export interface GatewayContext {}'),
      signalTypes: async () => ok([
        { typeName: 'InvoiceOverdue', fields: ['invoiceId', 'amount'], count: 12, lastSeen: '2026-09-08' },
        { typeName: 'PullRequestReviewed', fields: ['repository', 'reviewer'], count: 4, lastSeen: '2026-09-07' },
      ]),
      worldSkills: async () => ok([]),
    }
    const { container } = await render(h(features.HandlerStudioSurface, { services }))
    const cm = container.querySelector('.CodeMirror').CodeMirror
    const choices = () => [...document.querySelectorAll('.CodeMirror-hints li')].map((item) => item.textContent)
    const use = (type) => [...container.querySelectorAll('.signalrow')]
      .find((row) => row.textContent.includes(type)).querySelector('button.btn')

    await act(async () => use('InvoiceOverdue').click())
    await act(async () => { cm.setValue('signal.'); cm.setCursor(cm.lineCount() - 1, 7); cm.execCommand('autocomplete') })
    assert.deepEqual(choices(), ['amount', 'invoiceId'])
    cm.closeHint()

    await act(async () => use('PullRequestReviewed').click())
    await act(async () => { cm.setValue('signal.'); cm.setCursor(cm.lineCount() - 1, 7); cm.execCommand('autocomplete') })
    assert.deepEqual(choices(), ['repository', 'reviewer'])
    cm.closeHint()
  })

  it('explains when switching an agent to acting is unavailable', async () => {
    const services = {
      kg: { schema: async () => ok({ labels: [], relationships: [] }) },
      handlers: {
        list: async () => ok({ yours: [{ name: 'watcher', active: true, autonomous: false }], available: [] }),
        open: async () => refused('source is locked'),
        validate: async () => ok({ valid: true, violations: [], durationMs: 1 }),
        dryRun: async () => ok({ ok: true, stdout: '', ranAgainst: { signalType: 'cron', signalId: 'tick-1' } }),
        setEnabled: async () => ok({ enabled: true }),
        delete: async () => ok({ deleted: true }),
      },
      generateHandler: async () => ok({ source: '', valid: true, attempts: 1 }),
      saveHandler: async () => ok({ ok: true, message: 'updated' }),
      gatewayInterfaces: async () => ok('export interface GatewayContext {}'),
      signalTypes: async () => ok([]), worldSkills: async () => ok([]),
    }
    const { container } = await render(h(features.HandlerStudioSurface, { services }))
    await act(async () => button(container, 'Start acting').click())
    await flush()
    assert.match(container.textContent, /Start acting is unavailable: Could not open the agent \(HTTP 400\)\. source is locked/)
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
    let schemaLoads = 0
    let signal
    const history = { read: () => [], write() {} }
    const sessionWrites = []
    const session = { read: () => null, write: (value) => sessionWrites.push(value) }
    const scope = { name: 'recent', statement: 'MATCH (n)', outputLabel: 'Chunk', members: 2, expiresAt: 'soon' }
    const base = {
      runs: async () => ok([]),
      schema: async () => { schemaLoads += 1; return ok({ labels: [], relationships: [] }) },
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
              rows: [{ id: 1, contract: { agency: 'Digital Services Agency', amount: 84000 } }],
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
    const refreshSchema = rendered.container.querySelector('button[aria-label="Refresh schema"]')
    assert.ok(refreshSchema, 'schema refresh has an accessible name')
    const loadsBeforeRefresh = schemaLoads
    await act(async () => refreshSchema.click())
    await flush()
    assert.equal(schemaLoads, loadsBeforeRefresh + 1)
    const editorHelp = rendered.container.querySelector('.editor-help')
    const editorHelpSummary = editorHelp.querySelector('summary')
    assert.equal(editorHelp.open, false)
    editorHelpSummary.focus()
    assert.equal(document.activeElement, editorHelpSummary, 'native summary is keyboard focusable')
    await act(async () => editorHelpSummary.click())
    assert.equal(editorHelp.open, true)
    assert.match(editorHelp.textContent, /Control.*Space.*completes from the schema/)
    const featureCss = postcss.parse(
      readFileSync(new URL('../css/features.css', import.meta.url), 'utf8'),
      { from: 'features.css' },
    )
    const askActionRule = featureCss.nodes
      .flatMap((node) => node.type === 'rule' ? [node] : [])
      .find((rule) => rule.selectors?.includes(':where(.kit-feature) .studio-pane-query .ask-row > .btn'))
    assert.ok(askActionRule, 'Query Ask actions have a bounded shared rule')
    assert.equal(askActionRule.nodes.some((node) => node.prop === 'margin' && node.value === '0'), true)
    const askActionSelector = askActionRule.selectors.find((selector) => selector.includes('.ask-row'))
    assert.equal(button(rendered.container, 'Write the query').matches(askActionSelector), true)
    assert.equal(button(rendered.container, 'Refine').matches(askActionSelector), true)
    assert.equal(button(rendered.container, 'Run').matches(askActionSelector), false)
    await act(async () => button(rendered.container, 'Pin').click())
    assert.deepEqual(pinned, ['recent'])
    await act(async () => button(rendered.container, 'Cancel').click())
    await flush()
    assert.deepEqual(canceled, ['fill-1'])
    await act(async () => button(rendered.container, 'Interactive').click())
    const sessionCm = rendered.container.querySelector('.session-cm .CodeMirror').CodeMirror
    const sessionDisposal = observeEditorDisposal(sessionCm)
    await act(async () => sessionCm.setValue('RETURN 7'))
    const paneLink = name => [...rendered.container.querySelectorAll('.studiotab')].find(b => b.textContent.trim() === name)
    await act(async () => paneLink('Query').click())
    await act(async () => paneLink('Interactive').click())
    assert.equal(rendered.container.querySelector('.session-cm .CodeMirror').CodeMirror, sessionCm)
    assert.equal(sessionCm.getValue(), 'RETURN 7', 'section navigation preserves the unsent prompt')
    const fieldCss = postcss.parse(
      readFileSync(new URL('../css/features.css', import.meta.url), 'utf8'),
      { from: 'features.css' },
    )
    let fieldSkinRule
    fieldCss.walkRules((rule) => {
      if (rule.selectors?.includes(':where(.kit-feature) input:not([type])') &&
          rule.nodes.some((node) => node.type === 'decl' && node.prop === 'box-sizing')) fieldSkinRule = rule
    })
    assert.ok(fieldSkinRule, 'shared field skin rule')
    const nativeAskInput = rendered.container.querySelector('.studio-pane-query .ask-row > input')
    const codeMirrorInput = rendered.container.querySelector('.session-cm .CodeMirror textarea')
    assert.equal(codeMirrorInput.getAttribute('aria-label'), 'Session query')
    assert.equal(sessionCm.getScrollerElement().tabIndex, 0)
    assert.equal(sessionCm.getScrollerElement().getAttribute('aria-label'), 'Session query scroll area')
    const matchesFieldSkin = (element) => fieldSkinRule.selectors.some((selector) => element.matches(selector))
    assert.equal(matchesFieldSkin(nativeAskInput), true, 'native Query input keeps the shared field skin')
    assert.equal(matchesFieldSkin(codeMirrorInput), false, 'CodeMirror input stays editor-owned')
    await act(async () => sessionCm.setValue('MATCH (c:Chunk)'))
    await act(async () => [...rendered.container.querySelectorAll('button')].find(b => b.textContent.trim() === 'Enter').click())
    await flush()
    assert.equal(interactiveRuns.length, 1)
    assert.equal(interactiveRuns[0][1].captureAs, '_1')
    assert.equal(sessionWrites.at(-1).bindings[0].name, '_1')
    const rowDisclosure = rendered.container.querySelector('.session-rows')
    assert.equal(rowDisclosure.querySelector('summary').textContent.trim(), 'Rows')
    await act(async () => rowDisclosure.querySelector('summary').click())
    assert.equal(rowDisclosure.querySelector('.cell-object').textContent,
      '{\n  "agency": "Digital Services Agency",\n  "amount": 84000\n}')

    await act(async () => button(rendered.container, 'Query').click())
    const mainCm = rendered.container.querySelector('.studio-pane-query .CodeMirror').CodeMirror
    const mainDisposal = observeEditorDisposal(mainCm)
    await act(async () => mainCm.setValue('MATCH (n) RETURN n'))
    assert.equal(button(rendered.container, 'Run').disabled, true)
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 750)) })
    assert.equal(button(rendered.container, 'Run').disabled, false)
    const editorWrap = rendered.container.querySelector('.studio-pane-query .editor-wrap')
    const expandEditor = button(rendered.container, 'Expand editor')
    assert.equal(expandEditor.getAttribute('aria-expanded'), 'false')
    assert.equal(editorWrap.classList.contains('is-expanded'), false)
    await act(async () => expandEditor.click())
    assert.equal(expandEditor.getAttribute('aria-expanded'), 'true')
    assert.equal(editorWrap.classList.contains('is-expanded'), true)
    assert.equal(button(rendered.container, 'Run').closest('.studio-actions').contains(editorWrap), false)
    await act(async () => button(rendered.container, 'Collapse editor').click())
    assert.equal(editorWrap.classList.contains('is-expanded'), false)
    assert.equal(button(rendered.container, 'Expand editor').getAttribute('aria-expanded'), 'false')
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

  it('keeps Stop as a request until execution confirms killed, and distinguishes unconfirmed and failed stops', async () => {
    const deferred = () => {
      let resolve
      const promise = new Promise((done) => { resolve = done })
      return { promise, resolve }
    }
    const runScenario = async (killOutcome) => {
      let onProgress
      let resolveExecute
      const execute = new Promise((resolve) => { resolveExecute = resolve })
      const services = {
        kg: {
          runs: async () => ok([]), schema: async () => ok({ labels: [], relationships: [] }),
          validate: async () => ok({ ok: true, violations: [] }), execute: async () => execute,
          kill: async () => killOutcome, generate: async () => ok({ cypher: '' }),
          refine: async () => ok({ cypher: '' }), saveView: async () => ok({ saved: true }),
          scopes: async () => ok({ scopes: [] }), pinScope: async () => ok({ pinned: true }),
          deleteScope: async () => ok({ deleted: true }),
        },
        fills: { list: async () => ok([]), create: async () => ok({ id: 'f' }), delete: async () => ok(undefined) },
        subscribeProgress: (listener) => { onProgress = listener },
      }
      const host = { history: { read: () => [], write() {} }, interactive: { session: { read: () => null, write() {} } } }
      const rendered = await render(h(features.QueryStudioSurface, { services, host, handedOver: 'RETURN 1' }))
      await act(async () => { await new Promise((resolve) => setTimeout(resolve, 750)) })
      await act(async () => button(rendered.container, 'Run').click())
      await act(async () => onProgress({ type: 'query.started', queryId: 'run-1', userId: 'u1', seq: 1, atMs: 1, cypher: 'RETURN 1' }))
      await act(async () => button(rendered.container, 'Query').click())
      await act(async () => button(rendered.container, 'Stop').click())
      return { ...rendered, resolveExecute }
    }

    let rendered = await runScenario(ok({ runId: 'run-1', killed: true }))
    let queryStatus = rendered.container.querySelector('.query-stop-status')
    let queryActions = rendered.container.querySelector('.studio-pane-query .studio-actions')
    assert.equal(queryActions.contains(queryStatus), false, 'Stop feedback does not consume action-row width')
    assert.equal(queryActions.nextElementSibling, queryStatus, 'Stop feedback is the adjacent row after actions')
    assert.match(queryStatus.textContent, /Stop requested.*waiting for the run to confirm/i)
    assert.equal(queryStatus.classList.contains('caution'), false)
    assert.doesNotMatch(queryStatus.textContent, /Stopped\./)
    await act(async () => rendered.resolveExecute(ok({ reason: 'KILLED', rows: [], hint: 'Stopped at a checkpoint.' })))
    await flush()
    queryStatus = rendered.container.querySelector('.query-stop-status')
    assert.match(queryStatus.textContent, /Stopped\. Stopped at a checkpoint\./)
    assert.equal(queryStatus.classList.contains('caution'), true)
    await act(async () => rendered.root.unmount())
    activeRoots.delete(rendered.root)

    rendered = await runScenario(ok({ runId: 'run-1', killed: true }))
    await act(async () => rendered.resolveExecute(ok({ rows: [{ answer: 1 }], rowCount: 1 })))
    await flush()
    queryStatus = rendered.container.querySelector('.query-stop-status')
    assert.match(queryStatus.textContent, /Stop was requested, but the run finished before it could stop\./)
    assert.equal(queryStatus.classList.contains('caution'), true)
    assert.doesNotMatch(queryStatus.textContent, /waiting|Stopped\./)
    await act(async () => rendered.root.unmount())
    activeRoots.delete(rendered.root)

    rendered = await runScenario(ok({ runId: 'run-1', killed: true }))
    await act(async () => rendered.resolveExecute({ ok: false, kind: 'unreachable', status: 503, message: 'execute failed' }))
    await flush()
    assert.equal(rendered.container.querySelector('.query-stop-status'), null)
    await act(async () => button(rendered.container, 'Results').click())
    assert.match(rendered.container.querySelector('.studio-pane[data-studio-pane="results"]').textContent, /execute failed/)
    await act(async () => rendered.root.unmount())
    activeRoots.delete(rendered.root)

    let lateKill = deferred()
    rendered = await runScenario(lateKill.promise)
    await act(async () => button(rendered.container, 'stopping…').click())
    await act(async () => rendered.resolveExecute(ok({ reason: 'KILLED', rows: [], hint: 'Confirmed before kill responses.' })))
    await flush()
    queryStatus = rendered.container.querySelector('.query-stop-status')
    assert.match(queryStatus.textContent, /Stopped\. Confirmed before kill responses\./)
    await act(async () => lateKill.resolve(ok({ runId: 'run-1', killed: false })))
    await flush()
    queryStatus = rendered.container.querySelector('.query-stop-status')
    assert.match(queryStatus.textContent, /Stopped\. Confirmed before kill responses\./)
    assert.doesNotMatch(queryStatus.textContent, /not confirmed/)
    await act(async () => rendered.root.unmount())
    activeRoots.delete(rendered.root)

    lateKill = deferred()
    rendered = await runScenario(lateKill.promise)
    await act(async () => rendered.resolveExecute(ok({ rows: [{ answer: 1 }], rowCount: 1 })))
    await flush()
    assert.equal(rendered.container.querySelector('.query-stop-status'), null)
    await act(async () => lateKill.resolve(ok({ runId: 'run-1', killed: false })))
    await flush()
    assert.equal(rendered.container.querySelector('.query-stop-status'), null)
    await act(async () => button(rendered.container, 'Results').click())
    assert.match(rendered.container.querySelector('.studio-pane[data-studio-pane="results"]').textContent, /1 row/)
    await act(async () => rendered.root.unmount())
    activeRoots.delete(rendered.root)

    lateKill = deferred()
    rendered = await runScenario(lateKill.promise)
    await act(async () => rendered.resolveExecute({ ok: false, kind: 'unreachable', status: 503, message: 'terminal execute error' }))
    await flush()
    assert.equal(rendered.container.querySelector('.query-stop-status'), null)
    await act(async () => lateKill.resolve(ok({ runId: 'run-1', killed: false })))
    await flush()
    assert.equal(rendered.container.querySelector('.query-stop-status'), null)
    await act(async () => button(rendered.container, 'Results').click())
    assert.match(rendered.container.querySelector('.studio-pane[data-studio-pane="results"]').textContent, /terminal execute error/)
    await act(async () => rendered.root.unmount())
    activeRoots.delete(rendered.root)

    rendered = await runScenario(ok({ runId: 'run-1', killed: false }))
    queryStatus = rendered.container.querySelector('.query-stop-status')
    queryActions = rendered.container.querySelector('.studio-pane-query .studio-actions')
    assert.equal(queryActions.contains(queryStatus), false)
    assert.equal(queryActions.nextElementSibling, queryStatus)
    assert.match(queryStatus.textContent, /Stop was not confirmed.*may already have finished/i)
    assert.equal(queryStatus.classList.contains('caution'), true)
    await act(async () => rendered.root.unmount())
    activeRoots.delete(rendered.root)

    rendered = await runScenario({ ok: false, kind: 'unreachable', status: 503, message: 'fixture refused stop' })
    queryStatus = rendered.container.querySelector('.query-stop-status')
    assert.match(queryStatus.textContent, /fixture refused stop/i)
    assert.equal(queryStatus.classList.contains('error'), true)
    assert.doesNotMatch(queryStatus.textContent, /Stopped\./)
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

  it('does not describe a failed view run as unattempted or a watch run as a delivered signal', async () => {
    const services = {
      kg: { views: async () => ok([{ name: 'Alpha', source: 'World', cypher: 'RETURN 1', params: {} }]),
        schema: async () => ok({ labels: [], relationships: [] }), runView: async () => refused('Check the query') },
      watches: { list: async () => ok([{ id: 'w1', lensId: 'Alpha', name: 'Alpha', enabled: true }]),
        run: async () => ok(undefined), runs: async () => ok([]), changes: async () => ok([]), deliveries: async () => ok([]) },
    }
    const host = { selectedView: () => 'Alpha/open', subscribeSelection: () => () => {}, onOpenInStudio() {}, onCreateHandler() {} }
    const { container } = await render(h(features.SavedViewsSurface, { services, host }))
    await act(async () => container.querySelector('.viewspage-operation .btn.primary').click())
    assert.match(container.querySelector('[role="alert"]').textContent, /Alpha.*Check the query/)
    assert.doesNotMatch(container.textContent, /Nothing run yet|No rows\./)
    await act(async () => button(container, 'Watch / receipts').click())
    await act(async () => button(container, 'Run it now').click())
    const status = [...container.querySelectorAll('.status')].find(e => e.textContent.includes('Run requested'))
    assert.match(status.textContent, /Check the run receipts above for its outcome/)
    const runsHeading = [...container.querySelectorAll('.subhead')].find(e => e.textContent === 'Runs')
    assert.ok(runsHeading.compareDocumentPosition(status) & 4)
    assert.match(container.textContent, /Change signal:\s+view\.Alpha\.changed/)
    assert.match(container.textContent, /Schedule:\s+not scheduled/)
    assert.match(container.textContent, /Delivery:\s+none — notifies no one/)
    assert.doesNotMatch(container.textContent, /has published a signal|publishes nothing/)
  })

  it('does not infer signal publication or delivery success from delivery receipts', async () => {
    for (const channel of [undefined, 'none', 'signal']) {
      const services = {
        kg: { views: async () => ok([{ name: 'Alpha', source: 'World', cypher: 'RETURN 1', params: {} }]), schema: async () => ok({ labels: [], relationships: [] }) },
        watches: { list: async () => ok([{ id: 'w1', lensId: 'Alpha', enabled: true, delivery: channel ? { channel } : null }]),
          runs: async () => ok([{ id: 'r1', diffId: 'd1', status: 'COMPLETED' }]),
          changes: async () => ok([{ id: 'd1', changes: [{ kind: 'ADDED', key: 'item' }] }]),
          deliveries: async () => ok(channel === 'signal' ? [{ diffId: 'd1', channel: 'signal', status: 'FAILED' }] : []) },
      }
      const host = { selectedView: () => 'Alpha/open', subscribeSelection: () => () => {}, onOpenInStudio() {}, onCreateHandler() {} }
      const { container } = await render(h(features.SavedViewsSurface, { services, host }))
      await act(async () => button(container, 'Watch / receipts').click())
      if (channel === 'signal') assert.match(container.textContent, /Delivery to signal · failed/)
      else {
        assert.match(container.textContent, /none — notifies no one/)
        assert.match(container.textContent, /No delivery receipt is available/)
      }
      assert.doesNotMatch(container.textContent, /publishes nothing|No change signal was published|published to/)
    }
  })

  it('watch receipt failures retain a real status and never invent HTTP undefined', async () => {
    for (const status of [undefined, 503]) {
      const services = {
        kg: { views: async () => ok([{ name: 'Alpha', source: 'World', cypher: 'RETURN 1', params: {} }]), schema: async () => ok({ labels: [], relationships: [] }) },
        watches: { list: async () => ok([{ id: 'w1', lensId: 'Alpha', enabled: true }]),
          runs: async () => ({ ok: false, kind: status ? 'failed' : 'unreachable', status, message: 'Receipt detail' }),
          changes: async () => ok([]), deliveries: async () => ok([]) },
      }
      const host = { selectedView: () => 'Alpha/open', subscribeSelection: () => () => {}, onOpenInStudio() {}, onCreateHandler() {} }
      const { container } = await render(h(features.SavedViewsSurface, { services, host }))
      await act(async () => button(container, 'Watch / receipts').click())
      const text = container.querySelector('[role="alert"]').textContent
      assert.match(text, /Could not list this watch's runs.*Receipt detail/)
      assert.equal(text.includes('HTTP'), status !== undefined)
      if (status) assert.match(text, /HTTP 503/)
      assert.doesNotMatch(text, /undefined/)
    }
  })

  it('keeps pending agents distinct from a successfully empty listing', async () => {
    let finish
    const services = {
      kg: { schema: async () => ok({ labels: [], relationships: [] }) },
      handlers: { list: () => new Promise(resolve => { finish = resolve }), validate: async () => ok({ valid: true, violations: [] }) },
      gatewayInterfaces: async () => ok('export interface GatewayContext {}'),
      signalTypes: async () => ok([]), worldSkills: async () => ok([]),
    }
    const { container } = await render(h(features.HandlerStudioSurface, { services }))
    assert.match(container.textContent, /Loading agents/)
    assert.doesNotMatch(container.textContent, /No agents are listed|Nothing runs unattended/)
    await act(async () => finish(ok({ yours: [], available: [] })))
    assert.match(container.textContent, /No agents are listed/)
  })

  it('offers realm-list recovery and excludes stale update targets after recovery', async () => {
    let listed = false
    const services = {
      listInstalled: async () => listed ? ok([]) : { ok: false, kind: 'unauthorized', status: 403, message: 'Forbidden' },
      listDirectory: async () => ok({ providers: [] }), listUpdates: async () => ok({ results: [{ name: 'removed', behind: true }] }),
      listTours: async () => ok([]),
    }
    const { container } = await render(h(features.RealmsSurface, { services, host: {} }))
    assert.match(container.querySelector('[role="alert"]').textContent, /administrator/)
    listed = true
    await act(async () => button(container, 'Retry listing realms').click())
    await flush()
    assert.match(container.textContent, /No realms installed/)
    assert.doesNotMatch(container.textContent, /Update 1|Refresh all/)
  })

  it('does not suggest retrying a smart search that returned a background handle', async () => {
    const services = {
      listInstalled: async () => ok([]), listDirectory: async () => ok({ providers: [{ provider: 'World', realms: [{ name: 'grants', url: 'https://example.org/grants' }] }] }),
      listUpdates: async () => ok({ results: [] }), listTours: async () => ok([]),
      searchRealms: async () => ok({ runId: 'still-running' }),
    }
    const { container } = await render(h(features.RealmsSurface, { services, host: {} }))
    await act(async () => setInput(container.querySelector('input[type="search"]'), 'grants'))
    await act(async () => button(container, 'Smart search').click())
    assert.match(container.textContent, /started a background run/)
    assert.doesNotMatch(container.textContent, /try Smart search again/)
    assert.equal(container.querySelector('.status.caution').getAttribute('role'), 'status')
  })

  it('preserves session rewind numbering after holes', () => {
    assert.equal(features.rewoundCounter(['_1', '_3', '$named']), 3)
    assert.equal(features.rewoundCounter([]), 0)
  })
})
