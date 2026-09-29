import type { Failure, Outcome } from './outcome.ts';
export type IngestJobState = 'queued'
/** Admitted in principle, waiting for the ingest heap budget to have room (embabel/me#1681). */
 | 'waiting_for_memory' | 'converting' | 'embedding' | 'writing' | 'succeeded' | 'failed';
export interface IngestJob {
    id: string;
    /** The filename or URL this job is ingesting — what a person recognises it by. */
    name: string;
    state: IngestJobState;
    /** Units done of a known total, for a stage that has one (embedding counts chunks). Null otherwise. */
    progress: {
        done: number;
        total: number;
    } | null;
    /** Set once the appliance knows it — the stored document's identity. */
    uri?: string | null;
    title?: string | null;
    /** The appliance's own sentence for why a `failed` job failed. */
    error?: string | null;
    /**
     * On a `succeeded` job, how many chunks the document was cut into, and how many of those could
     * not be embedded. A document with chunks it could not embed is still ingested — it is kept, not
     * failed — but those chunks miss semantic search, so a client should say so rather than draw it
     * as done. {@link DocumentsClient.startEmbedMissing} embeds them. Absent from an older appliance.
     */
    chunks?: number | null;
    chunksWithoutEmbeddings?: number | null;
    /**
     * How many appliance restarts this job has survived: it was picked up again, under the same id,
     * and may have gone back to an earlier stage. Absent from an appliance that does not keep jobs
     * across a restart — there a restart makes the job `lost` instead.
     */
    resumes?: number;
    startedAt: string;
    /** When the appliance last saw this job move: a stage change or a progress tick. */
    updatedAt: string;
}
/** How a followed ingest ended. Never an exception: a lost job is an answer, not an error. */
export type IngestResult = {
    outcome: 'succeeded';
    job: IngestJob;
} | {
    outcome: 'failed';
    job: IngestJob;
}
/**
 * The appliance no longer knows the job — it restarted, or never had it. Whether the document
 * landed is then unknown, which is why this is not reported as a failure: check the listing
 * before sending it again.
 */
 | {
    outcome: 'lost';
    id: string;
    message: string;
    last: IngestJob | null;
}
/** The caller stopped following. The job itself carries on in the appliance. */
 | {
    outcome: 'aborted';
    id: string;
    last: IngestJob | null;
};
/** One observation while following, for a caller drawing a progress row. */
export interface IngestFollowUpdate {
    /** The newest state the appliance reported. Null until the first poll answers. */
    job: IngestJob | null;
    /**
     * Why the latest poll got no answer about the job — unreachable, a 5xx, or a lapsed sign-in — when
     * it did not. Cleared by the next answer.
     */
    unreachable: Failure | null;
    /** Nothing has moved for `stalledAfterMs`. Informational: following carries on. */
    stalled: boolean;
    /**
     * The appliance restarted while this was being followed and picked the job up again: its
     * `resumes` rose since following began. Stays true once seen, so a row can keep saying so.
     */
    resumed: boolean;
}
export interface FollowIngestOptions {
    onUpdate?: (update: IngestFollowUpdate) => void;
    signal?: AbortSignal;
    /** Between polls while the appliance answers. */
    pollMs?: number;
    /** How long a job may go unchanged before it is reported `stalled`. */
    stalledAfterMs?: number;
}
export declare const DEFAULT_INGEST_POLL_MS = 2000;
/** Ten minutes: longer than any single stage a large book has been measured to sit in without a tick. */
export declare const DEFAULT_INGEST_STALLED_AFTER_MS = 600000;
/** Follow job `id` through `read` until it ends. See the file comment for what ends it. */
export declare function followIngest(id: string, read: (id: string) => Promise<Outcome<IngestJob>>, options?: FollowIngestOptions): Promise<IngestResult>;
//# sourceMappingURL=ingests.d.ts.map