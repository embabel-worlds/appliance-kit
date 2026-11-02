/** The slice of @embabel/vc the completion consumes — structural, injected. */
export interface VcSemantics {
    VIA_VALUES: readonly string[];
    AI_KEYS: readonly string[];
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
    propertyDetails?(schema: unknown, label: string): Array<{
        name: string;
        type: string;
        description?: string;
    }>;
    propertyDoc?(property: {
        name: string;
        type: string;
        description?: string;
    }): string;
    labelDoc?(schema: unknown, label: string): string;
    relationshipDoc?(schema: unknown, type: string, from?: string | null, to?: string | null): string;
    labelDoors?(schema: unknown, label: string): Array<{
        anchor: string;
        type: string;
        direction: 'out' | 'in';
    }>;
    anchoredPattern?(door: {
        anchor: string;
        type: string;
        direction: 'out' | 'in';
    }, label: string, variable?: string): string;
    labelNames?(schema: unknown): string[];
}
/** One completion with what it means: the name, the text it inserts, and a line of documentation. */
export interface CompletionItem {
    /** What the list shows, and what it sorts by. */
    label: string;
    /** What picking it inserts — the label itself, or a whole anchored pattern. */
    text: string;
    /** A short tag beside the name: a property's type, or what kind of thing it is. */
    detail?: string;
    /** What it means, from the schema: a declared description, and how a reach-only label is reached. */
    doc?: string;
    /**
     * How many characters before the cursor the insertion replaces, when that is more than the
     * stem: an anchored form replaces the `r:Con` it grew from, not just `Con`.
     */
    replaceLength?: number;
}
export interface FragmentCompletion {
    /** The names, as before — what a caller that only inserts text needs. */
    list: string[];
    stemLength: number;
    /** The same offers with what each means, plus anchored forms a bare name cannot express. */
    items?: CompletionItem[];
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
    list: (string | {
        render: (element: HTMLElement) => void;
        from?: unknown;
        text: string;
        displayText: string;
        className: string;
    })[];
    from: unknown;
    to: unknown;
} | null;
/** The bare-word vocabulary both studios teach. Shared so one keystroke completes the same way
 *  in Me and in the console; `ai.relevant/score/classify` are here because per-row judgment is
 *  textual by nature — there is no control that expresses it. */
export declare const CYPHER_KEYWORDS: string[];
/** A captured session binding as the hint needs it: the variable the user bound, and its label. */
export interface HintBinding {
    variable: string;
    label: string;
}
/**
 * The SESSION-AWARE completion: `createCypherHint`, with the session's bindings synthesized into
 * the alias context. A one-line prompt holding only `WHERE c.` completes Chunk's properties
 * because the transcript bound `c` — the proxy prepends one `MATCH (var:Label)` line per binding
 * to `getValue`, and touches nothing else: the hint replaces text by cursor coordinates, which
 * stay on the REAL editor.
 */
export declare function createSessionCypherHint(CodeMirror: {
    Pos(line: number, ch: number): unknown;
}, vc: VcSemantics, options: CypherHintOptions & {
    bindings(): HintBinding[];
}): (editor: EditorLike) => {
    list: (string | {
        render: (element: HTMLElement) => void;
        from?: unknown;
        text: string;
        displayText: string;
        className: string;
    })[];
    from: unknown;
    to: unknown;
} | null;
export {};
//# sourceMappingURL=hints.d.ts.map