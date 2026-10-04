import { type Outcome } from './outcome.ts';
import type { Transport } from './transport.ts';
export type SuggestionKind = 'WORKS' | 'TALKS';
export type SuggestionStatus = 'OPEN' | 'DRAFTED' | 'ADOPTED' | 'DISMISSED';
/** One piece of evidence, with the query that counted it so it can be run again. */
export interface SuggestionEvidence {
    summary: string;
    count: number;
    period: string;
    query: string | null;
    sample: Record<string, unknown>[];
}
export interface AgentSuggestion {
    id: string;
    name: string;
    job: string;
    kind: SuggestionKind;
    /** The installed realm agent that already does this work; null when a new one is drafted. */
    adopt: string | null;
    /** What [adopt] does not cover; null when it covers all of it. */
    uncovered: string | null;
    /** The definition a draft would write, in the agents/ YAML shape; null when adopting. */
    agent: Record<string, unknown> | null;
    evidence: SuggestionEvidence[];
    feasibility: string;
    rank: number;
    status: SuggestionStatus;
    createdAt: string;
    decidedAt: string | null;
    /** What the draft would act on today, one line per duty, once drafted. */
    preview: string[];
}
export declare class AgentSuggestionsClient {
    private readonly transport;
    constructor(transport: Transport);
    list(): Promise<Outcome<AgentSuggestion[]>>;
    /** Write the suggested agent into the world, unsigned and off duty, and see what it would act on. */
    draft(id: string): Promise<Outcome<AgentSuggestion>>;
    /** The realm agent it names was taken on from its card: the suggestion is settled. */
    adopted(id: string): Promise<Outcome<AgentSuggestion>>;
    dismiss(id: string): Promise<Outcome<AgentSuggestion>>;
    private decide;
}
//# sourceMappingURL=agentSuggestions.d.ts.map