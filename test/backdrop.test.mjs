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
  const calls = { fills: [], strokes: [], images: 0, filters: [], drawn: [], from: [], cleared: [], transforms: [] }
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
    setTransform(...m) { calls.transforms.push(m) },
    clearRect(...r) { calls.cleared.push(r) },
    beginPath() {},
    arc() {},
    fill() { calls.fills.push(this.fillStyle) },
    moveTo() {},
    lineTo() {},
    stroke() { calls.strokes.push(this.strokeStyle) },
    fillText() {},
    drawImage(...args) { calls.images++; calls.from.push(args[0]); calls.drawn.push(args.slice(1)) },
  }
}

function fakeCanvas(ctx) {
  return { width: 0, height: 0, getContext: () => ctx }
}

/** Run one frame with the browser globals the backdrop reaches for. */
function runFrame(options, screen = { width: 1200, height: 800 }, { resize = false } = {}) {
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
  globalThis.innerWidth = screen.width
  globalThis.innerHeight = screen.height
  globalThis.devicePixelRatio = 2
  // Reduced motion: ONE frame, drawn synchronously, which is exactly what a test wants.
  globalThis.matchMedia = () => ({ matches: true })
  globalThis.requestAnimationFrame = () => 0
  globalThis.cancelAnimationFrame = () => {}
  const listeners = new Map()
  globalThis.addEventListener = (type, listener) => listeners.set(type, listener)
  globalThis.removeEventListener = (type, listener) => {
    if (listeners.get(type) === listener) listeners.delete(type)
  }
  globalThis.document = {
    createElement: () => {
      const c = fakeCanvas(fakeContext())
      scratches.push(c)
      return c
    },
  }
  try {
    const stop = startBackdrop(canvas, options)
    const before = ctx.calls.fills.length
    if (resize) listeners.get('resize')?.()
    const afterResize = ctx.calls.fills.length - before
    stop()
    return { ctx, scratches, afterResize, listening: listeners.size }
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

/** The filters set on the small canvas each blurred band is blurred on. */
const softFilters = (scratches) => scratches[1].getContext().calls.filters

test('with depth on, the far bands are blurred small and composited without a filter', () => {
  const { ctx, scratches } = runFrame({ snippets: ['gateway.world.status({})'], depth: true })

  assert.equal(scratches.length, 2, 'a sharp scratch and its blurred copy, reused by every band')
  assert.equal(scratches[0].width, 600, 'drawn at half the CSS size: a blurred band has no detail to lose')
  assert.equal(scratches[1].height, 400)
  assert.ok(ctx.calls.images >= 1, 'each blurred band is drawn as one image, not per node')
  assert.ok(ctx.calls.from.every((c) => c === scratches[1]), 'what is composited is the blurred copy, not the sharp one')
  assert.deepEqual(ctx.calls.filters, [], 'the visible canvas is never filtered: at full size that is the cost')
  const blurs = softFilters(scratches).filter((f) => f.startsWith('blur('))
  assert.ok(blurs.length >= 1, `expected a blur filter, got ${JSON.stringify(softFilters(scratches))}`)
  assert.equal(softFilters(scratches).at(-1), 'none', 'and it is always put back')
})

test('the deepest band carries the blur the caller asked for, in the small canvas\'s pixels', () => {
  const { scratches } = runFrame({ snippets: ['x'], depth: { maxBlur: 8, bands: 3 } })

  // Half-size pixels, so half the radius: 8 CSS px once it is scaled back up.
  assert.ok(softFilters(scratches).includes('blur(4.00px)'), 'the back band is the full amount')
  assert.ok(softFilters(scratches).includes('blur(2.00px)'), 'the middle band is half way there')
})

test('on an odd size the small canvas is cleared whole and scaled back to where it was drawn', () => {
  const { ctx, scratches } = runFrame({ snippets: ['x'], depth: true }, { width: 1201, height: 801 })
  const [sharp] = scratches

  assert.equal(sharp.width, 601, 'rounded up, so the last CSS pixel has somewhere to land')
  assert.deepEqual(sharp.getContext().calls.transforms.at(-1), [0.5, 0, 0, 0.5, 0, 0])
  for (const r of sharp.getContext().calls.cleared) {
    assert.deepEqual(r, [0, 0, 1202, 802], 'all of it, not w × h, or the last column keeps a ghost')
  }
  assert.ok(ctx.calls.drawn.length >= 1)
  for (const d of ctx.calls.drawn) assert.deepEqual(d, [0, 0, 1202, 802], 'the same scale back up')
})

test('one band is a flat picture again, whatever blur was asked for', () => {
  // bands: 1 means there is no "further back" to be out of focus, and dividing by bands - 1
  // would be a division by zero. It degrades to the flat draw instead.
  const { ctx } = runFrame({ snippets: ['x'], depth: { maxBlur: 8, bands: 1 } })

  assert.deepEqual(ctx.calls.filters, [])
  assert.equal(ctx.calls.images, 0)
})

test('under reduced motion a resize paints the still frame again', () => {
  // Setting the canvas's size clears it, and with no frame loop nothing else would repaint it.
  const { afterResize, listening } = runFrame({ snippets: ['x'] }, undefined, { resize: true })

  assert.ok(afterResize > 0, 'the graph is drawn again after the resize')
  assert.equal(listening, 0, 'and stop() takes the resize listener away')
})
