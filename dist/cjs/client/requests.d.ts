import { type Outcome } from './outcome.ts';
import type { Transport } from './transport.ts';
export type RequestStatus = 'PENDING' | 'APPROVED' | 'FAILED' | 'REJECTED' | 'EXPIRED';
export interface AgentRequest {
    id: string;
    ownerId: string;
    /** The routine that asked, and the run it asked from. */
    routine: string;
    /** The agent whose work that was: who is asking, as an approver reads it. Absent on older appliances. */
    agent?: string | null;
    runId: string | null;
    /** The gateway verb approving it calls, e.g. `odoo_partnerMessagePost`. */
    verb: string;
    /** The verb's input, as JSON text. */
    args: string;
    /** What would happen and why, in the business's words — what an approver reads first. */
    detail: string;
    /** The text it would write where people read it (a note, a message), as it would land. */
    quote?: string | null;
    /** Whom it is about, by name — the customer a note goes on — when the call said. */
    about?: string | null;
    /** The rows the routine saw when it asked. */
    evidence: Record<string, unknown>[];
    status: RequestStatus;
    raisedAt: string;
    expiresAt: string;
    decidedAt: string | null;
    decidedBy: string | null;
    reason: string | null;
    /** What the verb answered, once approved. */
    result: string | null;
    /**
     * What the routine had read, before it asked, that people outside the business wrote — each as
     * `source: what`. Such text can carry instructions meant for whoever reads it. Absent on older
     * appliances.
     */
    untrusted?: string[];
}
export declare class RequestsClient {
    private readonly transport;
    constructor(transport: Transport);
    list(): Promise<Outcome<AgentRequest[]>>;
    get(id: string): Promise<Outcome<AgentRequest>>;
    /** Approve: the appliance calls the request's verb as you. */
    approve(id: string): Promise<Outcome<AgentRequest>>;
    /** Reject, saying why. The appliance refuses a rejection without a reason. */
    reject(id: string, reason: string): Promise<Outcome<AgentRequest>>;
    private decide;
}
//# sourceMappingURL=requests.d.ts.map