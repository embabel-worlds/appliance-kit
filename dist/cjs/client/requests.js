"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RequestsClient = void 0;
const outcome_ts_1 = require("./outcome.js");
const REQUESTS = '/api/v1/requests';
class RequestsClient {
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
            return refused ? (0, outcome_ts_1.failure)('refused', refused, outcome.status, outcome.body) : outcome;
        }
        const request = outcome.value.request;
        return request ? { ok: true, value: request } : (0, outcome_ts_1.failure)('refused', outcome.value.refused ?? 'Refused', 200, outcome.value);
    }
}
exports.RequestsClient = RequestsClient;
//# sourceMappingURL=requests.js.map