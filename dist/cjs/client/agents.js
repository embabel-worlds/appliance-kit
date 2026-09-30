"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgentsClient = void 0;
const outcome_ts_1 = require("./outcome.js");
const AGENTS = '/api/v1/agents';
class AgentsClient {
    transport;
    constructor(transport) {
        this.transport = transport;
    }
    list() {
        return this.transport.send({ method: 'GET', path: AGENTS });
    }
    get(name) {
        return this.transport.send({ method: 'GET', path: `${AGENTS}/${encodeURIComponent(name)}` });
    }
    /** Move an agent, or one routine it holds, on the ladder. Lowering is always allowed. */
    setStage(name, stage, routine) {
        return this.agentOrRefusal(this.transport.send({
            method: 'POST',
            path: `${AGENTS}/${encodeURIComponent(name)}/stage`,
            body: routine ? { stage, routine } : { stage },
        }));
    }
    /** Sign the agent as it stands now, as its next version. */
    sign(name) {
        return this.agentOrRefusal(this.transport.send({ method: 'POST', path: `${AGENTS}/${encodeURIComponent(name)}/sign`, body: {} }));
    }
    versions(name) {
        return this.transport.send({ method: 'GET', path: `${AGENTS}/${encodeURIComponent(name)}/versions` });
    }
    async agentOrRefusal(pending) {
        const outcome = await pending;
        if (!outcome.ok) {
            const refused = outcome.body?.refused;
            return refused ? (0, outcome_ts_1.failure)('refused', refused, outcome.status, outcome.body) : outcome;
        }
        const agent = outcome.value.agent;
        return agent ? { ok: true, value: agent } : (0, outcome_ts_1.failure)('refused', outcome.value.refused ?? 'Refused', 200, outcome.value);
    }
}
exports.AgentsClient = AgentsClient;
//# sourceMappingURL=agents.js.map