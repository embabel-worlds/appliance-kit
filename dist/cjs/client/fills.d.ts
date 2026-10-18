import type { Outcome } from './outcome.ts';
import type { Transport } from './transport.ts';
/** RUNNING until it converges or is cancelled. An errored pass stays RUNNING: the source may recover. */
export type FillState = 'RUNNING' | 'DONE' | 'CANCELLED';
/**
 * Whether the run could say how much there was to do.
 *
 * UNKNOWN is not a failure and not zero. An open-catalog sweep has no denominator; nor does a
 * generative producer chasing survivors, a pushed aggregate answering in totals, or a pass whose
 * budget ran out before a group enumerated. Any one of those makes the whole run's total unknown.
 */
export type Totality = 'KNOWN' | 'UNKNOWN';
export interface KeyCoverage {
    /** Units — (producer, key, period) — this pass resolved. Always present. */
    keysResolved: number;
    /** Which question the pair can answer. Always present, and the discriminator to branch on. */
    totality: Totality;
    /** The denominator, when there is one. ABSENT means unknown, never zero. */
    keysTotal?: number;
    /** The server's own fraction, 0..1, and only where it has a denominator. */
    fractionResolved?: number;
}
export type FillTrend = 'UNKNOWN' | 'CONVERGING' | 'NOT_CONVERGING';
export interface FillProgress {
    state: FillState;
    /** The scheduler's heartbeat. Deliberately not shown to people: it is not progress. */
    ticks: number;
    liveCallsTotal: number;
    liveCallsLastTick: number;
    /**
     * What the LAST PASS measured. Each tick REPLACES these figures rather than adding to them, so
     * this is a reading, not a running total, and it can fall as well as rise.
     */
    coverage: KeyCoverage;
    /** Whether live calls per tick are trending to zero — the only progress signal when there is no denominator. */
    trend: FillTrend;
    /** The last pass's failure, if any. A fill with one is still RUNNING; the next tick retries. */
    lastError?: string | null;
    lastTickAt?: number | null;
    createdAt: number;
}
export interface Fill {
    id: string;
    userId: string;
    cypher: string;
    label: string;
    budgetPerTick: number;
    progress: FillProgress;
    /** Why this fill will poll rather than converge. Absent is the ordinary case. */
    warning?: string | null;
}
export interface StartFill {
    cypher: string;
    budgetPerTick?: number;
    label?: string;
}
export declare class FillsClient {
    private readonly transport;
    constructor(transport: Transport);
    /** The acting user's fills, newest first. */
    list(): Promise<Outcome<Fill[]>>;
    /** Start a sweep. The marker is durable immediately; the first chunk runs on the next tick. */
    start(request: StartFill): Promise<Outcome<Fill>>;
    /** Stop driving it. Completed work stays cached — nothing rolls back. */
    cancel(id: string): Promise<Outcome<void>>;
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
export declare function coveragePercent(coverage: KeyCoverage): number | null;
/**
 * Coverage in words, for a row a person reads.
 *
 * With a denominator it is a fraction and a percentage. Without one it is the count alone, saying
 * so — "4,182 assessed (total unknown)" is honest where "4,182 of 0" and a 0% bar are both lies.
 */
export declare function coverageWords(coverage: KeyCoverage): string;
/**
 * What a fill's state and trend mean together, as a sentence.
 *
 * The pairing is the point: a RUNNING fill that is NOT_CONVERGING is not stuck and has not failed —
 * its producers do not keep what they fetch, so every pass pays for the whole sweep again. That is
 * a permanent poller, which is a legitimate thing to have asked for and a different thing from
 * progress. `warning` says which producers; this says what it means.
 */
export declare function fillStatusWords(fill: Fill): string;
//# sourceMappingURL=fills.d.ts.map