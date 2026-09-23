/**
 * The living graph behind the window: sparse nodes drift, edges appear between
 * neighbours as they pass and fade as they part, and fragments of what the
 * surface actually does rise slowly through it. The product's own metaphor,
 * running quietly behind the product.
 *
 * Canvas because per-frame edge geometry is not a CSS job — which is why this is
 * the one piece of JavaScript in a package that is otherwise pure CSS. The class
 * that positions it (`.embabel-backdrop`, in ground.css) has always lived here;
 * this is the other half of the same thing, and keeping them apart is how the
 * two front ends ended up drawing the same picture at different brightnesses.
 *
 * Deliberately restrained: low alpha, no interaction, `pointer-events: none`,
 * and under `prefers-reduced-motion` it paints ONE still frame — the
 * constellation without the drift, because the picture is doing work of its own
 * and removing it entirely would take that with it.
 */

/** A colour as [r, g, b]. A tuple, not `number[]`: the members are then known to exist. */
export type Rgb = readonly [number, number, number]

/** A node in the drifting graph. */
interface Node {
  x: number
  y: number
  vx: number
  vy: number
  r: number
  /** Hubs render brighter and carry a halo, like an entity everything references. */
  hub: boolean
  /** A colour from the palette: the graph is a network of KINDS of thing. */
  c: Rgb
  /**
   * How far back it sits, 0 near to 1 deep. Always assigned; it only SHOWS when
   * [BackdropOptions.depth] is on, and reads as 0 for every node when it is off, so the flat
   * picture is bit-for-bit what it always was rather than a special case threaded through the
   * draw code.
   */
  z: number
}

/** A fragment of code or query drifting up through the graph. */
interface Snippet {
  text: string
  x: number
  y: number
  vx: number
  vy: number
  /** Drives the breathing. */
  phase: number
}

export interface BackdropOptions {
  /**
   * The lines that drift through. Each surface passes its OWN: the console shows
   * code-mode calls it can really execute, the Me app shows the sensor readings
   * it really takes. Lorem would make the backdrop decoration; real lines make it
   * the product talking to itself, so there is no default here worth shipping.
   */
  snippets: string[]
  /**
   * How loud the whole picture is. 1 is the reference weight — the console's,
   * where the backdrop is most of what a mostly-empty control room shows. A
   * single-user panel with dense cards in front of it wants less; Me runs at
   * about half.
   *
   * One multiplier rather than a set of alphas, because the alphas below encode
   * the RELATIONSHIPS — a hub brighter than a node, an edge fainter than both, a
   * snippet fainter still — and hand-tuning each per surface is exactly how they
   * drifted apart before. This scales the volume and leaves the shape alone.
   */
  brightness?: number
  /** How many fragments drift at once, on a wide window and a narrow one. */
  snippetCount?: { wide: number; narrow: number }
  /**
   * How fast the field drifts, against the pace this picks. 1 is that pace.
   *
   * Depth already slows the far nodes by up to three quarters, which is what makes the distance
   * read — and on a surface where the graph is scenery the whole field can end up crawling. This
   * scales the whole field without touching the falloff, so near and far keep their relationship
   * to each other.
   */
  pace?: number
  /**
   * More nodes, or fewer, against the count this picks from the window's area. 1 is that count.
   *
   * Density and volume pull in opposite directions and both are wanted: a field that is dense AND
   * loud is a wall, and one that is sparse and quiet is empty. Behind onboarding the graph wants
   * to read as a deep field of many faint things, so it asks for roughly twice the nodes at half
   * the [brightness].
   */
  density?: number
  /**
   * Put the graph in SPACE rather than on glass: nodes take a distance, and the far ones drift
   * slower, sit smaller, fade into the haze and go out of focus.
   *
   * OFF BY DEFAULT, and that is the point. Over a flat ground the graph IS the picture and every
   * node should be legible; over something with its own depth — a starfield behind the setup
   * wizard — a perfectly sharp node at every distance is what makes the two look like two pictures
   * stacked rather than one scene. So the surface that has a deep background asks for this, and
   * nothing else changes.
   */
  depth?: boolean | DepthOptions
}

