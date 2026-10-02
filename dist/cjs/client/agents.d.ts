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
export type DutyState = 'upheld' | 'lapsed' | 'neglected' | 'unknown';
export interface AgentDuty {
    name: string;
    text: string;
    holds: string;
    every: string | null;
    timezone: string | null;
    stage: AgentStage;
    /** The latest check, in words: "upheld", "lapsed since …", "unknown: …", or "not checked yet". */
    status: string;
    state?: DutyState | null;
    lapsedSince?: string | null;
    checkedAt?: string | null;
    violations?: number;
    reason?: string | null;
    /** When it last passed a test run, and of which signed version. Going on duty needs the current one. */
    testedAt?: string | null;
    testedVersion?: number | null;
}
/** What one check of a duty found, and what its repair did or would have done. */
export interface DutyCheck {
    agent: string;
    duty: string;
    state: DutyState;
    lapsedSince: string | null;
    checkedAt: string;
    violations: number;
    reason: string | null;
    repaired: number;
    repairFailures: number;
    wouldHaveCalled: string[];
    onDemand: boolean;
    agentVersion: number | null;
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
/** The world's kill switch: whether every agent is stopped, by whom, when and why. */
export interface Halt {
    halted: boolean;
    by: string | null;
    at: string | null;
    reason: string | null;
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
    /**
     * Check one duty now and run its repair on what it finds. Off duty it only observes, so this is
     * the test run a duty must pass before its agent goes on duty.
     */
    checkDuty(name: string, duty: string): Promise<Outcome<DutyCheck>>;
    /** Whether every agent in the world is stopped. */
    haltStatus(): Promise<Outcome<Halt>>;
    /** Stop every agent: nothing runs from the next tick, and a run already going is refused its writes. */
    halt(reason: string): Promise<Outcome<Halt>>;
    /** Lift the halt: every agent back at the stage it had. */
    resume(): Promise<Outcome<Halt>>;
    versions(name: string): Promise<Outcome<AgentVersion[]>>;
    private agentOrRefusal;
}
//# sourceMappingURL=agents.d.ts.map