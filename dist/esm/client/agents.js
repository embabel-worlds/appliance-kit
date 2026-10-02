import { failure } from "./outcome.js";
const AGENTS = '/api/v1/agents';
/* Its own path, not under agents, where it would shadow an agent of the same name. */
const HALT = '/api/v1/halt';
export class AgentsClient {
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
    /**
     * Check one duty now and run its repair on what it finds. Off duty it only observes, so this is
     * the test run a duty must pass before its agent goes on duty.
     */
    checkDuty(name, duty) {
        return this.transport.send({
            method: 'POST',
            path: `${AGENTS}/${encodeURIComponent(name)}/duties/${encodeURIComponent(duty)}/check`,
            body: {},
        });
    }
    /** Whether every agent in the world is stopped. */
    haltStatus() {
        return this.transport.send({ method: 'GET', path: HALT });
    }
    /** Stop every agent: nothing runs from the next tick, and a run already going is refused its writes. */
    halt(reason) {
        return this.transport.send({ method: 'POST', path: HALT, body: { reason } });
    }
    /** Lift the halt: every agent back at the stage it had. */
    resume() {
        return this.transport.send({ method: 'DELETE', path: HALT });
    }
    versions(name) {
        return this.transport.send({ method: 'GET', path: `${AGENTS}/${encodeURIComponent(name)}/versions` });
    }
    async agentOrRefusal(pending) {
        const outcome = await pending;
        if (!outcome.ok) {
            const refused = outcome.body?.refused;
            return refused ? failure('refused', refused, outcome.status, outcome.body) : outcome;
        }
        const agent = outcome.value.agent;
        return agent ? { ok: true, value: agent } : failure('refused', outcome.value.refused ?? 'Refused', 200, outcome.value);
    }
}
//# sourceMappingURL=agents.js.map