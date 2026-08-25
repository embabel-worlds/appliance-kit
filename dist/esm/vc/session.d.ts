export declare const PEEK_LIMIT = 25;
export interface SessionBinding {
    /** Server-side scope name (no `$`). Auto ones are `_1`, `_2`, …, displayed as `$_1`. */
    name: string;
    /** The variable THE USER bound it with — later clauses refer to it by this name. */
    variable: string;
    label: string;
    members: number;
    /** The user's own clauses that reproduce this binding, ending before its RETURN. */
    pipeline: string[];
}
export interface LinePlan {
    kind: 'run' | 'pin' | 'error';
    /** The session form to execute. */
    cypher?: string;
    /** Set when the result should freeze as a scope. */
    captureAs?: string;
    /** The variable the new binding carries. */
    variable?: string;
    /** Pipeline clauses for the NEW binding (pre-RETURN). */
    pipeline?: string[];
    /** For a tabular line: the full displayable pipeline including its RETURN. */
    tabularPipeline?: string[];
    /** True when this line prints rows rather than capturing. */
    tabular?: boolean;
    pinTarget?: string;
    note?: string;
    error?: string;
}
export declare function planLine(raw: string, current: SessionBinding | null, nextAutoName: string, findByName: (name: string) => SessionBinding | undefined, findByVariable: (variable: string) => SessionBinding | undefined): LinePlan;
/**
 * Complete a RETURN-less `MATCH …` into runnable Cypher by implying `RETURN <last labelled var>`
 * (`DISTINCT` when the pattern fans out) — the Session rule, shared with the Query editor's Run
 * and Capture so `MATCH (c:Chunk)` works everywhere, not just in the transcript.
 */
export declare function completeQuery(raw: string): {
    cypher: string;
    note?: string;
};
/** The one real query this session has built so far — the Save-as-view text. */
export declare function pipelineText(stages: string[], returnClause: string | null): string;
//# sourceMappingURL=session.d.ts.map