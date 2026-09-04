import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, describe, it } from 'node:test'
import { JSDOM } from 'jsdom'
import { act, createElement as h, createRef, useState } from 'react'

const dom = new JSDOM('<!doctype html><html><body></body></html>', {
  pretendToBeVisual: true,
})

for (const key of [
  'window',
  'document',
  'navigator',
  'HTMLElement',
  'HTMLButtonElement',
  'Event',
  'KeyboardEvent',
  'MouseEvent',
]) {
  Object.defineProperty(globalThis, key, {
    configurable: true,
    value: dom.window[key],
  })
}
globalThis.requestAnimationFrame = dom.window.requestAnimationFrame.bind(dom.window)
globalThis.cancelAnimationFrame = dom.window.cancelAnimationFrame.bind(dom.window)
globalThis.IS_REACT_ACT_ENVIRONMENT = true

const { createRoot } = await import('react-dom/client')
const kit = await import('@embabel/appliance-kit/react')
const require = createRequire(import.meta.url)
const cjsKit = require('@embabel/appliance-kit/react')
const activeRoots = new Set()

async function render(node) {
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  activeRoots.add(root)
  await act(async () => root.render(node))
  return {
    container,
    rerender: async (next) => act(async () => root.render(next)),
  }
}

afterEach(async () => {
  await act(async () => {
    for (const root of activeRoots) root.unmount()
  })
  activeRoots.clear()
  document.body.replaceChildren()
})

