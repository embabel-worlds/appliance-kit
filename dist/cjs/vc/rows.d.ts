export declare const INTERNAL_PROPERTIES: ReadonlySet<string>;
export declare const LABEL_INTERNAL_PROPERTIES: Readonly<Record<string, ReadonlySet<string>>>;
/**
 * Whether [key] is bookkeeping rather than an entity's data, on an entity carrying [labels]. See
 * INTERNAL_PROPERTIES and LABEL_INTERNAL_PROPERTIES; with no labels only the global rule applies.
 */
export declare function isInternalProperty(key: string, labels?: readonly string[]): boolean;
/** A node or relationship as the studio returns it: it carries an element id or labels. */
export declare function isEntity(value: unknown): value is Record<string, unknown>;
/** An entity's own properties, without the bookkeeping. */
export declare function entityProperties(value: Record<string, unknown>): Record<string, unknown>;
/**
 * A value as the table shows it: every entity in it — a cell, a list, a path, a map holding one —
 * reduced to its own properties. Anything else is returned as it came.
 */
export declare function shownValue(value: unknown): unknown;
export declare function rowColumns(rows: Array<Record<string, unknown>>): string[];
/**
 * A GitHub-flavoured Markdown table. Pipes are escaped; newlines flatten to a
 * space — a Markdown cell has no way to hold one, and a broken row is worse
 * than a joined line.
 */
export declare function rowsToMarkdown(rows: Array<Record<string, unknown>>): string;
/** RFC 4180-shaped CSV: a field holding comma, quote or newline is quoted, quotes double. */
export declare function rowsToCsv(rows: Array<Record<string, unknown>>): string;
export interface RowGraphNode {
    id: string;
    labels: string[];
    /** What to write on it: a name-like property when it has one, else its first label. */
    caption: string;
    /** Its properties, without the bookkeeping (INTERNAL_PROPERTIES, LABEL_INTERNAL_PROPERTIES). */
    properties: Record<string, unknown>;
    /** Only named as a relationship's end; the rows did not return it. */
    placeholder: boolean;
}
export interface RowGraphEdge {
    id: string;
    type: string;
    source: string;
    target: string;
    properties: Record<string, unknown>;
}
export interface RowGraph {
    nodes: RowGraphNode[];
    edges: RowGraphEdge[];
}
export declare function rowGraph(rows: Array<Record<string, unknown>>): RowGraph;
//# sourceMappingURL=rows.d.ts.map