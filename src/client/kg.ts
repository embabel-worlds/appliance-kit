import type { components } from './generated/openapi.ts'
import type { Outcome } from './outcome.ts'
import type { Transport } from './transport.ts'

/*
 * THE VIRTUAL-CYPHER SURFACE, AS NAMED CAPABILITIES.
 *
 * Shaped as methods rather than as URLs on purpose. The Me app's renderer cannot make HTTP calls
 * at all — it reaches the appliance only through a narrow preload bridge — so the thing that has
 * to cross that boundary is a fixed set of named operations. `schema()` forwards over IPC in one
 * line; `get('/api/v1/admin/kg/schema')` would hand the renderer a URL builder and, with it, the
 * ability to call anything.
 *
 * Every type below comes from `src/generated/openapi.ts`, which is generated from the snapshot
 * `OpenApiKgContractTest` guards in the assistant repo. Nothing here is hand-typed, so these
 * cannot drift from the server without that test failing first.
 */

type Schemas = components['schemas']

export type KgSchema = Schemas['KgSchemaResponse']
export type KgQueryResult = Schemas['KgQueryResult']
export type KgValidation = Schemas['KgValidationResponse']
export type KgGenerated = Schemas['KgGenerateResponse']
export type KgBackgroundHandle = Schemas['KgBackgroundHandle']
export type KgRunState = Schemas['KgRunState']
export type KgInFlightRun = Schemas['KgInFlightRun']
export type KgKillResult = Schemas['KgKillResponse']
export type KgAnswerAccepted = Schemas['KgAnswerAccepted']
export type KgView = Schemas['ViewDebugInfo']
export type KgViewParamSpec = Schemas['ViewParamSpec']
export type KgSaveViewRequest = Schemas['KgSaveViewRequest']
export type KgSaveViewResult = Schemas['KgSaveViewResponse']
export type KgViewInvocation = Schemas['KgViewInvocationResponse']
export type KgDeleteViewResult = Schemas['KgDeleteViewResponse']
export type KgRefreshViewResult = Schemas['KgRefreshViewResponse']
export type KgPropertyValues = Schemas['KgPropertyValuesResponse']
export type KgScopeInfo = Schemas['KgScopeInfo']
export type KgScopeList = Schemas['KgScopeListResponse']
export type KgScopeDeleteResult = Schemas['KgScopeDeleteResponse']

/** The owner's answer to a run that parked awaiting input. */
export type KgRunChoice = 'proceed' | 'narrow' | 'background' | 'cancel'

const KG = '/api/v1/admin/kg'

/**
 * Generation and execution are not interactive-fast. A cold extract or aggregate materializes on
 * first traversal, so a 30s default would time out calls that were going to succeed.
 */
const TIMEOUTS = {
  execute: 180_000,
  generate: 120_000,
  saveView: 60_000,
} as const

/**
 * Runtime guard for the one operation with two success shapes: a finished result, or a handle.
 *
 * IDENTIFIES THE HANDLE POSITIVELY, by the `runId` only a handle carries. It used to test for the
 * ABSENCE of `rowCount`, which is a different question and the wrong one: `rowCount` is documented
 * as required on a result but is not always sent, and every consumer of the older clients defends
 * with `rowCount ?? rows.length` for exactly that reason. A result that omitted it was therefore
 * read as a background handle, and its rows — sitting right there in the payload — were discarded
 * while the caller reported the run as parked.
 *
 * A missing OPTIONAL field must never be what tells two shapes apart. `runId` is required on the
 * handle and absent from the result, so it is the one field that answers this question.
 */
export function isBackgroundHandle(
  outcome: KgQueryResult | KgBackgroundHandle,
): outcome is KgBackgroundHandle {
  return 'runId' in outcome && (outcome as KgBackgroundHandle).runId !== undefined
}

