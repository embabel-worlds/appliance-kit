import type { components } from './generated/openapi.ts';
import { type Outcome } from './outcome.ts';
import type { Transport } from './transport.ts';
type Schemas = components['schemas'];
export type TourSummary = Schemas['TourSummary'];
export type TourStepView = Schemas['TourStepView'];
export type TourListResponse = Schemas['TourListResponse'];
export type TourStepStatusResponse = Schemas['TourStepStatusResponse'];
export type TourDeletedResponse = Schemas['TourDeletedResponse'];
export declare class ToursClient {
    private readonly transport;
    constructor(transport: Transport);
    /** Every tour this world offers — shipped, realm-contributed and user-saved alike. */
    all(): Promise<Outcome<TourSummary[]>>;
    /**
     * Is step [index] of [id] already satisfied?
     *
     * Asked when the step is REACHED. A tour changes the world as it walks through it, so a verdict
     * computed when the tour was fetched is an answer about a world that no longer exists.
     *
     * A POST for a read, because [params] — what the tour has collected — are the body, and they are
     * what lets a precondition be about the thing the user just named.
     */
    stepStatus(id: string, index: number, params?: Record<string, string>): Promise<Outcome<TourStepStatusResponse>>;
    /** One tour as the file it would be — what a user hands to somebody else. */
    export(id: string): Promise<Outcome<string>>;
    /**
     * Store a tour file — one somebody exported, or one this surface just recorded.
     *
     * The body is the FILE, not a JSON object: the exchange format and the storage format are the
     * same thing, so a tour that was exported, edited by hand and re-imported is not a second
     * dialect. A name a realm already owns comes back as a `refused` outcome carrying the server's
     * own sentence.
     */
    import(yaml: string): Promise<Outcome<TourSummary[]>>;
    /** Delete a tour this user saved. `deleted: false` for a realm's — it is not theirs to remove. */
    delete(id: string): Promise<Outcome<TourDeletedResponse>>;
}
export {};
//# sourceMappingURL=tours.d.ts.map