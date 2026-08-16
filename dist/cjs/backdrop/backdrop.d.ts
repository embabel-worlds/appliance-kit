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
}
/**
 * Start the backdrop on [canvas]. Returns a stop function that cancels the frame
 * loop and drops the resize listener — call it when the surface goes away, which
 * for a component means its teardown and for a page means never.
 */
export declare function startBackdrop(canvas: HTMLCanvasElement, options: BackdropOptions): () => void;
//# sourceMappingURL=backdrop.d.ts.map