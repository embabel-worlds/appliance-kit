import type { components } from './generated/openapi.ts'
import { ok, type Outcome } from './outcome.ts'
import type { Transport } from './transport.ts'

/*
 * TOURS, TYPED. `/api/v1/tours` is a guarded surface, so these types are generated from the
 * server's own spec rather than restated here — see the README.
 *
 * The one thing worth noticing in the shape: a step arrives as a `presentation` map and NOT as a
 * typed step, because the server has no opinion about what a step does. Parsing it into something
 * with verbs is this kit's job (`../tour/tour.ts`), which is exactly the boundary that lets a
 * surface add a verb without a server release.
 *
 * `doneWhen` is never in a response. A client asks whether step four is already satisfied and is
 * told; it is not handed Cypher to run. That keeps the condition running as the user it is about,
 * and means an imported tour cannot smuggle a query into a client that would run it with whatever
 * credentials that client happens to hold.
 */

type Schemas = components['schemas']

export type TourSummary = Schemas['TourSummary']
export type TourStepView = Schemas['TourStepView']
export type TourListResponse = Schemas['TourListResponse']
export type TourStepStatusResponse = Schemas['TourStepStatusResponse']
export type TourDeletedResponse = Schemas['TourDeletedResponse']

const TOURS = '/api/v1/tours'

export class ToursClient {
  constructor(private readonly transport: Transport) {}

  /** Every tour this world offers — shipped, realm-contributed and user-saved alike. */
  async all(): Promise<Outcome<TourSummary[]>> {
    const outcome = await this.transport.send<TourListResponse>({ method: 'GET', path: TOURS })
    return outcome.ok ? ok(outcome.value.tours ?? []) : outcome
  }

  /**
   * Is step [index] of [id] already satisfied?
   *
   * Asked when the step is REACHED. A tour changes the world as it walks through it, so a verdict
   * computed when the tour was fetched is an answer about a world that no longer exists.
   *
   * A POST for a read, because [params] — what the tour has collected — are the body, and they are
   * what lets a precondition be about the thing the user just named.
   */
  stepStatus(
    id: string,
    index: number,
    params: Record<string, string> = {},
  ): Promise<Outcome<TourStepStatusResponse>> {
    return this.transport.send({
      method: 'POST',
      path: `${TOURS}/${encodeURIComponent(id)}/steps/${index}/status`,
      body: { params },
    })
  }

  /** One tour as the file it would be — what a user hands to somebody else. */
  export(id: string): Promise<Outcome<string>> {
    return this.transport.send({ method: 'GET', path: `${TOURS}/${encodeURIComponent(id)}/export` })
  }

  /**
   * Store a tour file — one somebody exported, or one this surface just recorded.
   *
   * The body is the FILE, not a JSON object: the exchange format and the storage format are the
   * same thing, so a tour that was exported, edited by hand and re-imported is not a second
   * dialect. A name a realm already owns comes back as a `refused` outcome carrying the server's
   * own sentence.
   */
  async import(yaml: string): Promise<Outcome<TourSummary[]>> {
    const outcome = await this.transport.send<TourListResponse>({
      method: 'POST',
      path: `${TOURS}/import`,
      body: { yaml },
    })
    return outcome.ok ? ok(outcome.value.tours ?? []) : outcome
  }

  /** Delete a tour this user saved. `deleted: false` for a realm's — it is not theirs to remove. */
  delete(id: string): Promise<Outcome<TourDeletedResponse>> {
    return this.transport.send({ method: 'DELETE', path: `${TOURS}/${encodeURIComponent(id)}` })
  }
}
