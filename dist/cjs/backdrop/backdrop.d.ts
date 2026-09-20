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
export type Rgb = readonly [number, number, number];
export interface BackdropOptions {
    /**
     * The lines that drift through. Each surface passes its OWN: the console shows
     * code-mode calls it can really execute, the Me app shows the sensor readings
     * it really takes. Lorem would make the backdrop decoration; real lines make it
     * the product talking to itself, so there is no default here worth shipping.
     */
    snippets: string[];
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
    brightness?: number;
    /** How many fragments drift at once, on a wide window and a narrow one. */
    snippetCount?: {
        wide: number;
        narrow: number;
    };
    /**
     * How fast the field drifts, against the pace this picks. 1 is that pace.
     *
     * Depth already slows the far nodes by up to three quarters, which is what makes the distance
     * read — and on a surface where the graph is scenery the whole field can end up crawling. This
     * scales the whole field without touching the falloff, so near and far keep their relationship
     * to each other.
     */
    pace?: number;
    /**
     * More nodes, or fewer, against the count this picks from the window's area. 1 is that count.
     *
     * Density and volume pull in opposite directions and both are wanted: a field that is dense AND
     * loud is a wall, and one that is sparse and quiet is empty. Behind onboarding the graph wants
     * to read as a deep field of many faint things, so it asks for roughly twice the nodes at half
     * the [brightness].
     */
    density?: number;
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
    depth?: boolean | DepthOptions;
}
/** How much depth, when [BackdropOptions.depth] is on. */
export interface DepthOptions {
    /**
     * Blur in px at the back. Default 3.6 — enough that the far band reads as out of focus at a
     * glance, low enough that it still reads as a graph rather than a smudge.
     */
    maxBlur?: number;
    /**
     * Blur in px at the FRONT. Default 0: the nearest band is in focus, which is what a scene
     * where the graph is the subject wants.
     *
     * Raise it where the graph is scenery and something else is the subject — a logo and a
     * question on a card, say. A field where nothing is perfectly sharp sits behind whatever is,
     * and the eye stops trying to read it as content.
     */
    minBlur?: number;
    /**
     * How many focal bands. Default 3.
     *
     * Bands, not per-node blur, because blur is applied PER DRAWING OPERATION: 150 individually
     * blurred arcs is 150 filtered compositions a frame, which is where the frame budget goes. Each
     * band is drawn sharp onto a scratch canvas and composited once through the filter, so the cost
     * is one filtered draw per band no matter how many nodes are in it. Three is enough for the eye;
     * more bands buy smoothness nobody sees and pay a full-canvas composite each.
     */
    bands?: number;
    /**
     * What distance fades TOWARD — the haze. Default is the deep indigo the Embabel grounds use.
     * Set it to the dominant colour of whatever sits behind, or the far nodes will look tinted
     * rather than distant.
     */
    fog?: Rgb;
}
/**
 * Start the backdrop on [canvas]. Returns a stop function that cancels the frame
 * loop and drops the resize listener — call it when the surface goes away, which
 * for a component means its teardown and for a page means never.
 */
export declare function startBackdrop(canvas: HTMLCanvasElement, options: BackdropOptions): () => void;
//# sourceMappingURL=backdrop.d.ts.map