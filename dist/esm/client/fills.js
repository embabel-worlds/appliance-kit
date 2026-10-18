const FILLS = '/api/v1/admin/kg/fills';
export class FillsClient {
    transport;
    constructor(transport) {
        this.transport = transport;
    }
    /** The acting user's fills, newest first. */
    list() {
        return this.transport.send({ method: 'GET', path: FILLS });
    }
    /** Start a sweep. The marker is durable immediately; the first chunk runs on the next tick. */
    start(request) {
        return this.transport.send({ method: 'POST', path: FILLS, body: request });
    }
    /** Stop driving it. Completed work stays cached — nothing rolls back. */
    cancel(id) {
        return this.transport.send({ method: 'DELETE', path: `${FILLS}/${encodeURIComponent(id)}` });
    }
}
/**
 * The coverage of a pass, as a percentage — or null when the run had no denominator.
 *
 * Null is a REFUSAL to render a bar, not a missing value to default to zero. It is decided by
 * `totality` and never by whether `keysTotal` happens to be set: the discriminator is the field the
 * server guarantees, and reading past it is how a two-day sweep comes to show a number nobody
 * measured. The server's own `fractionResolved` is preferred; the division is only a fallback for
 * an appliance that sends the pair without it.
 */
export function coveragePercent(coverage) {
    if (coverage.totality !== 'KNOWN')
        return null;
    if (typeof coverage.fractionResolved === 'number')
        return Math.round(coverage.fractionResolved * 100);
    const total = coverage.keysTotal;
    if (typeof total !== 'number' || total <= 0)
        return null;
    return Math.round((coverage.keysResolved / total) * 100);
}
/**
 * Coverage in words, for a row a person reads.
 *
 * With a denominator it is a fraction and a percentage. Without one it is the count alone, saying
 * so — "4,182 assessed (total unknown)" is honest where "4,182 of 0" and a 0% bar are both lies.
 */
export function coverageWords(coverage) {
    const resolved = coverage.keysResolved.toLocaleString();
    const percent = coveragePercent(coverage);
    if (percent === null)
        return `${resolved} assessed (total unknown)`;
    return `${resolved} of ${(coverage.keysTotal ?? 0).toLocaleString()} (${percent}%)`;
}
/**
 * What a fill's state and trend mean together, as a sentence.
 *
 * The pairing is the point: a RUNNING fill that is NOT_CONVERGING is not stuck and has not failed —
 * its producers do not keep what they fetch, so every pass pays for the whole sweep again. That is
 * a permanent poller, which is a legitimate thing to have asked for and a different thing from
 * progress. `warning` says which producers; this says what it means.
 */
export function fillStatusWords(fill) {
    const { state, trend } = fill.progress;
    if (state === 'DONE')
        return 'complete';
    if (state === 'CANCELLED')
        return 'cancelled';
    if (trend === 'NOT_CONVERGING')
        return 'polling, not progressing';
    if (trend === 'CONVERGING')
        return 'converging';
    return 'running';
}
//# sourceMappingURL=fills.js.map