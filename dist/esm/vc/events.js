/*
 * WHAT THE ENGINE IS DOING RIGHT NOW, in words.
 *
 * A virtual-cypher run is one POST that eventually returns, and the slow part — a bounded LLM
 * retrieval loop — can legitimately take tens of seconds. A spinner cannot tell "reading your
 * third document" from "the model is wedged", so people cancel work that was about to succeed. The
 * appliance publishes the trace live for exactly this reason (`GET /api/v1/virtual-cypher/events`,
 * one SSE event per stage, fetch and retrieval step); what was missing was any client reading it.
 *
 * THESE TYPES ARE HAND-WRITTEN, DELIBERATELY, AND THAT IS NOT THE USUAL RULE. Everything under
 * `@embabel/appliance-kit` proper is generated from the surface the assistant's contract test
 * guards, and a hand-typed REST shape there would be a guess wearing a type's clothes. This is not
 * that: the events endpoint is `@Hidden` from the spec and SSE frames are not something OpenAPI
 * describes usefully. It belongs in `./vc` with `TARGETS` and `compose` — a reading of the
 * ENGINE'S SEMANTICS, shared so that two front ends narrate the same run with the same words
 * rather than inventing separate vocabularies for it.
 *
 * The fields mirror `VirtualCypherEvent` in the assistant. Unknown event types are expected and
 * survive: a newer appliance may publish kinds this build has never heard of, and a progress panel
 * that threw on one would be worse than no progress panel.
 */
/** The run is over: nothing further will arrive for this queryId. */
export const isTerminal = (event) => event.type === 'query.completed' || event.type === 'query.rejected';
/** Whether this event reports something going wrong, for a surface choosing a tone. */
export const isFailure = (event) => event.type === 'producer.error' || event.type === 'query.rejected';
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
/** The retrieval loop's steps, said as what the model is doing rather than as its tool name. */
const RETRIEVAL_STEPS = {
    search_semantic: 'Searching by meaning',
    search_keyword: 'Searching by keyword',
    read_document: 'Reading',
    judged: 'Judging',
    composing: 'Composing the answer',
};
/**
 * One line describing what just happened, for a progress panel.
 *
 * Written for the person waiting, not for a log: it says what the engine is DOING ("Fetching from
 * companies-house") rather than restating the event's field names. An unrecognised type returns
 * its bare `type` instead of throwing — a newer appliance publishing a kind this build predates
 * should degrade to a dull line, never to a broken panel.
 */
export function describeVcEvent(event) {
    switch (event.type) {
        case 'query.started':
            return 'Planning the query';
        case 'stage.started': {
            const e = event;
            return `Stage ${e.stage}: ${e.producer} → ${e.targetLabel}, from ${plural(e.anchorCount, e.anchorLabel)}`;
        }
        case 'producer.fetch': {
            const e = event;
            return `${e.producer} returned ${plural(e.recordCount, 'record')} for ${plural(e.keyCount, 'key')} (${e.durationMs} ms)`;
        }
        case 'nodes.materialized': {
            const e = event;
            return `Materialized ${plural(e.count, e.targetLabel)} via ${e.relationship}`;
        }
        case 'producer.error': {
            const e = event;
            return `${e.producer} failed: ${e.detail}`;
        }
        case 'producer.progress': {
            const e = event;
            const of = e.total > 0 ? `${e.current}/${e.total}` : String(e.current);
            return `${e.producer}: ${of} ${e.unit}${e.key ? ` · ${e.key}` : ''}`;
        }
        case 'retrieval.step': {
            const e = event;
            const verb = RETRIEVAL_STEPS[e.step] ?? e.step;
            const found = e.results == null ? '' : ` — ${plural(e.results, 'result')}`;
            return `${verb}: ${e.detail}${found}`;
        }
        case 'query.completed': {
            const e = event;
            const labels = e.materializedLabels?.length ? ` · materialized ${e.materializedLabels.join(', ')}` : '';
            return `Done — ${plural(e.rowCount, 'row')} in ${e.durationMs} ms${labels}`;
        }
        case 'query.rejected':
            return `Rejected: ${event.reason}`;
        default:
            return event.type;
    }
}
//# sourceMappingURL=events.js.map