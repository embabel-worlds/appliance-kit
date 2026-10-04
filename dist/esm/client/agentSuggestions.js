/*
 * SUGGESTED COLLEAGUES (#1778): what the scout-agents skill found worth hiring, with the evidence it
 * counted, and the person's decision on each — draft it, adopt the realm agent that already does the
 * work, or dismiss it.
 *
 * A refusal is the server's own sentence, lifted out of a 409 the way the agents client lifts one.
 */
import { failure } from "./outcome.js";
/* Its own path: under agents it would collide with the agent of that name. */
const SUGGESTIONS = '/api/v1/agent-suggestions';
export class AgentSuggestionsClient {
    transport;
    constructor(transport) {
        this.transport = transport;
    }
    list() {
        return this.transport.send({ method: 'GET', path: SUGGESTIONS });
    }
    /** Write the suggested agent into the world, unsigned and off duty, and see what it would act on. */
    draft(id) {
        return this.decide(id, 'draft');
    }
    /** The realm agent it names was taken on from its card: the suggestion is settled. */
    adopted(id) {
        return this.decide(id, 'adopted');
    }
    dismiss(id) {
        return this.decide(id, 'dismiss');
    }
    async decide(id, decision) {
        const outcome = await this.transport.send({
            method: 'POST',
            path: `${SUGGESTIONS}/${encodeURIComponent(id)}/${decision}`,
            body: {},
        });
        if (!outcome.ok) {
            const refused = outcome.body?.refused;
            return refused ? failure('refused', refused, outcome.status, outcome.body) : outcome;
        }
        const suggestion = outcome.value.suggestion;
        return suggestion ? { ok: true, value: suggestion } : failure('refused', outcome.value.refused ?? 'Refused', 200, outcome.value);
    }
}
//# sourceMappingURL=agentSuggestions.js.map