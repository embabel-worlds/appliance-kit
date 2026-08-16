import { type AnchorId, type Mode, type TargetId } from './targets.ts';
export interface AiSteering {
    hint?: string;
    model?: string;
    temperature?: number | string;
    confidence?: number | string;
    fresh?: boolean;
}
export interface ComposeSpec {
    target: TargetId;
    /** The anchor's value. Each target supplies its own default wording when absent. */
    seed?: string;
    mode?: Mode;
    /** Threads only. Defaults to `topic`. */
    anchor?: AnchorId;
    /** The brief a judged retrieval scores against. Judged mode only. */
    intent?: string;
    tag?: string;
    dateField?: string;
    dateFrom?: string;
    dateTo?: string;
    /** Blank means "no floor" — and `0` is a real floor, not a blank. */
    minScore?: number | string;
    limit?: number | string;
    ai?: AiSteering;
}
/**
 * The teaching that used to trail composed queries as comment lines, per
 * target — for a surface's Tips affordance. Same knowledge, moved: a tip in
 * the query text made a three-line query read as complex, and it was gone the
 * moment the user composed again.
 */
export declare const TIPS: Record<TargetId, string[]>;
/** Compose the query a spec describes. */
export declare function compose(spec: ComposeSpec): string;
//# sourceMappingURL=compose.d.ts.map