/** A relevance target: the label an anchor points at. */
export type TargetId = 'documents' | 'files' | 'threads' | 'canvas';
/** How relevance is decided at the edge. */
export type Mode = 'about' | 'mentions' | 'judged' | 'semantic';
/** Threads hang off several kinds of anchor, not just a topic. */
export type AnchorId = 'topic' | 'person' | 'organization' | 'meeting';
export interface Anchor {
    readonly label: string;
    /** The anchor's node pattern, with the seed already escaped. */
    readonly pattern: (seed: string) => string;
    readonly placeholder: string;
}
export interface TargetSpec {
    readonly name: string;
    readonly what: string;
    readonly seedLabel?: string;
    readonly modes: readonly Mode[];
    readonly tags: boolean;
    readonly dates: boolean;
    readonly anchors?: Readonly<Record<AnchorId, Anchor>>;
}
/** Cypher string-literal escape: backslashes first, then quotes. Order matters. */
export declare const esc: (s: string) => string;
export declare const TARGETS: Readonly<Record<TargetId, TargetSpec>>;
/** The `via` vocabulary, for an editor offering completions. */
export declare const VIA_VALUES: readonly ["keyword", "agentic-rag"];
/** The `{ai:{…}}` steering keys. Nested map, not the retired `ai_*` flat keys. */
export declare const AI_KEYS: readonly ["hint", "model", "temperature", "confidence", "fresh"];
//# sourceMappingURL=targets.d.ts.map