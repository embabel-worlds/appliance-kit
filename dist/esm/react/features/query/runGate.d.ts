import type { KgValidation } from '../../../client/kg.ts';
import type { Outcome } from '../../../client/outcome.ts';
import type { Tone } from '../studio/chrome.tsx';
export type Verdict = 
/** Nothing to validate — an empty editor. */
{
    state: 'none';
}
/** A preflight is scheduled or in flight. */
 | {
    state: 'pending';
} | {
    state: 'valid';
    cypher: string;
} | {
    state: 'invalid';
    cypher: string;
    violations: string[];
}
/** The preflight was asked about `cypher` and did not answer it. `cause` is why, for the pill. */
 | {
    state: 'unverified';
    cypher: string;
    cause: string;
}
/** This appliance has no preflight, and will not grow one before the page is reloaded. */
 | {
    state: 'unsupported';
};
export interface RunGate {
    enabled: boolean;
    tone: Tone;
    text: string;
    violations: string[];
}
/** What one preflight answer means for `cypher`, the completed text it was asked about. */
export declare function verdictOf(cypher: string, outcome: Outcome<KgValidation>): Verdict;
/**
 * The gate for `cypher` — the COMPLETED text Run would execute — given the latest verdict.
 *
 * A verdict about other text is stale and decides nothing, so it holds Run as a pending one would:
 * every edit schedules a fresh preflight, and the pill reads "…" until it lands.
 */
export declare function runGate(verdict: Verdict, cypher: string | null | undefined, running: boolean): RunGate;
//# sourceMappingURL=runGate.d.ts.map