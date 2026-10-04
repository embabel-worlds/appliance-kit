/*
 * AN AGENT'S OWN ACCOUNTS, AND RETIRING IT (#1783): the secrets it calls an API with when its identity
 * there is its own account — by name, never by value — and retiring it, which is final: off duty for
 * good, every key that may talk to it revoked, every credential of its own deleted.
 */
const AGENTS = '/api/v1/agents';
export class AgentAccountsClient {
    transport;
    constructor(transport) {
        this.transport = transport;
    }
    list(name) {
        return this.transport.send({ method: 'GET', path: `${AGENTS}/${encodeURIComponent(name)}/accounts` });
    }
    set(name, secret, value) {
        return this.transport.send({
            method: 'PUT', path: `${AGENTS}/${encodeURIComponent(name)}/accounts/${encodeURIComponent(secret)}`, body: { value },
        });
    }
    remove(name, secret) {
        return this.transport.send({ method: 'DELETE', path: `${AGENTS}/${encodeURIComponent(name)}/accounts/${encodeURIComponent(secret)}` });
    }
    retire(name, reason) {
        return this.transport.send({ method: 'POST', path: `${AGENTS}/${encodeURIComponent(name)}/retire`, body: { reason } });
    }
}
//# sourceMappingURL=agentAccounts.js.map