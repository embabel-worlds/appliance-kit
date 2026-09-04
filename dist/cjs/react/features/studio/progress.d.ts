import { type VcEvent } from '../../../vc/events.ts';
export interface ProgressLine {
    /** `seq` within the run, which is also a stable React key — the server guarantees monotonicity. */
    key: number;
    text: string;
    failed: boolean;
}
export interface RunProgress {
    lines: ProgressLine[];
    /** True between `begin()` and the run settling, so a surface can show the panel only while it means something. */
    live: boolean;
    /**
     * The bound run's id, once one has started — and the SAME id `POST /kg/kill/{runId}` takes, by
     * the server's own construction (`VirtualCypherRunRegistry`: "keyed by the SSE queryId … so the
     * trace a user is watching IS the kill target"). So a Stop button costs nothing beyond reading
     * what the trace already bound. Null before the first event of a run arrives.
     */
    runId: string | null;
    /**
     * Start listening. Call as the request goes out.
     *
     * With an `operationId`, only events carrying it are shown — the appliance echoes back the
     * `X-Embabel-Operation-Id` a caller sent, which is exact where binding to the first `query.started`
     * is a guess. `/documents/ask` accepts one; `/kg/execute` does not yet, which is why both modes
     * exist rather than one.
     */
    begin(operationId?: string): void;
    /** Stop listening and keep the lines, so the trace survives for reading after the rows land. */
    end(): void;
}
export declare function useRunProgress(subscribe: (onEvent: (event: VcEvent) => void, signal: AbortSignal) => void): RunProgress;
//# sourceMappingURL=progress.d.ts.map