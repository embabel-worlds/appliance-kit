import type { components } from './generated/openapi.ts'
import type { Outcome } from './outcome.ts'
import type { Transport } from './transport.ts'

/*
 * THE HANDLER-AUTHORING SURFACE, AS NAMED CAPABILITIES.
 *
 * The sibling of `kg.ts`, shaped the same way and for the same reason: the Me app's renderer
 * cannot make HTTP calls, so what crosses its preload bridge is a fixed set of named operations
 * rather than a URL builder.
 *
 * Every type below comes from `generated/openapi.ts`. Until the assistant's handlers controller
 * was given real response types these nine endpoints answered `Map<String, Any?>` and generated as
 * `unknown` — so the Handler Studio parsed them from a hand-written reading instead, which is
 * exactly the drift this package exists to end. `OpenApiClientContractTest` now guards this prefix
 * alongside `/admin/kg`; these cannot move without that test failing first.
 *
 * ONE ASYMMETRY WORTH KNOWING. Everything here is POST, including the reads (`list`, `open`).
 * That is the server's shape, not a choice made here — `dry-run` executes submitted code, so the
 * whole surface sits behind POST with the acting user taken from the authenticated principal and
 * never from a request parameter.
 */

type Schemas = components['schemas']

export type HandlerDryRunResult = Schemas['HandlerDryRunResponse']
export type HandlerRanAgainst = Schemas['HandlerRanAgainst']
export type HandlerGenerated = Schemas['HandlerGenerateResponse']
export type HandlerValidation = Schemas['HandlerValidateResponse']
export type HandlerList = Schemas['HandlerListResponse']
export type HandlerListing = Schemas['HandlerListing']
export type HandlerAvailable = Schemas['HandlerAvailable']
export type HandlerSource = Schemas['HandlerOpenResponse']
export type HandlerSaveRequest = Schemas['HandlerSaveRequest']
export type HandlerMutationResult = Schemas['HandlerMutationResponse']
export type HandlerEnabledResult = Schemas['HandlerEnabledResponse']
export type HandlerScheduleResult = Schemas['HandlerScheduleResponse']

const HANDLERS = '/api/v1/admin/handlers'

/**
 * Generation runs a model and then a compile; a dry run executes the handler. Neither is
 * interactive-fast, and the transport's 30s default would time out calls that were going to
 * succeed.
 */
const TIMEOUTS = {
  dryRun: 180_000,
  generate: 120_000,
  save: 60_000,
} as const

export class HandlersClient {
  constructor(private readonly transport: Transport) {}

  /** The user's own handlers, plus realm-shipped ones they have not adopted. */
  list(): Promise<Outcome<HandlerList>> {
    return this.transport.send({ method: 'POST', path: `${HANDLERS}/list`, body: {} })
  }

  /** One handler's source and triggers, for round-tripping open → edit → save. */
  open(name: string): Promise<Outcome<HandlerSource>> {
    return this.transport.send({
      method: 'POST',
      path: `${HANDLERS}/open`,
      query: { name },
      body: {},
    })
  }

  /**
   * The `tsc` gate WITHOUT saving or running — the editor's as-you-type verdict, and the same gate
   * the save path enforces, so "valid here" and "rejected there" can never disagree.
   *
   * Two booleans come back and they mean different things: `ok` is whether the check ran, `valid`
   * is its verdict. Validation is best-effort server-side (a missing sandbox skips it), so a
   * caller that reads only `valid` cannot tell "it compiles" from "nothing checked it".
   */
  validate(source: string): Promise<Outcome<HandlerValidation>> {
    return this.transport.send({ method: 'POST', path: `${HANDLERS}/validate`, body: { source } })
  }

  /**
   * English → handler source, with the compiler's verdict on what came back. With `current`, the
   * English is a CHANGE to that source — the round-trip an editor's Refine drives.
   */
  generate(english: string, current?: string): Promise<Outcome<HandlerGenerated>> {
    return this.transport.send({
      method: 'POST',
      path: `${HANDLERS}/generate`,
      body: current === undefined ? { english } : { english, current },
      timeoutMs: TIMEOUTS.generate,
    })
  }

  /**
   * Run a handler OBSERVE-ONLY on the appliance, against a real recent signal of `signalType` (or
   * a cron tick when nothing matches), or against `sample` when the event has not been received
   * yet.
   *
   * Read `ranAgainst` rather than assuming: a signal type with nothing on record falls back to a
   * cron tick, so reporting the REQUESTED type would tell an author their handler ran against an
   * event it never saw.
   */
  dryRun(
    source: string,
    signalType?: string,
    sample?: Record<string, unknown>,
  ): Promise<Outcome<HandlerDryRunResult>> {
    const body: Record<string, unknown> = { source }
    if (signalType) body['signalType'] = signalType
    if (sample) body['sample'] = sample
    return this.transport.send({
      method: 'POST',
      path: `${HANDLERS}/dry-run`,
      body,
      timeoutMs: TIMEOUTS.dryRun,
    })
  }

  /**
   * Create or update a handler. The appliance type-checks before persisting, so a false `ok` means
   * the code was rejected, not that the request failed — `message` is the compiler's own words.
   */
  save(spec: HandlerSaveRequest): Promise<Outcome<HandlerMutationResult>> {
    return this.transport.send({
      method: 'POST',
      path: `${HANDLERS}/save`,
      body: spec,
      timeoutMs: TIMEOUTS.save,
    })
  }

  /** Delete a user-authored handler. A realm-shipped one can only be disabled. */
  delete(name: string): Promise<Outcome<HandlerMutationResult>> {
    return this.transport.send({
      method: 'POST',
      path: `${HANDLERS}/delete`,
      query: { name },
      body: {},
    })
  }

  /** Enable (or, for a realm handler, adopt) — or disable. Until this is true, a handler never fires. */
  setEnabled(name: string, enabled: boolean): Promise<Outcome<HandlerEnabledResult>> {
    return this.transport.send({
      method: 'POST',
      path: `${HANDLERS}/set-enabled`,
      query: { name, enabled },
      body: {},
    })
  }

  /**
   * Set a per-user cron schedule, or clear it with a blank. The response echoes what was STORED,
   * not what was sent — the blank-to-null coercion happens server-side, and a client that trusted
   * its own input would show a schedule that is not in force.
   */
  setSchedule(name: string, schedule: string): Promise<Outcome<HandlerScheduleResult>> {
    return this.transport.send({
      method: 'POST',
      path: `${HANDLERS}/set-schedule`,
      query: { name, schedule },
      body: {},
    })
  }
}
