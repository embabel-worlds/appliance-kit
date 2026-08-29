import assert from 'node:assert/strict'
import { describe as suite, it } from 'node:test'
import { JSDOM } from 'jsdom'
import { MARKDOWN_SANITIZE, TOUR_SANITIZE, resolveTourImages } from '../src/studio-kit/index.ts'

/*
 * Tours may show a picture; nothing else here may. And the picture may come from ONE place.
 *
 * This is a boundary, not a preference, which is why it has tests rather than a comment. A tour is
 * a file people exchange — a realm ships one, a user exports and imports one — so an `<img>` whose
 * source is a host the tour's author controls is a beacon: it reports that the tour was opened,
 * when, and from which address, silently, before the reader agreed to anything. The rule is that a
 * tour may show an asset the appliance itself serves and nothing else.
 *
 * DOMPurify cannot express it — `ALLOWED_URI_REGEXP` applies to every URI attribute alike, and
 * links legitimately point outward — so enforcement is a pass over the sanitized nodes, and that
 * is what these exercise. A real DOM, because a regex over HTML would be the wrong tool for
 * exactly the inputs nobody thought to write down.
 */

const frag = (html: string) => {
  const el = new JSDOM('<!doctype html><body>').window.document.createElement('div')
  el.innerHTML = html
  return el
}

const srcs = (el: Element) => Array.from(el.querySelectorAll('img')).map((i) => i.getAttribute('src'))

suite('tour images', () => {
  it('keeps an image this appliance serves', () => {
    const el = frag('<img src="/apps/world/tour-claude-code.svg" alt="a">')
    resolveTourImages(el)
    assert.deepEqual(srcs(el), ['/apps/world/tour-claude-code.svg'])
  })

  it('deletes an image on somebody else\'s host', () => {
    // The whole point. A tour that arrived from a realm, or from a colleague, cannot make the
    // reader's browser announce itself to its author.
    const el = frag('<img src="https://evil.example/beacon.png"><img src="http://evil.example/b.gif">')
    resolveTourImages(el)
    assert.deepEqual(srcs(el), [])
  })

  it('deletes a protocol-relative source, which is a remote host wearing a relative path', () => {
    const el = frag('<img src="//evil.example/beacon.png">')
    resolveTourImages(el)
    assert.deepEqual(srcs(el), [])
  })

  it('deletes a bare relative source, because what it resolves against differs per surface', () => {
    const el = frag('<img src="beacon.png"><img src="../../etc/passwd">')
    resolveTourImages(el)
    assert.deepEqual(srcs(el), [])
  })

  it('deletes an inline data image', () => {
    // Not a beacon, but not the appliance's either — and an unbounded blob in a config file is a
    // shape this format has no reason to grow.
    const el = frag('<img src="data:image/svg+xml;base64,PHN2Zy8+">')
    resolveTourImages(el)
    assert.deepEqual(srcs(el), [])
  })

  it('resolves the kept image against the base a surface gives it', () => {
    // The Me app's windows load over `file://`, where a rooted path is the user's disk rather than
    // the appliance. It passes its base URL; the console passes nothing and stays same-origin.
    const el = frag('<img src="/apps/world/x.svg">')
    resolveTourImages(el, 'http://localhost:11043')
    assert.deepEqual(srcs(el), ['http://localhost:11043/apps/world/x.svg'])
  })

  it('does not double the slash when the base carries one', () => {
    const el = frag('<img src="/apps/world/x.svg">')
    resolveTourImages(el, 'http://localhost:11043/')
    assert.deepEqual(srcs(el), ['http://localhost:11043/apps/world/x.svg'])
  })

  it('leaves links alone — only images are confined to this origin', () => {
    const el = frag('<a href="https://embabel.com">docs</a>')
    resolveTourImages(el)
    assert.equal(el.querySelector('a')?.getAttribute('href'), 'https://embabel.com')
  })

  it('keeps images out of the policy every other surface uses', () => {
    // A document answer that could render an image would be a model deciding to put a picture in
    // front of somebody. Widening the shared policy instead of adding one was the tempting move.
    assert.ok(!MARKDOWN_SANITIZE.ALLOWED_TAGS.includes('img'))
    assert.ok(!MARKDOWN_SANITIZE.ALLOWED_ATTR.includes('src'))
    assert.ok(TOUR_SANITIZE.ALLOWED_TAGS.includes('img'))
  })

  it('lets a rooted src past the sanitizer at all', () => {
    // The first version of this failed here and nowhere else: the shared `^https?://` pattern
    // dropped the `src` before the image rule ran, so the appliance's own asset vanished along
    // with the beacons and the tour rendered an empty paragraph.
    assert.ok(TOUR_SANITIZE.ALLOWED_URI_REGEXP.test('/apps/world/x.svg'))
    assert.ok(TOUR_SANITIZE.ALLOWED_URI_REGEXP.test('https://embabel.com'))
    assert.ok(!TOUR_SANITIZE.ALLOWED_URI_REGEXP.test('//evil.example/x.png'))
    assert.ok(!TOUR_SANITIZE.ALLOWED_URI_REGEXP.test('javascript:alert(1)'))
  })
})