/** How much depth, when [BackdropOptions.depth] is on. */
export interface DepthOptions {
  /**
   * Blur in px at the back. Default 3.6 — enough that the far band reads as out of focus at a
   * glance, low enough that it still reads as a graph rather than a smudge.
   */
  maxBlur?: number
  /**
   * Blur in px at the FRONT. Default 0: the nearest band is in focus, which is what a scene
   * where the graph is the subject wants.
   *
   * Raise it where the graph is scenery and something else is the subject — a logo and a
   * question on a card, say. A field where nothing is perfectly sharp sits behind whatever is,
   * and the eye stops trying to read it as content.
   */
  minBlur?: number
  /**
   * How many focal bands. Default 3.
   *
   * Bands, not per-node blur, because blur is applied PER DRAWING OPERATION: 150 individually
   * blurred arcs is 150 filtered compositions a frame, which is where the frame budget goes. Each
   * band is drawn sharp onto a scratch canvas and composited once through the filter, so the cost
   * is one filtered draw per band no matter how many nodes are in it. Three is enough for the eye;
   * more bands buy smoothness nobody sees and pay a full-canvas composite each.
   */
  bands?: number
  /**
   * What distance fades TOWARD — the haze. Default is the deep indigo the Embabel grounds use.
   * Set it to the dominant colour of whatever sits behind, or the far nodes will look tinted
   * rather than distant.
   */
  fog?: Rgb
}

/* Indigo, violet, green, ice. Indigo twice: an Embabel surface, not a rainbow. Named
   rather than inlined so INDIGO can also stand as the fallback below, which is what
   keeps the random pick total without a non-null assertion. */
const INDIGO: Rgb = [98, 95, 255]
const VIOLET: Rgb = [167, 120, 255]
const GREEN: Rgb = [62, 207, 142]
const ICE: Rgb = [199, 210, 255]
const PALETTE: readonly Rgb[] = [INDIGO, INDIGO, VIOLET, GREEN, ICE]

/** A palette colour at random. */
const someColour = (): Rgb => PALETTE[(Math.random() * PALETTE.length) | 0] ?? INDIGO

/** px at which two nodes acknowledge each other. */
const LINK = 240

/** The haze colour when the caller names none: the indigo the Embabel grounds are built on. */
const FOG: Rgb = [16, 20, 48]

/** Toward [FOG] by [amount]: 0 leaves the colour alone, 1 is pure haze. */
const hazed = (c: Rgb, fog: Rgb, amount: number): Rgb => [
  Math.round(c[0] + (fog[0] - c[0]) * amount),
  Math.round(c[1] + (fog[1] - c[1]) * amount),
  Math.round(c[2] + (fog[2] - c[2]) * amount),
]

/**
 * Start the backdrop on [canvas]. Returns a stop function that cancels the frame
 * loop and drops the resize listener — call it when the surface goes away, which
 * for a component means its teardown and for a page means never.
 */
