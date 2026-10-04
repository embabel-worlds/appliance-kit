import { type Outcome } from './outcome.ts';
import type { Transport } from './transport.ts';
export type RunKind = 'ROUTINE' | 'REPAIR' | 'DUTY_CHECK' | 'CONVERSATION' | 'TEST';
export type RunOutcome = 'RUNNING' | 'DONE' | 'FAILED' | 'TIMED_OUT' | 'SKIPPED';
export interface AgentRun {
    id: string;
    agent: string | null;
    agentVersion: number | null;
    work: string;
    kind: RunKind;
    /** `schedule`, `signal:<type>`, `repair:<duty>`, `message`, `test`, `on-demand`. */
    trigger: string;
    runAs: string;
    observing: boolean;
    startedAt: string;
    endedAt: string | null;
    outcome: RunOutcome;
    /** The tail of what it printed: its partial result, when it timed out. */
    output: string;
    error: string | null;
    requests: string[];
    violations: number | null;
    repairs: number | null;
    chain: string[];
    /** `agent:<name>@<world>`: the agent as a principal, apart from whose account it used. */
    principal: string | null;
    /** What its model calls cost, in US cents, and on which models. */
    spendCents?: number;
    spendByModel?: Record<string, number>;
}
/** One decision made on a run's behalf, chained to the one before it. */
export interface Receipt {
    id: string;
    seq: number;
    at: string;
    runId: string | null;
    agent: string | null;
    agentVersion: number | null;
    verb: string;
    /** `act`, `request`, `refused`, `approved`, `rejected`. */
    decision: string;
    rule: string;
    reason: string;
    entityKeys: string[];
    requestId: string | null;
    decidedBy: string | null;
    hash: string;
}
export interface RunDetail {
    run: AgentRun;
    receipts: Receipt[];
}
export interface Firing {
    job: string;
    /** `duty` or `routine`. */
    kind: string;
    work: string;
    cron: string;
    zone: string;
    nextAt: string | null;
    skipped: boolean;
    postponedTo: string | null;
}
export interface Upcoming {
    agent: string;
    firings: Firing[];
    onSignals: string[];
    expected: {
        duty: string;
        violations: number;
        lastCheckedAt: string | null;
    }[];
    inFlight: {
        runId: string;
        work: string;
        startedAt: string;
        deadline: string;
    }[];
    counts: {
        runsLastHour: number;
        writesToday: number;
        requestsToday: number;
    };
}
export interface ReceiptVerification {
    receipts: number;
    intact: boolean;
    brokenAt: number | null;
    why: string | null;
}
export declare class AgentRunsClient {
    private readonly transport;
    constructor(transport: Transport);
    runs(name: string, limit?: number): Promise<Outcome<AgentRun[]>>;
    run(name: string, id: string): Promise<Outcome<RunDetail>>;
    upcoming(name: string): Promise<Outcome<Upcoming>>;
    /** Skip the next firing of [job], or postpone it to [until]. */
    skip(name: string, job: string, reason: string, until?: string): Promise<Outcome<Upcoming>>;
    runNow(name: string, job: string): Promise<Outcome<Upcoming>>;
    verifyReceipts(): Promise<Outcome<ReceiptVerification>>;
    private change;
}
//# sourceMappingURL=agentRuns.d.ts.map