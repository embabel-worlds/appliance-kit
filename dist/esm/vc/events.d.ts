/** The correlation envelope every event carries. */
export interface VcEventBase {
    /** The discriminator: `query.started`, `producer.fetch`, … Also the SSE event name. */
    type: string;
    /** One run. Every event of a run shares it. */
    queryId: string;
    /** The acting user's graph id — the stream is per-user, not per-query. */
    userId: string;
    /** Monotonic within the run, so an out-of-order transport can be re-sorted. */
    seq: number;
    /** Wall clock, epoch milliseconds. */
    atMs: number;
    /**
     * The CLIENT's own correlation id, when it supplied one. The stream is per-USER, so without it
     * one window can show another window's retrieval — only the events a progress indicator
     * subscribes to carry it.
     */
    operationId?: string | null;
}
export interface VcQueryStarted extends VcEventBase {
    type: 'query.started';
    cypher: string;
}
export interface VcStageStarted extends VcEventBase {
    type: 'stage.started';
    stage: number;
    producer: string;
    targetLabel: string;
    anchorLabel: string;
    anchorCount: number;
}
export interface VcProducerFetch extends VcEventBase {
    type: 'producer.fetch';
    producer: string;
    /** `remote`, `generative`, `aggregate`, … — so a surface can badge the source. */
    kind: string;
    targetLabel: string;
    keyCount: number;
    recordCount: number;
    durationMs: number;
}
export interface VcNodesMaterialized extends VcEventBase {
    type: 'nodes.materialized';
    targetLabel: string;
    relationship: string;
    count: number;
}
export interface VcProducerError extends VcEventBase {
    type: 'producer.error';
    producer: string;
    kind: string;
    detail: string;
}
export interface VcProducerProgress extends VcEventBase {
    type: 'producer.progress';
    producer: string;
    unit: string;
    current: number;
    total: number;
    key?: string;
}
export interface VcRetrievalStep extends VcEventBase {
    type: 'retrieval.step';
    /** `search_semantic`, `search_keyword`, `read_document`, `judged`, `composing`. */
    step: string;
    /** The query the model chose, or the document title it opened. */
    detail: string;
    results?: number | null;
}
export interface VcQueryCompleted extends VcEventBase {
    type: 'query.completed';
    rowCount: number;
    materializedLabels: string[];
    durationMs: number;
}
export interface VcQueryRejected extends VcEventBase {
    type: 'query.rejected';
    reason: string;
}
export type VcEvent = VcQueryStarted | VcStageStarted | VcProducerFetch | VcNodesMaterialized | VcProducerError | VcProducerProgress | VcRetrievalStep | VcQueryCompleted | VcQueryRejected | VcEventBase;
/** The run is over: nothing further will arrive for this queryId. */
export declare const isTerminal: (event: VcEvent) => boolean;
/** Whether this event reports something going wrong, for a surface choosing a tone. */
export declare const isFailure: (event: VcEvent) => boolean;
/**
 * One line describing what just happened, for a progress panel.
 *
 * Written for the person waiting, not for a log: it says what the engine is DOING ("Fetching from
 * companies-house") rather than restating the event's field names. An unrecognised type returns
 * its bare `type` instead of throwing — a newer appliance publishing a kind this build predates
 * should degrade to a dull line, never to a broken panel.
 */
export declare function describeVcEvent(event: VcEvent): string;
//# sourceMappingURL=events.d.ts.map