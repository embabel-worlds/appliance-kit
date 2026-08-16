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

/** The correlation envelope every event carries. */
export interface VcEventBase {
  /** The discriminator: `query.started`, `producer.fetch`, … Also the SSE event name. */
  type: string
  /** One run. Every event of a run shares it. */
  queryId: string
  /** The acting user's graph id — the stream is per-user, not per-query. */
  userId: string
  /** Monotonic within the run, so an out-of-order transport can be re-sorted. */
  seq: number
  /** Wall clock, epoch milliseconds. */
  atMs: number
  /**
   * The CLIENT's own correlation id, when it supplied one. The stream is per-USER, so without it
   * one window can show another window's retrieval — only the events a progress indicator
   * subscribes to carry it.
   */
  operationId?: string | null
}

export interface VcQueryStarted extends VcEventBase { type: 'query.started'; cypher: string }
export interface VcStageStarted extends VcEventBase {
  type: 'stage.started'
  stage: number
  producer: string
  targetLabel: string
  anchorLabel: string
  anchorCount: number
}
export interface VcProducerFetch extends VcEventBase {
  type: 'producer.fetch'
  producer: string
  /** `remote`, `generative`, `aggregate`, … — so a surface can badge the source. */
  kind: string
  targetLabel: string
  keyCount: number
  recordCount: number
  durationMs: number
}
export interface VcNodesMaterialized extends VcEventBase {
  type: 'nodes.materialized'
  targetLabel: string
  relationship: string
  count: number
}
export interface VcProducerError extends VcEventBase {
  type: 'producer.error'
  producer: string
  kind: string
  detail: string
}
export interface VcProducerProgress extends VcEventBase {
  type: 'producer.progress'
  producer: string
  unit: string
  current: number
  total: number
  key?: string
}
export interface VcRetrievalStep extends VcEventBase {
  type: 'retrieval.step'
  /** `search_semantic`, `search_keyword`, `read_document`, `judged`, `composing`. */
  step: string
  /** The query the model chose, or the document title it opened. */
  detail: string
  results?: number | null
}
export interface VcQueryCompleted extends VcEventBase {
  type: 'query.completed'
  rowCount: number
  materializedLabels: string[]
  durationMs: number
}
export interface VcQueryRejected extends VcEventBase { type: 'query.rejected'; reason: string }

export type VcEvent =
  | VcQueryStarted
  | VcStageStarted
  | VcProducerFetch
  | VcNodesMaterialized
  | VcProducerError
  | VcProducerProgress
  | VcRetrievalStep
  | VcQueryCompleted
  | VcQueryRejected
  | VcEventBase

/** The run is over: nothing further will arrive for this queryId. */
export const isTerminal = (event: VcEvent): boolean =>
  event.type === 'query.completed' || event.type === 'query.rejected'

/** Whether this event reports something going wrong, for a surface choosing a tone. */
export const isFailure = (event: VcEvent): boolean =>
  event.type === 'producer.error' || event.type === 'query.rejected'

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

/** The retrieval loop's steps, said as what the model is doing rather than as its tool name. */
const RETRIEVAL_STEPS: Record<string, string> = {
  search_semantic: 'Searching by meaning',
  search_keyword: 'Searching by keyword',
  read_document: 'Reading',
  judged: 'Judging',
  composing: 'Composing the answer',
}

/**
 * One line describing what just happened, for a progress panel.
 *
 * Written for the person waiting, not for a log: it says what the engine is DOING ("Fetching from
 * companies-house") rather than restating the event's field names. An unrecognised type returns
 * its bare `type` instead of throwing — a newer appliance publishing a kind this build predates
 * should degrade to a dull line, never to a broken panel.
 */
export function describeVcEvent(event: VcEvent): string {
  switch (event.type) {
    case 'query.started':
      return 'Planning the query'
    case 'stage.started': {
      const e = event as VcStageStarted
      return `Stage ${e.stage}: ${e.producer} → ${e.targetLabel}, from ${plural(e.anchorCount, e.anchorLabel)}`
    }
    case 'producer.fetch': {
      const e = event as VcProducerFetch
      return `${e.producer} returned ${plural(e.recordCount, 'record')} for ${plural(e.keyCount, 'key')} (${e.durationMs} ms)`
    }
    case 'nodes.materialized': {
      const e = event as VcNodesMaterialized
      return `Materialized ${plural(e.count, e.targetLabel)} via ${e.relationship}`
    }
    case 'producer.error': {
      const e = event as VcProducerError
      return `${e.producer} failed: ${e.detail}`
    }
    case 'producer.progress': {
      const e = event as VcProducerProgress
      const of = e.total > 0 ? `${e.current}/${e.total}` : String(e.current)
      return `${e.producer}: ${of} ${e.unit}${e.key ? ` · ${e.key}` : ''}`
    }
    case 'retrieval.step': {
      const e = event as VcRetrievalStep
      const verb = RETRIEVAL_STEPS[e.step] ?? e.step
      const found = e.results == null ? '' : ` — ${plural(e.results, 'result')}`
      return `${verb}: ${e.detail}${found}`
    }
    case 'query.completed': {
      const e = event as VcQueryCompleted
      const labels = e.materializedLabels?.length ? ` · materialized ${e.materializedLabels.join(', ')}` : ''
      return `Done — ${plural(e.rowCount, 'row')} in ${e.durationMs} ms${labels}`
    }
    case 'query.rejected':
      return `Rejected: ${(event as VcQueryRejected).reason}`
    default:
      return event.type
  }
}
