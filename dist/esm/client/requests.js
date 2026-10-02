import { failure } from "./outcome.js";
const REQUESTS = '/api/v1/requests';
export class RequestsClient {
    transport;
    constructor(transport) {
        this.transport = transport;
    }
    list() {
        return this.transport.send({ method: 'GET', path: REQUESTS });
    }
    get(id) {
        return this.transport.send({ method: 'GET', path: `${REQUESTS}/${encodeURIComponent(id)}` });
    }
    /** Approve: the appliance calls the request's verb as you. */
    approve(id) {
        return this.decide(id, { decision: 'approve' });
    }
    /** Reject, saying why. The appliance refuses a rejection without a reason. */
    reject(id, reason) {
        return this.decide(id, { decision: 'reject', reason });
    }
    async decide(id, body) {
        const outcome = await this.transport.send({
            method: 'POST',
            path: `${REQUESTS}/${encodeURIComponent(id)}/decision`,
            body,
        });
        if (!outcome.ok) {
            const refused = outcome.body?.refused;
            return refused ? failure('refused', refused, outcome.status, outcome.body) : outcome;
        }
        const request = outcome.value.request;
        return request ? { ok: true, value: request } : failure('refused', outcome.value.refused ?? 'Refused', 200, outcome.value);
    }
}
//# sourceMappingURL=requests.js.map