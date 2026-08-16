export interface TooltipAnchor {
    left: number;
    right: number;
    top: number;
    bottom: number;
}
export interface DefinitionTooltip {
    /** Show [text] under a [name] title beside [target] — an element or a rect. */
    show(target: Element | TooltipAnchor, name: string, text: string): void;
    hide(): void;
}
/** A label-ish thing with provenance: enough to title a definition. */
export interface DescribedLabel {
    label: string;
    realm?: string;
}
/** The tooltip's title line: the label, and where it comes from — realm or core. */
export declare function definitionTitle(label: DescribedLabel): string;
/**
 * Create (or reuse) the page's tooltip element and return its controls. A
 * wheel-scroll under a resting cursor moves content without a mouseleave, so
 * any scroll hides it — it must never float over a thing it no longer
 * describes.
 */
export declare function createDefinitionTooltip(doc: Document, id?: string): DefinitionTooltip;
//# sourceMappingURL=tooltip.d.ts.map