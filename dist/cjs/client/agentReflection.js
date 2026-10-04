"use strict";
/*
 * REFLECTION (#1782): ask an agent how it would do its job better, read what it proposes with the
 * evidence for each change, and adopt it — never wider than it was signed — or dismiss it.
 *
 * A refusal is the server's own sentence, lifted out of a 409 as the agents client does.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgentReflectionClient = void 0;
const outcome_ts_1 = require("./outcome.js");
const AGENTS = '/api/v1/agents';
class AgentReflectionClient {
    transport;
    constructor(transport) {
        this.transport = transport;
    }
    reflect(name) {
        return this.decide(`${AGENTS}/${encodeURIComponent(name)}/reflect`);
    }
    proposals(name) {
        return this.transport.send({ method: 'GET', path: `${AGENTS}/${encodeURIComponent(name)}/proposals` });
    }
    adopt(name, id) {
        return this.decide(`${AGENTS}/${encodeURIComponent(name)}/proposals/${encodeURIComponent(id)}/adopt`);
    }
    dismiss(name, id) {
        return this.decide(`${AGENTS}/${encodeURIComponent(name)}/proposals/${encodeURIComponent(id)}/dismiss`);
    }
    async decide(path) {
        const outcome = await this.transport.send({ method: 'POST', path, body: {} });
        if (!outcome.ok) {
            const refused = outcome.body?.refused;
            return refused ? (0, outcome_ts_1.failure)('refused', refused, outcome.status, outcome.body) : outcome;
        }
        const proposal = outcome.value.proposal;
        return proposal ? { ok: true, value: proposal } : (0, outcome_ts_1.failure)('refused', outcome.value.refused ?? 'Refused', 200, outcome.value);
    }
}
exports.AgentReflectionClient = AgentReflectionClient;
//# sourceMappingURL=agentReflection.js.map