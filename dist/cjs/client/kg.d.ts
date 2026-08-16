import type { components } from './generated/openapi.ts';
import type { Outcome } from './outcome.ts';
import type { Transport } from './transport.ts';
type Schemas = components['schemas'];
export type KgSchema = Schemas['KgSchemaResponse'];
export type KgQueryResult = Schemas['KgQueryResult'];
export type KgValidation = Schemas['KgValidationResponse'];
export type KgGenerated = Schemas['KgGenerateResponse'];
export type KgBackgroundHandle = Schemas['KgBackgroundHandle'];
export type KgRunState = Schemas['KgRunState'];
export type KgInFlightRun = Schemas['KgInFlightRun'];
export type KgKillResult = Schemas['KgKillResponse'];
export type KgAnswerAccepted = Schemas['KgAnswerAccepted'];
export type KgView = Schemas['ViewDebugInfo'];
export type KgViewParamSpec = Schemas['ViewParamSpec'];
export type KgSaveViewRequest = Schemas['KgSaveViewRequest'];
export type KgSaveViewResult = Schemas['KgSaveViewResponse'];
export type KgViewInvocation = Schemas['KgViewInvocationResponse'];
export type KgDeleteViewResult = Schemas['KgDeleteViewResponse'];
export type KgRefreshViewResult = Schemas['KgRefreshViewResponse'];
/** The owner's answer to a run that parked awaiting input. */
export type KgRunChoice = 'proceed' | 'narrow' | 'background' | 'cancel';
/** Runtime guard for the one operation with two success shapes: a finished result, or a handle. */
export declare function isBackgroundHandle(outcome: KgQueryResult | KgBackgroundHandle): outcome is KgBackgroundHandle;
export interface ExecuteOptions {
    /** Return a handle immediately instead of waiting. Poll `run()`, or answer it if it parks. */
    background?: boolean;
    /** Watch for at most this long, then take a handle. Ignored when `background` is set. */
    waitSeconds?: number;
}
export declare class KgClient {
    private readonly transport;
    constructor(transport: Transport);
    /**
     * The acting user's reachable schema — the SAME snapshot the preflight validates against, so
     * what an editor offers for completion and what validation accepts can never disagree.
     */
    schema(): Promise<Outcome<KgSchema>>;
    /** The strict preflight WITHOUT execution — the editor's as-you-type validator. */
    validate(cypher: string): Promise<Outcome<KgValidation>>;
    /**
     * Generate cypher and an explanation, without running it. Paired with `execute` so a console can
     * show what will run BEFORE paying for it — a caller that only sees the cypher when the whole
     * run returns looks hung.
     */
    generate(question: string): Promise<Outcome<KgGenerated>>;
    /** Answer a natural-language question: generate, then execute, scoped to the acting user. */
    ask(question: string): Promise<Outcome<KgQueryResult>>;
    /**
     * Execute verbatim cypher through the virtual-cypher engine.
     *
     * With `background`, the result is a handle — use {@link isBackgroundHandle} to tell them apart.
     * With `waitSeconds`, a result whose `run` is set means "not yet": its `rows` are empty because
     * the run has not finished, NEVER because the graph is empty.
     */
    execute(cypher: string, options?: ExecuteOptions): Promise<Outcome<KgQueryResult | KgBackgroundHandle>>;
    /** The acting user's in-flight runs — for a listing, or a kill button. */
    runs(): Promise<Outcome<KgInFlightRun[]>>;
    /** State and, once settled, the result of a background run. */
    run(runId: string): Promise<Outcome<KgRunState>>;
    /** Cancel an in-flight run. Committed graph-cache work survives the kill. */
    kill(runId: string): Promise<Outcome<KgKillResult>>;
    /** Answer a run parked awaiting input. */
    answer(runId: string, choice: KgRunChoice): Promise<Outcome<KgAnswerAccepted>>;
    /** Saved views across the world and realm tiers, with their cache state. */
    views(): Promise<Outcome<KgView[]>>;
    /**
     * Save a query as a named view. The appliance validates and persists it — a console never edits
     * world YAML itself.
     */
    saveView(spec: KgSaveViewRequest): Promise<Outcome<KgSaveViewResult>>;
    deleteView(name: string): Promise<Outcome<KgDeleteViewResult>>;
    /**
     * The runnable cypher for a saved view invoked with these arguments. Put it in the editable
     * cypher box and run it through `execute`, so a view goes through the same engine as any other
     * query rather than a private path.
     */
    viewInvocation(name: string, args?: Record<string, unknown>): Promise<Outcome<KgViewInvocation>>;
    /** Force-recompute a materialised view's cache now, ignoring its TTL. */
    refreshView(name: string): Promise<Outcome<KgRefreshViewResult>>;
}
export {};
//# sourceMappingURL=kg.d.ts.map