export function startBackdrop(canvas: HTMLCanvasElement, options: BackdropOptions): () => void {
  const ctx = canvas.getContext('2d')
  if (!ctx) return () => {}

  const snippets = options.snippets.filter((line) => line.trim().length > 0)
  /** The nth line, wrapping. Empty when the caller passed nothing worth drifting. */
  const line = (n: number): string =>
    snippets.length === 0 ? '' : snippets[((n % snippets.length) + snippets.length) % snippets.length] ?? ''
  const brightness = options.brightness ?? 1
  const counts = options.snippetCount ?? { wide: 7, narrow: 4 }
  const density = options.density ?? 1
  const pace = options.pace ?? 1

  const depth = options.depth === true ? {} : options.depth || null
  const bands = Math.max(1, depth?.bands ?? 3)
  const maxBlur = depth?.maxBlur ?? 3.6
  const minBlur = depth?.minBlur ?? 0
  const fog = depth?.fog ?? FOG
  /*
   * Blur needs `ctx.filter`, which not every browser that runs everything else here has. Without
   * it the far nodes simply stay sharp: distance is still carried by size, pace and haze, which is
   * most of the effect. A depth that silently did nothing at all — or worse, threw — would be a
   * backdrop that vanishes on one browser.
   */
  const canBlur = depth !== null && 'filter' in ctx

  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches
  let raf = 0
  let nodes: Node[] = []
  let snips: Snippet[] = []
  /** The scratch canvas a blurred band is drawn on before it is composited. Never shown. */
  let scratch: HTMLCanvasElement | null = null
  let scratchCtx: CanvasRenderingContext2D | null = null

  const size = () => {
    const dpr = Math.min(devicePixelRatio, 2)
    canvas.width = innerWidth * dpr
    canvas.height = innerHeight * dpr
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    // Node count scales with area so a laptop and a monitor feel the same.
    const target = Math.round(((innerWidth * innerHeight) / 14000) * density)
    // Sparse on purpose: these are glimpses, not a wall of code.
    snips = Array.from({ length: innerWidth > 1100 ? counts.wide : counts.narrow }, (_, i) => ({
      text: line(i + Math.floor(Math.random() * snippets.length)),
      x: Math.random() * innerWidth,
      y: Math.random() * innerHeight,
      vx: (Math.random() - 0.5) * 0.1,
      vy: -0.05 - Math.random() * 0.07,
      phase: Math.random() * Math.PI * 2,
    }))
    nodes = Array.from({ length: Math.min(Math.max(target, 40), Math.round(150 * density)) }, () => {
      // Flat unless depth is on, so every node is at the front and the arithmetic below is a no-op.
      const z = depth ? Math.random() : 0
      // Parallax, and it is what sells the distance more than the blur does: the far ones
      // barely move. Squared, so the near half keeps most of its pace and the falloff is felt
      // at the back rather than spread evenly across the field.
      const drift = (1 - 0.75 * z * z) * pace
      return {
        x: Math.random() * innerWidth,
        y: Math.random() * innerHeight,
        vx: (Math.random() - 0.5) * 0.22 * drift,
        vy: (Math.random() - 0.5) * 0.22 * drift,
        r: (1.1 + Math.random() * 2.2) * (1 - 0.45 * z),
        hub: Math.random() < 0.16,
        c: someColour(),
        z,
      }
    })

    if (canBlur) {
      scratch = scratch ?? document.createElement('canvas')
      scratch.width = canvas.width
      scratch.height = canvas.height
      scratchCtx = scratch.getContext('2d')
      scratchCtx?.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
  }

  /** Which focal band a distance falls in: 0 is the front, [bands] - 1 the back. */
  const bandOf = (z: number): number => Math.min(bands - 1, Math.floor(z * bands))

  /** The blur a band is composited through: [minBlur] at the front, [maxBlur] at the back. */
  const blurOf = (band: number): number =>
    bands < 2 ? minBlur : minBlur + (band / (bands - 1)) * (maxBlur - minBlur)

  /**
   * The edges of one frame, pooled.
   *
   * Which band an edge belongs to depends on where its endpoints are THIS frame, so the pairs
   * cannot be worked out once at startup — but they also must not be worked out once per band,
   * which would triple the only O(n²) loop in the file. They are collected once into objects that
   * are reused every frame, so a backdrop that runs for hours allocates nothing per frame.
   */
  const edges: { a: Node; b: Node; strength: number; band: number }[] = []
  let edgeCount = 0

  const collectEdges = () => {
    edgeCount = 0
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i]
        const b = nodes[j]
        // Both indices are in range by construction; the guard is for the type
        // checker, which cannot know that, and costs a comparison per pair.
        if (!a || !b) continue
        const dx = a.x - b.x
        const dy = a.y - b.y
        const d = Math.hypot(dx, dy)
        if (d > LINK) continue
        // The DEEPER end decides: an edge from the front to the back is part of the back, so a
        // sharp line never runs out of a blurred node and betrays the whole trick.
        const band = bandOf(Math.max(a.z, b.z))
        const slot = edges[edgeCount]
        if (slot) {
          slot.a = a
          slot.b = b
          slot.strength = (1 - d / LINK) ** 2
          slot.band = band
        } else {
          edges[edgeCount] = { a, b, strength: (1 - d / LINK) ** 2, band }
        }
        edgeCount++
      }
    }
  }

  /** Everything at one distance, drawn sharp. The blur, if any, happens to the whole band after. */
  const drawBand = (target: CanvasRenderingContext2D, band: number) => {
    target.globalAlpha = brightness

    for (let i = 0; i < edgeCount; i++) {
      const e = edges[i]
      if (!e || e.band !== band) continue
      const { a, b } = e
      // Haze by the deeper end, for the same reason the band is: one line, one distance.
      const far = Math.max(a.z, b.z)
      const c = hazed(
        [
          Math.round((a.c[0] + b.c[0]) / 2),
          Math.round((a.c[1] + b.c[1]) / 2),
          Math.round((a.c[2] + b.c[2]) / 2),
        ],
        fog,
        far * 0.55,
      )
      target.strokeStyle = `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${0.75 * e.strength * (1 - 0.38 * far)})`
      target.lineWidth = 1
      target.beginPath()
      target.moveTo(a.x, a.y)
      target.lineTo(b.x, b.y)
      target.stroke()
    }

    for (const n of nodes) {
      if (bandOf(n.z) !== band) continue
      const c = hazed(n.c, fog, n.z * 0.55)
      /*
       * A BLURRED DOT IS A DIMMER DOT, because blur spreads the same ink over a wider area — so a
       * field tuned down for the background and then blurred is a field that disappears. Under
       * depth every node carries the glow a hub carries, and a little more body, which is what
       * keeps it visible as something LUMINOUS rather than as something faint. It is also the
       * look: a spectral field of soft lights rather than a diagram of dots.
       */
      if (depth) {
        target.beginPath()
        target.arc(n.x, n.y, n.r * 4.2, 0, Math.PI * 2)
        target.fillStyle = `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${0.1 * (1 - 0.3 * n.z)})`
        target.fill()
      }
      target.beginPath()
      target.arc(n.x, n.y, (n.hub ? n.r * 1.9 : n.r) * (depth ? 1.5 : 1), 0, Math.PI * 2)
      target.fillStyle = `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${(n.hub ? 1 : 0.8) * (1 - 0.32 * n.z)})`
      target.fill()
      if (n.hub) {
        target.beginPath()
        target.arc(n.x, n.y, n.r * 5.5, 0, Math.PI * 2)
        target.fillStyle = `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${0.22 * (1 - 0.32 * n.z)})`
        target.fill()
      }
    }
  }

  const frame = () => {
    const w = innerWidth
    const h = innerHeight
    ctx.clearRect(0, 0, w, h)
    // Applied once, multiplying through every alpha below. See [BackdropOptions.brightness].
    ctx.globalAlpha = brightness

    for (const n of nodes) {
      n.x += n.vx
      n.y += n.vy
      if (n.x < -20) n.x = w + 20
      if (n.x > w + 20) n.x = -20
      if (n.y < -20) n.y = h + 20
      if (n.y > h + 20) n.y = -20
    }

    collectEdges()

    // BACK TO FRONT, so a near node overlaps a far one rather than the other way round — the
    // one ordering rule a scene with depth cannot get wrong.
    for (let band = bands - 1; band >= 0; band--) {
      const blur = canBlur ? blurOf(band) : 0
      if (blur > 0 && scratchCtx && scratch) {
        scratchCtx.clearRect(0, 0, w, h)
        drawBand(scratchCtx, band)
        ctx.filter = `blur(${blur.toFixed(2)}px)`
        // Alpha is already in the band's own pixels; compositing at 1 avoids applying it twice.
        ctx.globalAlpha = 1
        ctx.drawImage(scratch, 0, 0, w, h)
        ctx.filter = 'none'
        ctx.globalAlpha = brightness
      } else {
        drawBand(ctx, band)
      }
    }

    // Fragments drift up through the graph, breathing in and out.
    ctx.font = '12px ui-monospace, SFMono-Regular, Menlo, monospace'
    for (const sn of snips) {
      sn.x += sn.vx
      sn.y += sn.vy
      sn.phase += 0.0035
      if (sn.y < -30) {
        sn.y = h + 30
        sn.x = Math.random() * w
        sn.text = line((Math.random() * snippets.length) | 0)
      }
      if (sn.x < -320) sn.x = w + 20
      if (sn.x > w + 320) sn.x = -20
      const a = 0.16 + 0.14 * Math.sin(sn.phase)
      ctx.fillStyle = `rgba(167, 176, 255, ${Math.max(a, 0)})`
      ctx.fillText(sn.text, sn.x, sn.y)
    }

    // The reduced-motion check belongs HERE, not only at the call below. Both
    // originals said "one static frame" and then called a frame() that ended by
    // scheduling the next one — so anyone who had asked for less motion got the
    // full drift anyway. The promise was in the comment and nowhere else.
    if (!reduced) raf = requestAnimationFrame(frame)
  }

  size()
  addEventListener('resize', size)
  if (reduced) frame() // one static frame — the constellation, not the drift
  else raf = requestAnimationFrame(frame)

  return () => {
    cancelAnimationFrame(raf)
    removeEventListener('resize', size)
  }
}
