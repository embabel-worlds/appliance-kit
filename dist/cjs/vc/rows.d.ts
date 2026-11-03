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
    /** Its properties, without the `__` keys that describe the entity rather than hold its data. */
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