export interface SchemaProperty {
    name: string;
    type: string;
    sparse?: boolean;
    /** The property's declared description, verbatim from the realm's registry — for hover. */
    description?: string;
}
export interface SchemaLabel {
    label: string;
    properties: SchemaProperty[];
    sampleCount?: number;
    exhaustive?: boolean;
    /**
     * Whether this label may OPEN a MATCH pattern bare — the engine's own verdict: a real label, or a
     * virtual population implicitly bound by user tenancy. False means reach-only: legal only by
     * traversal from a bound anchor. Absent on an older appliance, which readers treat as true.
     */
    anchor?: boolean;
    /**
     * The declared definition of the type this label names, verbatim from the realm's own registry —
     * for an editor to show on hover. Absent for core/introspected labels, which declare none.
     */
    description?: string;
    /** The realm that declared this label's type. Absent means core — the world's own or the host's. */
    realm?: string;
}
export interface SchemaRelationship {
    from: string;
    type: string;
    to: string;
    count?: number;
}
export interface GraphSchema {
    refreshedAt?: string;
    labels: SchemaLabel[];
    relationships: SchemaRelationship[];
}
/** alias -> label, parsed from the query's own `(alias:Label` patterns. */
export declare function aliasMap(cypher: string): Record<string, string>;
/** The property names recorded for a label, or none if the schema has not seen it. */
export declare function propertiesOf(schema: GraphSchema | null | undefined, label: string): string[];
export declare function labelNames(schema: GraphSchema | null | undefined): string[];
/**
 * Labels that may OPEN a pattern — what the FIRST `(x:` of a MATCH offers. The engine rejects a bare
 * read of a reach-only virtual label (`anchor: false`), so offering one there completes a query the
 * preflight refuses; after an edge, every reachable label is fair and {@link connectedLabels} rules.
 * An older appliance sends no flag at all, and everything passes — no opinion, not "nothing".
 */
export declare function anchorLabels(schema: GraphSchema | null | undefined): string[];
/** Relationship types, deduped and sorted — the schema lists one entry per (from, type, to) triple. */
export declare function relationshipTypes(schema: GraphSchema | null | undefined): string[];
export type EdgeDirection = 'out' | 'in' | 'any';
export declare function relationshipTypesFor(schema: GraphSchema | null | undefined, label: string | null | undefined, direction?: EdgeDirection): string[];
export declare function connectedLabels(schema: GraphSchema | null | undefined, label: string | null | undefined, type: string | null | undefined, direction?: EdgeDirection): string[];
/**
 * The node a relationship bracket is being typed against, read from the text
 * before the cursor: `(d:Document)-[` names the label outright, `(d)-[` only an
 * alias (resolved through `aliases`, from {@link aliasMap} over the whole
 * query), and `<-` reverses the direction — the edge arrives rather than
 * leaves. `-[` reads as outgoing: the arrow is not typed yet, but that is where
 * the pattern is overwhelmingly headed. Null when nothing node-shaped precedes
 * the bracket on this line — a pattern started at the `[`, or a node left on an
 * earlier line — which a caller should treat as "no opinion", not "no edges".
 */
export declare function edgeContext(before: string, aliases: Record<string, string>): {
    label: string | null;
    direction: EdgeDirection;
} | null;
/**
 * The pattern a NODE is being typed into, read from the text before the
 * cursor: `(n:Document)-[:MENTIONS]->(c:` reports the source label, the edge
 * type when the bracket names one, and the direction from the source's
 * perspective — `->` is 'out', a leading `<-` is 'in', bare dashes are 'any'.
 * Bare `-->` / `--` connectors count too; a node with no relationship before
 * it (the pattern's first node) is null — no opinion, offer every label.
 */
export declare function nodeContext(before: string, aliases: Record<string, string>): {
    label: string | null;
    type: string | null;
    direction: EdgeDirection;
} | null;
/**
 * The node whose property MAP is being typed — `(c:Concept {` names the label
 * outright, `(c {` only an alias — so a completer can offer the KEYS that
 * label actually has. `used` is the keys the map already binds: a map is a
 * conjunction of equalities, and binding the same key twice is never meant.
 *
 * Null when the cursor is not at a key position of a node's map: inside a
 * string value, right after a `:` (that is a VALUE being typed), or in a map
 * that does not belong to a node — an edge's `{via:…}` or `ai:{…}` has its own
 * vocabulary, not the schema's.
 */
export declare function propertyMapContext(before: string, aliases: Record<string, string>): {
    label: string | null;
    used: string[];
} | null;
//# sourceMappingURL=schema.d.ts.map