/*
 * WHAT AN AGENT DID AND WILL DO (#1781): its runs with a receipt for every decision made on each
 * one's behalf, and its upcoming work — when each scheduled check and routine fires next, with a
 * person's say over any one firing: skip it, postpone it, or run it now.
 *
 * A refusal is the server's own sentence, lifted out of a 409 as the agents client does.
 */
import { failure } from "./outcome.js";
const AGENTS = '/api/v1/agents';
export class AgentRunsClient {
    transport;
    constructor(transport) {
        this.transport = transport;
    }
    runs(name, limit) {
        return this.transport.send({
            method: 'GET',
            path: `${AGENTS}/${encodeURIComponent(name)}/runs`,
            ...(limit ? { query: { limit: String(limit) } } : {}),
        });
    }
    run(name, id) {
        return this.transport.send({ method: 'GET', path: `${AGENTS}/${encodeURIComponent(name)}/runs/${encodeURIComponent(id)}` });
    }
    upcoming(name) {
        return this.transport.send({ method: 'GET', path: `${AGENTS}/${encodeURIComponent(name)}/upcoming` });
    }
    /** Skip the next firing of [job], or postpone it to [until]. */
    skip(name, job, reason, until) {
        return this.change(name, 'skip', until ? { job, reason, until } : { job, reason });
    }
    runNow(name, job) {
        return this.change(name, 'run', { job });
    }
    verifyReceipts() {
        return this.transport.send({ method: 'GET', path: '/api/v1/receipts/verify' });
    }
    async change(name, act, body) {
        const outcome = await this.transport.send({
            method: 'POST', path: `${AGENTS}/${encodeURIComponent(name)}/upcoming/${act}`, body,
        });
        if (!outcome.ok) {
            const refused = outcome.body?.refused;
            return refused ? failure('refused', refused, outcome.status, outcome.body) : outcome;
        }
        const upcoming = outcome.value.upcoming;
        return upcoming ? { ok: true, value: upcoming } : failure('refused', outcome.value.refused ?? 'Refused', 200, outcome.value);
    }
}
//# sourceMappingURL=agentRuns.js.map