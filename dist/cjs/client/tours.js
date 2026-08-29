"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ToursClient = void 0;
const outcome_ts_1 = require("./outcome.js");
const TOURS = '/api/v1/tours';
class ToursClient {
    transport;
    constructor(transport) {
        this.transport = transport;
    }
    /** Every tour this world offers — shipped, realm-contributed and user-saved alike. */
    async all() {
        const outcome = await this.transport.send({ method: 'GET', path: TOURS });
        return outcome.ok ? (0, outcome_ts_1.ok)(outcome.value.tours ?? []) : outcome;
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
    stepStatus(id, index, params = {}) {
        return this.transport.send({
            method: 'POST',
            path: `${TOURS}/${encodeURIComponent(id)}/steps/${index}/status`,
            body: { params },
        });
    }
    /** One tour as the file it would be — what a user hands to somebody else. */
    export(id) {
        return this.transport.send({ method: 'GET', path: `${TOURS}/${encodeURIComponent(id)}/export` });
    }
    /**
     * Store a tour file — one somebody exported, or one this surface just recorded.
     *
     * The body is the FILE, not a JSON object: the exchange format and the storage format are the
     * same thing, so a tour that was exported, edited by hand and re-imported is not a second
     * dialect. A name a realm already owns comes back as a `refused` outcome carrying the server's
     * own sentence.
     */
    async import(yaml) {
        const outcome = await this.transport.send({
            method: 'POST',
            path: `${TOURS}/import`,
            body: { yaml },
        });
        return outcome.ok ? (0, outcome_ts_1.ok)(outcome.value.tours ?? []) : outcome;
    }
    /** Delete a tour this user saved. `deleted: false` for a realm's — it is not theirs to remove. */
    delete(id) {
        return this.transport.send({ method: 'DELETE', path: `${TOURS}/${encodeURIComponent(id)}` });
    }
}
exports.ToursClient = ToursClient;
//# sourceMappingURL=tours.js.map