import { type Outcome } from './outcome.ts';
import type { Transport } from './transport.ts';
export interface ProposalChange {
    /** `job`, `routing`, `persona`, `duty:<name>:text`, `duty:<name>:every` or `add-duty`. */
    target: string;
    from: string | null;
    to: string;
    why: string;
    evidence: string;
    duty: {
        name: string;
        text: string;
        holds: string;
        every: string | null;
    } | null;
}
export interface AgentProposal {
    id: string;
    agent: string;
    fromVersion: number | null;
    summary: string;
    changes: ProposalChange[];
    /** What the agent's record said, as the reflection read it. */
    record: string;
    status: 'OPEN' | 'ADOPTED' | 'DISMISSED';
    /** False until a battery and a replay can prove it; nothing proves one yet. */
    proven: boolean;
    createdAt: string;
    decidedAt: string | null;
    refused: string | null;
}
export declare class AgentReflectionClient {
    private readonly transport;
    constructor(transport: Transport);
    reflect(name: string): Promise<Outcome<AgentProposal>>;
    proposals(name: string): Promise<Outcome<AgentProposal[]>>;
    adopt(name: string, id: string): Promise<Outcome<AgentProposal>>;
    dismiss(name: string, id: string): Promise<Outcome<AgentProposal>>;
    private decide;
}
//# sourceMappingURL=agentReflection.d.ts.map