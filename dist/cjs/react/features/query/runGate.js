"use strict";
/*
 * WHEN QUERY STUDIO'S RUN BUTTON MAY BE PRESSED, and what the pill beside the editor says about it.
 *
 * The preflight is a courtesy: it tells you, before you pay for a run, that the schema contradicts
 * what you wrote. Only that — a VERDICT of `ok: false` — may hold Run back. A preflight that could
 * not reach a verdict (no such endpoint, a lapsed or non-admin session, an unreachable or failing
 * appliance) knows nothing about the query, and reading its silence as a "no" left a dead Run
 * button beside a blank pill — permanently, once a 404 had switched validation off. So those FAIL
 * OPEN: Run goes to the engine, and the run reports whatever the engine finds wrong. The Me app has
 * always worked this way; it gates Run on nothing but a run already in flight.
 *
 * Kept apart from the component so the rule can be tested without a DOM.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.verdictOf = verdictOf;
exports.runGate = runGate;
/** What one preflight answer means for `cypher`, the completed text it was asked about. */
function verdictOf(cypher, outcome) {
    if (!outcome.ok) {
        if (outcome.kind === 'unsupported')
            return { state: 'unsupported' };
        /* The status and the server's own words, because "couldn't validate" alone sends someone
         * hunting for a cause the outcome already had. */
        const cause = [outcome.status === undefined ? '' : `HTTP ${outcome.status}`, outcome.message]
            .filter((part) => part && part.trim()).join(': ');
        return { state: 'unverified', cypher, cause: cause || outcome.kind };
    }
    /* `ok` IS the verdict on this endpoint — "this cypher passes the preflight", not "the request
     * worked". The handlers surface next door splits those into two booleans; this one does not,
     * and reading it as a transport result would call every rejected query valid. */
    const { ok: valid, violations = [] } = outcome.value;
    return valid ? { state: 'valid', cypher } : { state: 'invalid', cypher, violations };
}
const ASK_THE_ENGINE = 'Run will ask the engine directly';
/**
 * The gate for `cypher` — the COMPLETED text Run would execute — given the latest verdict.
 *
 * A verdict about other text is stale and decides nothing, so it holds Run as a pending one would:
 * every edit schedules a fresh preflight, and the pill reads "…" until it lands.
 */
function runGate(verdict, cypher, running) {
    const quiet = { tone: null, text: '', violations: [] };
    const open = !running && !!cypher;
    switch (verdict.state) {
        case 'none':
            return { enabled: false, ...quiet };
        case 'pending':
            return { enabled: false, ...quiet, text: '…' };
        case 'valid':
            return verdict.cypher === cypher
                ? { enabled: open, tone: 'ok', text: '✓ schema-valid', violations: [] }
                : { enabled: false, ...quiet, text: '…' };
        case 'invalid':
            return verdict.cypher === cypher
                ? { enabled: false, tone: 'error', text: `${verdict.violations.length} schema problem(s)`, violations: verdict.violations }
                : { enabled: false, ...quiet, text: '…' };
        case 'unverified':
            return verdict.cypher === cypher
                ? { enabled: open, tone: 'caution', text: `couldn't validate (${verdict.cause}) — ${ASK_THE_ENGINE}`, violations: [] }
                : { enabled: false, ...quiet, text: '…' };
        /* Neutral rather than caution: nothing went wrong, the feature is simply absent, and a warning
         * colour on every query would be a nag about a version. It is still said, once, in the pill —
         * a Run button with no account of why nothing was checked is the defect this gate exists for. */
        case 'unsupported':
            return { enabled: open, tone: null, text: `not validated — this appliance has no preflight; ${ASK_THE_ENGINE}`, violations: [] };
    }
}
//# sourceMappingURL=runGate.js.map