describe('the public React entry point', () => {
  it('loads as ESM and CommonJS', () => {
    assert.equal(typeof kit.Button, 'object')
    assert.equal(typeof kit.ReceiptStrip, 'function')
    assert.equal(typeof cjsKit.Button, 'object')
    assert.equal(typeof cjsKit.ReceiptStrip, 'function')
  })

  it('keeps all existing build output free of React imports', () => {
    const javascriptFiles = (directory) =>
      readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
        const path = join(directory, entry.name)
        if (entry.isDirectory()) return entry.name === 'react' ? [] : javascriptFiles(path)
        return entry.name.endsWith('.js') ? [path] : []
      })

    const reactImport = /(?:from\s+|import\s*\(|require\()['"]react(?:\/|['"])/
    for (const directory of ['dist/esm', 'dist/cjs']) {
      for (const file of javascriptFiles(directory)) {
        assert.doesNotMatch(readFileSync(file, 'utf8'), reactImport, file)
      }
    }
  })
})

describe('shared components', () => {
  it('preserves button state, click, native attributes, refs, and class merging', async () => {
    let clicks = 0
    const ref = createRef()
    const { container } = await render(
      h(
        kit.Button,
        {
          ref,
          intent: 'destructive',
          className: 'consumer-class',
          'aria-disabled': true,
          'data-command': 'delete',
          onClick: () => clicks++,
        },
        'Delete',
      ),
    )

    const button = container.querySelector('button')
    assert.equal(button, ref.current)
    assert.equal(button.type, 'button')
    assert.equal(button.disabled, false)
    assert.match(button.className, /kit-button destructive consumer-class/)
    assert.equal(button.dataset.command, 'delete')
    await act(async () => button.click())
    assert.equal(clicks, 1, 'aria-disabled explains state without suppressing the click')

    await render(h(kit.Button, { loading: true }, 'Save'))
    const loading = document.querySelector('button[aria-busy="true"]')
    assert.equal(loading.disabled, true)
    assert.ok(loading.querySelector('.kit-button__spinner'))
  })

  it('renders the requested card, panel, tab-list, and panel-body elements', async () => {
    const tabRef = createRef()
    const listRef = createRef()
    const { container } = await render(
      h(
        'main',
        null,
        h(kit.Card, { as: 'li', className: 'app-card', value: 2 }, 'Card'),
        h(kit.Card, { 'data-default-card': 'true' }, 'Default card'),
        h(
          kit.Panel,
          { as: 'div', className: 'app-panel', 'aria-label': 'Tools' },
          h('h2', null, 'Tools'),
          h(kit.PanelBody, { className: 'app-body' }, 'Body'),
        ),
        h(
          kit.Panel,
          { 'data-default-panel': 'true' },
          h('h2', null, 'Default panel'),
        ),
        h(
          kit.TabList,
          { as: 'nav', ref: listRef, 'aria-label': 'Modes' },
          h(kit.Tab, { ref: tabRef, selected: true, className: 'app-tab' }, 'Chat'),
        ),
        h(
          kit.TabList,
          { 'data-default-tabs': 'true' },
          h(kit.Tab, { selected: false }, 'Search'),
        ),
      ),
    )

    assert.match(container.querySelector('li').className, /card app-card/)
    assert.equal(container.querySelector('li').value, 2)
    assert.match(container.querySelector('div[aria-label="Tools"]').className, /panel app-panel/)
    assert.match(container.querySelector('.panel-body').className, /app-body/)
    assert.equal(listRef.current.tagName, 'NAV')
    assert.equal(listRef.current.getAttribute('role'), 'tablist')
    assert.equal(tabRef.current.getAttribute('role'), 'tab')
    assert.equal(tabRef.current.getAttribute('aria-selected'), 'true')
    assert.match(tabRef.current.className, /tab is-on app-tab/)
    assert.equal(container.querySelector('[data-default-card]').tagName, 'DIV')
    assert.equal(container.querySelector('[data-default-panel]').tagName, 'SECTION')
    assert.equal(container.querySelector('[data-default-tabs]').tagName, 'DIV')
    assert.equal(container.querySelector('[data-default-tabs]').getAttribute('role'), 'tablist')
  })

  it('renders status and setting contracts, including an explicit empty center slot', async () => {
    const Icon = (props) => h('svg', { ...props, 'data-icon': 'test' })
    const { container } = await render(
      h(
        kit.SettingGroup,
        { heading: 'Connection', note: 'Used for every request.' },
        h(
          kit.SettingRow,
          {
            icon: Icon,
            title: 'Endpoint',
            description: 'Where requests are sent.',
            stacked: true,
            center: h('span', { 'data-center': 'trace' }, 'Trace ready'),
          },
          h('input', { 'aria-label': 'URL' }),
        ),
        h(
          kit.SettingRow,
          {
            icon: Icon,
            title: 'Empty Center',
            description: 'Preserves an explicitly empty slot.',
            center: null,
          },
          h('button', null, 'Reset'),
        ),
        h(kit.StatusPill, { tone: 'caution', word: 'Pending', 'data-state': 'pending' }),
      ),
    )

    const group = container.querySelector('section')
    const [row, emptyCenterRow] = container.querySelectorAll('.setting-row')
    assert.equal(group.getAttribute('aria-label'), 'Connection')
    assert.equal(row.dataset.stacked, 'true')
    assert.equal(row.dataset.hasCenter, 'true')
    assert.equal(row.querySelector('.setting-row__title').textContent, 'Endpoint')
    assert.equal(
      row.querySelector('.setting-row__description').textContent,
      'Where requests are sent.',
    )
    assert.equal(row.querySelector('.setting-row__control input').getAttribute('aria-label'), 'URL')
    assert.equal(row.querySelector('.setting-row__center [data-center]').textContent, 'Trace ready')
    assert.equal(row.querySelector('svg').getAttribute('aria-hidden'), 'true')
    assert.equal(emptyCenterRow.dataset.hasCenter, 'true')
    assert.ok(emptyCenterRow.querySelector('.setting-row__center'))
    assert.equal(emptyCenterRow.querySelector('.setting-row__center').textContent, '')
    assert.match(container.querySelector('.pill').className, /pill caution/)
    assert.equal(container.querySelector('.pill .dot').getAttribute('aria-hidden'), 'true')
  })
})

describe('receipts', () => {
  it('formats present counts through the kit duration formatter', () => {
    assert.equal(
      kit.formatReceiptLine({ sources: 1, actions: 2, updates: 0, durationMs: 1234 }),
      '1 source · 2 actions · 0 updates · 1.2 s',
    )
    assert.equal(kit.formatReceiptLine({ updates: 3 }), '3 updates')
    assert.equal(kit.formatReceiptLine({}), '')
  })

  it('supports uncontrolled disclosure', async () => {
    const { container } = await render(
      h(kit.ReceiptStrip, { sources: 1, expandable: true }, h('p', null, 'Source detail')),
    )
    const toggle = container.querySelector('button')
    assert.equal(toggle.getAttribute('aria-expanded'), 'false')
    assert.equal(container.textContent.includes('Source detail'), false)
    await act(async () => toggle.click())
    assert.equal(toggle.getAttribute('aria-expanded'), 'true')
    assert.match(container.textContent, /Source detail/)
  })

  it('keeps controlled receipt expansion independent per message', async () => {
    function Harness() {
      const [expanded, setExpanded] = useState([false, false])
      return h(
        'div',
        null,
        [0, 1].map((index) =>
          h(
            kit.ReceiptStrip,
            {
              key: index,
              updates: index + 1,
              expandable: true,
              expanded: expanded[index],
              toggleLabel: `Message ${index + 1} receipt`,
              onExpandedChange: (next) =>
                setExpanded((current) =>
                  current.map((value, position) => (position === index ? next : value)),
                ),
            },
            h('p', null, `Detail ${index + 1}`),
          ),
        ),
      )
    }

    const { container } = await render(h(Harness))
    const toggles = container.querySelectorAll('button')
    await act(async () => toggles[0].click())
    assert.equal(toggles[0].getAttribute('aria-expanded'), 'true')
    assert.equal(toggles[1].getAttribute('aria-expanded'), 'false')
    assert.match(container.textContent, /Detail 1/)
    assert.doesNotMatch(container.textContent, /Detail 2/)
  })
})

describe('focus helpers', () => {
  function Harness({ active }) {
    const ref = kit.useFocusTrap(active)
    return h(
      'div',
      null,
      h('button', { id: 'opener' }, 'Open'),
      h(
        'div',
        { ref, onKeyDown: (event) => event.stopPropagation() },
        h('button', { id: 'first' }, 'First'),
        h('button', { id: 'last' }, 'Last'),
      ),
    )
  }

  it('focuses, wraps both directions despite stopPropagation, and restores focus', async () => {
    const { container, rerender } = await render(h(Harness, { active: false }))
    const opener = container.querySelector('#opener')
    opener.focus()
    await rerender(h(Harness, { active: true }))
    await act(async () => new Promise((resolve) => requestAnimationFrame(resolve)))

    const first = container.querySelector('#first')
    const last = container.querySelector('#last')
    assert.equal(document.activeElement, first)
    assert.deepEqual(kit.getTabbable(first.parentElement), [first, last])

    last.focus()
    last.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }))
    assert.equal(document.activeElement, first)

    first.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true }),
    )
    assert.equal(document.activeElement, last)

    await rerender(h(Harness, { active: false }))
    assert.equal(document.activeElement, opener)
  })
})
