/*
 * The backdrop, without a browser.
 *
 * Canvas drawing is not usually worth a unit test, but ONE promise here is: depth is off by
 * default, and with it off the picture must be exactly the flat one two front ends already ship.
 * That is a promise about what is NOT done — no filter, no second canvas, no haze — and a
 * regression would look like nothing at all until somebody noticed the Me app had gone soft.
 *
 * So this records the calls a frame makes against a fake context, and asserts the shape of them.
 */
import assert from 'node:assert/strict'
import test from 'node:test'

import { startBackdrop } from '../dist/esm/backdrop/backdrop.js'

/** A canvas context that remembers what it was asked to do. */
function fakeContext() {
  const calls = { fills: [], strokes: [], images: 0, filters: [] }
  let filter = 'none'
  return {
    calls,
    get filter() { return filter },
    set filter(v) { filter = v; calls.filters.push(v) },
    globalAlpha: 1,
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    font: '',
    setTransform() {},
    clearRect() {},
    beginPath() {},
    arc() {},
    fill() { calls.fills.push(this.fillStyle) },
    moveTo() {},
    lineTo() {},
    stroke() { calls.strokes.push(this.strokeStyle) },
    fillText() {},
    drawImage() { calls.images++ },
  }
}

function fakeCanvas(ctx) {
  return { width: 0, height: 0, getContext: () => ctx }
}

/** Run one frame with the browser globals the backdrop reaches for. */
function runFrame(options) {
  const ctx = fakeContext()
  const canvas = fakeCanvas(ctx)
  const scratches = []
  const previous = {
    innerWidth: globalThis.innerWidth,
    innerHeight: globalThis.innerHeight,
    devicePixelRatio: globalThis.devicePixelRatio,
    matchMedia: globalThis.matchMedia,
    requestAnimationFrame: globalThis.requestAnimationFrame,
    cancelAnimationFrame: globalThis.cancelAnimationFrame,
    document: globalThis.document,
    addEventListener: globalThis.addEventListener,
    removeEventListener: globalThis.removeEventListener,
  }
  globalThis.innerWidth = 1200
  globalThis.innerHeight = 800
  globalThis.devicePixelRatio = 2
  // Reduced motion: ONE frame, drawn synchronously, which is exactly what a test wants.
  globalThis.matchMedia = () => ({ matches: true })
  globalThis.requestAnimationFrame = () => 0
  globalThis.cancelAnimationFrame = () => {}
  globalThis.addEventListener = () => {}
  globalThis.removeEventListener = () => {}
  globalThis.document = {
    createElement: () => {
      const c = fakeCanvas(fakeContext())
      scratches.push(c)
      return c
    },
  }
  try {
    const stop = startBackdrop(canvas, options)
    stop()
    return { ctx, scratches }
  } finally {
    Object.assign(globalThis, previous)
  }
}

test('by default nothing is blurred, and no second canvas is made', () => {
  const { ctx, scratches } = runFrame({ snippets: ['gateway.world.status({})'] })

  assert.equal(scratches.length, 0, 'a scratch canvas is depth machinery, and depth is off')
  assert.deepEqual(ctx.calls.filters, [], 'the flat picture never touches ctx.filter')
  assert.equal(ctx.calls.images, 0, 'nothing is composited: the nodes are drawn straight on')
  assert.ok(ctx.calls.fills.length > 0, 'it did draw a frame')
})

test('with depth on, the far bands are composited through a blur', () => {
  const { ctx, scratches } = runFrame({ snippets: ['gateway.world.status({})'], depth: true })

  assert.equal(scratches.length, 1, 'one scratch canvas, reused by every blurred band')
  assert.ok(ctx.calls.images >= 1, 'each blurred band is drawn as one image, not per node')
  const blurs = ctx.calls.filters.filter((f) => f.startsWith('blur('))
  assert.ok(blurs.length >= 1, `expected a blur filter, got ${JSON.stringify(ctx.calls.filters)}`)
  assert.ok(ctx.calls.filters.includes('none'), 'and it is always put back, or the card blurs too')
})

test('the deepest band carries the blur the caller asked for', () => {
  const { ctx } = runFrame({ snippets: ['x'], depth: { maxBlur: 8, bands: 3 } })

  assert.ok(ctx.calls.filters.includes('blur(8.00px)'), 'the back band is the full amount')
  assert.ok(ctx.calls.filters.includes('blur(4.00px)'), 'the middle band is half way there')
})

test('one band is a flat picture again, whatever blur was asked for', () => {
  // bands: 1 means there is no "further back" to be out of focus, and dividing by bands - 1
  // would be a division by zero. It degrades to the flat draw instead.
  const { ctx } = runFrame({ snippets: ['x'], depth: { maxBlur: 8, bands: 1 } })

  assert.deepEqual(ctx.calls.filters, [])
  assert.equal(ctx.calls.images, 0)
})