export interface ExecuteOptions {
  /** Return a handle immediately instead of waiting. Poll `run()`, or answer it if it parks. */
  background?: boolean
  /** Watch for at most this long, then take a handle. Ignored when `background` is set. */
  waitSeconds?: number
  /**
   * Capture the result set as this named scope — a REPL binding a later statement references as
   * `(x:` + backtick + `$name` + backtick + `)`. Synchronous mode only: the appliance answers
   * 400 when combined with `background` or `waitSeconds`, because a parked run has no result set
   * to freeze yet. The result's `capturedScope` carries what froze.
   */
  captureAs?: string
}

export class KgClient {
  constructor(private readonly transport: Transport) {}

  /**
   * The acting user's reachable schema — the SAME snapshot the preflight validates against, so
   * what an editor offers for completion and what validation accepts can never disagree.
   */
  schema(): Promise<Outcome<KgSchema>> {
    return this.transport.send({ method: 'GET', path: `${KG}/schema` })
  }

  /** The strict preflight WITHOUT execution — the editor's as-you-type validator. */
  validate(cypher: string): Promise<Outcome<KgValidation>> {
    return this.transport.send({ method: 'POST', path: `${KG}/validate`, body: { cypher } })
  }

  /**
   * Generate cypher and an explanation, without running it. Paired with `execute` so a console can
   * show what will run BEFORE paying for it — a caller that only sees the cypher when the whole
   * run returns looks hung.
   */
  generate(question: string): Promise<Outcome<KgGenerated>> {
    return this.transport.send({
      method: 'POST',
      path: `${KG}/generate`,
      body: { question },
      timeoutMs: TIMEOUTS.generate,
    })
  }

  /**
   * Revise existing cypher per an instruction, without running it — "now only the ones since
   * March". Distinct from {@link generate}, which starts from nothing: the model is given the
   * query it is changing, so an editor's Refine keeps what the author already had rather than
   * regenerating around it.
   */
  refine(cypher: string, instruction: string): Promise<Outcome<KgGenerated>> {
    return this.transport.send({
      method: 'POST',
      path: `${KG}/refine`,
      body: { cypher, instruction },
      timeoutMs: TIMEOUTS.generate,
    })
  }

  /**
   * The legal values of a property — the closed set, or the fact that it is too wide, or why it
   * cannot be enumerated at all. Three outcomes, and completion must tell them apart: `enumerable:
   * false` means the source cannot be asked, which is NOT an empty set, and `tooMany` present
   * means the domain is real but wider than the property's declared maximum.
   */
  propertyValues(label: string, property: string): Promise<Outcome<KgPropertyValues>> {
    return this.transport.send({
      method: 'GET',
      path: `${KG}/schema/${encodeURIComponent(label)}/${encodeURIComponent(property)}/values`,
    })
  }

  /** Answer a natural-language question: generate, then execute, scoped to the acting user. */
  ask(question: string): Promise<Outcome<KgQueryResult>> {
    return this.transport.send({
      method: 'POST',
      path: `${KG}/ask`,
      body: { question },
      timeoutMs: TIMEOUTS.execute,
    })
  }

  /**
   * Execute verbatim cypher through the virtual-cypher engine.
   *
   * With `background`, the result is a handle — use {@link isBackgroundHandle} to tell them apart.
   * With `waitSeconds`, a result whose `run` is set means "not yet": its `rows` are empty because
   * the run has not finished, NEVER because the graph is empty.
   */
  execute(cypher: string, options: ExecuteOptions = {}): Promise<Outcome<KgQueryResult | KgBackgroundHandle>> {
    const query: Record<string, string | number | boolean | undefined> = {}
    if (options.background) query['background'] = true
    if (options.waitSeconds !== undefined) query['waitSeconds'] = options.waitSeconds
    const body: Record<string, unknown> = { cypher }
    if (options.captureAs !== undefined) body['captureAs'] = options.captureAs
    return this.transport.send({
      method: 'POST',
      path: `${KG}/execute`,
      query,
      body,
      timeoutMs: TIMEOUTS.execute,
    })
  }

  /** The acting user's live captured scopes, newest first. An expired scope is already absent. */
  scopes(): Promise<Outcome<KgScopeList>> {
    return this.transport.send({ method: 'GET', path: `${KG}/scopes` })
  }

