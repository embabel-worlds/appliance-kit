import type { ExecuteOptions, KgBackgroundHandle, KgQueryResult } from './kg.ts';
import { type Outcome } from './outcome.ts';
type Run = (cypher: string, options?: ExecuteOptions) => Promise<Outcome<KgQueryResult | KgBackgroundHandle>>;
/** An API a realm declared that the world skipped at load, and what would bring it back. */
export interface SkippedApi {
    name: string;
    reason: string;
    /** The secret or setting that unlocks it, when one does. */
    unlockedBy: string;
}
/** A signal type the world has seen, with the fields it carried. */
export interface SeenSignalType {
    typeName: string;
    fields: string[];
    count: number;
    lastSeen: string;
}
export interface WorldSkillRow {
    name: string;
    description: string;
}
/** A watch, in the shape the views surface lists. */
export interface WatchRow {
    id: string;
    lensId: string;
    name: string;
    cron: string | null;
    enabled: boolean;
    delivery: {
        channel: string;
    } | null;
}
export interface TagCountRow {
    tag: string;
    documents: number;
}
export declare const QUERIES: {
    readonly skippedApis: string;
    readonly signalTypes: string;
    readonly skills: string;
    readonly watches: string;
    readonly documentTags: "MATCH (d:Document) UNWIND d.tags AS tag RETURN tag, count(DISTINCT d) AS documents ORDER BY documents DESC, tag";
    readonly agentHolding: string;
};
export declare class WorldLists {
    private readonly run;
    constructor(run: Run);
    private rows;
    skippedApis(): Promise<Outcome<SkippedApi[]>>;
    signalTypes(): Promise<Outcome<SeenSignalType[]>>;
    skills(): Promise<Outcome<WorldSkillRow[]>>;
    watches(): Promise<Outcome<WatchRow[]>>;
    documentTags(): Promise<Outcome<TagCountRow[]>>;
    /** The agent that holds [routine], or null when none does. */
    agentHolding(routine: string): Promise<Outcome<string | null>>;
}
export {};
//# sourceMappingURL=worldLists.d.ts.map