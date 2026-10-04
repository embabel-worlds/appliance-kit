import type { Outcome } from './outcome.ts';
import type { Transport } from './transport.ts';
export interface AgentSlots {
    agent: string;
    secrets: string[];
}
export interface Retired {
    agent: string;
    keysRevoked: number;
    slotsDeleted: number;
}
export declare class AgentAccountsClient {
    private readonly transport;
    constructor(transport: Transport);
    list(name: string): Promise<Outcome<AgentSlots>>;
    set(name: string, secret: string, value: string): Promise<Outcome<AgentSlots>>;
    remove(name: string, secret: string): Promise<Outcome<AgentSlots>>;
    retire(name: string, reason: string): Promise<Outcome<Retired>>;
}
//# sourceMappingURL=agentAccounts.d.ts.map