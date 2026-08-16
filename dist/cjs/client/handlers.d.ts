import type { components } from './generated/openapi.ts';
import type { Outcome } from './outcome.ts';
import type { Transport } from './transport.ts';
type Schemas = components['schemas'];
export type HandlerDryRunResult = Schemas['HandlerDryRunResponse'];
export type HandlerRanAgainst = Schemas['HandlerRanAgainst'];
export type HandlerGenerated = Schemas['HandlerGenerateResponse'];
export type HandlerValidation = Schemas['HandlerValidateResponse'];
export type HandlerList = Schemas['HandlerListResponse'];
export type HandlerListing = Schemas['HandlerListing'];
export type HandlerAvailable = Schemas['HandlerAvailable'];
export type HandlerSource = Schemas['HandlerOpenResponse'];
export type HandlerSaveRequest = Schemas['HandlerSaveRequest'];
export type HandlerMutationResult = Schemas['HandlerMutationResponse'];
export type HandlerEnabledResult = Schemas['HandlerEnabledResponse'];
export type HandlerScheduleResult = Schemas['HandlerScheduleResponse'];
export declare class HandlersClient {
    private readonly transport;
    constructor(transport: Transport);
    /** The user's own handlers, plus realm-shipped ones they have not adopted. */
    list(): Promise<Outcome<HandlerList>>;
    /** One handler's source and triggers, for round-tripping open → edit → save. */
    open(name: string): Promise<Outcome<HandlerSource>>;
    /**
     * The `tsc` gate WITHOUT saving or running — the editor's as-you-type verdict, and the same gate
     * the save path enforces, so "valid here" and "rejected there" can never disagree.
     *
     * Two booleans come back and they mean different things: `ok` is whether the check ran, `valid`
     * is its verdict. Validation is best-effort server-side (a missing sandbox skips it), so a
     * caller that reads only `valid` cannot tell "it compiles" from "nothing checked it".
     */
    validate(source: string): Promise<Outcome<HandlerValidation>>;
    /**
     * English → handler source, with the compiler's verdict on what came back. With `current`, the
     * English is a CHANGE to that source — the round-trip an editor's Refine drives.
     */
    generate(english: string, current?: string): Promise<Outcome<HandlerGenerated>>;
    /**
     * Run a handler OBSERVE-ONLY on the appliance, against a real recent signal of `signalType` (or
     * a cron tick when nothing matches), or against `sample` when the event has not been received
     * yet.
     *
     * Read `ranAgainst` rather than assuming: a signal type with nothing on record falls back to a
     * cron tick, so reporting the REQUESTED type would tell an author their handler ran against an
     * event it never saw.
     */
    dryRun(source: string, signalType?: string, sample?: Record<string, unknown>): Promise<Outcome<HandlerDryRunResult>>;
    /**
     * Create or update a handler. The appliance type-checks before persisting, so a false `ok` means
     * the code was rejected, not that the request failed — `message` is the compiler's own words.
     */
    save(spec: HandlerSaveRequest): Promise<Outcome<HandlerMutationResult>>;
    /** Delete a user-authored handler. A realm-shipped one can only be disabled. */
    delete(name: string): Promise<Outcome<HandlerMutationResult>>;
    /** Enable (or, for a realm handler, adopt) — or disable. Until this is true, a handler never fires. */
    setEnabled(name: string, enabled: boolean): Promise<Outcome<HandlerEnabledResult>>;
    /**
     * Set a per-user cron schedule, or clear it with a blank. The response echoes what was STORED,
     * not what was sent — the blank-to-null coercion happens server-side, and a client that trusted
     * its own input would show a schedule that is not in force.
     */
    setSchedule(name: string, schedule: string): Promise<Outcome<HandlerScheduleResult>>;
}
export {};
//# sourceMappingURL=handlers.d.ts.map