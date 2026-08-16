/** The slice of @embabel/vc the completion consumes — structural, injected. */
export interface VcSemantics {
    VIA_VALUES: string[];
    AI_KEYS: string[];
    aliasMap(cypher: string): Record<string, string>;
    propertiesOf(schema: unknown, label: string): string[];
    anchorLabels(schema: unknown): string[];
    relationshipTypesFor(schema: unknown, label: string | null | undefined, direction?: string): string[];
    connectedLabels(schema: unknown, label: string | null | undefined, type: string | null | undefined, direction?: string): string[];
    edgeContext(before: string, aliases: Record<string, string>): {
        label: string | null;
        direction: string;
    } | null;
    nodeContext(before: string, aliases: Record<string, string>): {
        label: string | null;
        type: string | null;
        direction: string;
    } | null;
    propertyMapContext(before: string, aliases: Record<string, string>): {
        label: string | null;
        used: string[];
    } | null;
}
export interface FragmentCompletion {
    list: string[];
    stemLength: number;
}
/**
 * Schema-aware completions for a Cypher FRAGMENT — the text before the cursor,
 * with [aliasSource] the widest text aliases may be declared in (the whole
 * editor for a query; the fragment itself for Cypher inside a kg-call string).
 * The pattern-position branches only; a full editor adds via/ai/keywords via
 * [createCypherHint]. Null when nothing pattern-shaped is being typed.
 */
export declare function cypherFragmentCompletions(vc: VcSemantics, schema: unknown, before: string, aliasSource: string): FragmentCompletion | null;
/** The CodeMirror surface the hint touches — structural, so tests need no browser. */
interface EditorLike {
    getCursor(): {
        line: number;
        ch: number;
    };
    getLine(line: number): string;
    getValue(): string;
}
export interface CypherHintOptions {
    /** The live schema snapshot — read per keystroke, never captured. */
    schema(): unknown;
    /** The bare-word vocabulary this surface teaches (keywords, functions). */
    keywords?: string[];
}
/**
 * The full editor hint for a Cypher editor, ready for
 * `CodeMirror.registerHelper('hint', 'cypher', createCypherHint(CodeMirror, vc, options))`.
 * Every list alphabetical: completion is for scanning, not for whatever order
 * the schema snapshot happened to arrive in.
 */
export declare function createCypherHint(CodeMirror: {
    Pos(line: number, ch: number): unknown;
}, vc: VcSemantics, options: CypherHintOptions): (editor: EditorLike) => {
    list: string[];
    from: unknown;
    to: unknown;
} | null;
export {};
//# sourceMappingURL=hints.d.ts.map