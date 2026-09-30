import { type Outcome } from './outcome.ts';
import type { Transport } from './transport.ts';
export type AgentStage = 'off' | 'observing' | 'on';
export type AgentState = 'draft' | 'submitted' | 'active' | 'suspended' | 'retired';
export interface AgentRoutine {
    name: string;
    description: string;
    trigger: string;
    /** The stage chosen for this routine, before the agent's standing applies. */
    stage: AgentStage;
    /** The stage dispatch honours. Lower than `stage` when the agent still needs something. */
    firing: AgentStage;
    /** Named by the agent but absent from the world. */
    missing: boolean;
}
export interface AgentDuty {
    name: string;
    text: string;
    holds: string;
    every: string | null;
    timezone: string | null;
    stage: AgentStage;
    status: string;
}
export interface Agent {
    name: string;
    job: string;
    routing: string;
    persona: string | null;
    sponsor: string | null;
    owners: string[];
    operators: string[];
    state: AgentState;
    stage: AgentStage;
    /** The latest signed version; 0 when never signed, or gathered from existing routines. */
    version: number;
    signedBy: string | null;
    signedAt: string | null;
    unsignedChanges: string[];
    /** "world", a realm's name, or "migrated" for routines gathered into an agent. */
    origin: string;
    routines: AgentRoutine[];
    duties: AgentDuty[];
    /** What it needs before it can go on duty; empty when it can. */
    needs: string[];
}
export interface AgentVersion {
    version: number;
    signedBy: string;
    signedAt: string;
    digest: string;
    routines: string[];
}
export declare class AgentsClient {
    private readonly transport;
    constructor(transport: Transport);
    list(): Promise<Outcome<Agent[]>>;
    get(name: string): Promise<Outcome<Agent>>;
    /** Move an agent, or one routine it holds, on the ladder. Lowering is always allowed. */
    setStage(name: string, stage: AgentStage, routine?: string): Promise<Outcome<Agent>>;
    /** Sign the agent as it stands now, as its next version. */
    sign(name: string): Promise<Outcome<Agent>>;
    versions(name: string): Promise<Outcome<AgentVersion[]>>;
    private agentOrRefusal;
}
//# sourceMappingURL=agents.d.ts.map