  /** Delete a captured scope. `deleted: false` is an honest no-op, not an error. */
  deleteScope(name: string): Promise<Outcome<KgScopeDeleteResult>> {
    return this.transport.send({ method: 'DELETE', path: `${KG}/scopes/${encodeURIComponent(name)}` })
  }

  /** Pin a captured scope: clear its expiry so it survives until explicitly deleted. */
  pinScope(name: string): Promise<Outcome<KgScopeInfo>> {
    return this.transport.send({ method: 'POST', path: `${KG}/scopes/${encodeURIComponent(name)}/pin` })
  }

  /** The acting user's in-flight runs — for a listing, or a kill button. */
  runs(): Promise<Outcome<KgInFlightRun[]>> {
    return this.transport.send({ method: 'GET', path: `${KG}/runs` })
  }

  /** State and, once settled, the result of a background run. */
  run(runId: string): Promise<Outcome<KgRunState>> {
    return this.transport.send({ method: 'GET', path: `${KG}/runs/${encodeURIComponent(runId)}` })
  }

  /** Cancel an in-flight run. Committed graph-cache work survives the kill. */
  kill(runId: string): Promise<Outcome<KgKillResult>> {
    return this.transport.send({ method: 'POST', path: `${KG}/kill/${encodeURIComponent(runId)}` })
  }

  /** Answer a run parked awaiting input. */
  answer(runId: string, choice: KgRunChoice): Promise<Outcome<KgAnswerAccepted>> {
    return this.transport.send({
      method: 'POST',
      path: `${KG}/runs/${encodeURIComponent(runId)}/answer`,
      body: { choice },
    })
  }

  /** Saved views across the world and realm tiers, with their cache state. */
  views(): Promise<Outcome<KgView[]>> {
    return this.transport.send({ method: 'GET', path: `${KG}/views` })
  }

  /**
   * Save a query as a named view. The appliance validates and persists it — a console never edits
   * world YAML itself.
   */
  saveView(spec: KgSaveViewRequest): Promise<Outcome<KgSaveViewResult>> {
    return this.transport.send({
      method: 'POST',
      path: `${KG}/views`,
      body: spec,
      timeoutMs: TIMEOUTS.saveView,
    })
  }

  deleteView(name: string): Promise<Outcome<KgDeleteViewResult>> {
    return this.transport.send({ method: 'DELETE', path: `${KG}/views/${encodeURIComponent(name)}` })
  }

  /**
   * The runnable cypher for a saved view invoked with these arguments. Put it in the editable
   * cypher box and run it through `execute`, so a view goes through the same engine as any other
   * query rather than a private path.
   */
  viewInvocation(name: string, args: Record<string, unknown> = {}): Promise<Outcome<KgViewInvocation>> {
    return this.transport.send({
      method: 'POST',
      path: `${KG}/views/${encodeURIComponent(name)}/invocation`,
      body: { args },
    })
  }

  /**
   * Run a saved view with these arguments and return its rows — the one-call form of
   * {@link viewInvocation} followed by {@link execute}.
   *
   * BOTH ARE WORTH HAVING. This one is for a caller that just wants the answer; the two-step is
   * for a studio, which puts the expanded cypher in an editable box so the author can see what a
   * view actually does and adjust it. Neither is a shortcut for the other.
   */
  runView(name: string, args: Record<string, unknown> = {}): Promise<Outcome<KgQueryResult>> {
    return this.transport.send({
      method: 'POST',
      path: `${KG}/views/${encodeURIComponent(name)}/run`,
      body: { args },
      timeoutMs: TIMEOUTS.execute,
    })
  }

  /** Force-recompute a materialised view's cache now, ignoring its TTL. */
  refreshView(name: string): Promise<Outcome<KgRefreshViewResult>> {
    return this.transport.send({
      method: 'POST',
      path: `${KG}/views/${encodeURIComponent(name)}/refresh`,
    })
  }
}
