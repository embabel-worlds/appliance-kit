import { type FollowIngestOptions, type IngestJob, type IngestJobList, type IngestResult } from './ingests.ts';
import type { Outcome } from './outcome.ts';
import type { Transport } from './transport.ts';
/**
 * AN HOUR, BECAUSE THE REQUEST COVERS THE QUEUE AS WELL AS THE WORK.
 *
 * An ingest request stays open until the document is converted, chunked and embedded, and the
 * appliance admits ingests against a heap budget (embabel/me#1681): on a small machine a large book
 * needs the whole budget and runs alone, and everything sent alongside it waits, with no deadline
 * of its own on the server. The console sends three at a time, so one request can be waiting behind
 * two whole ingests before its own starts. Five minutes covered the work of one file and not the
 * wait, and a file waiting its turn was reported as failed (appliance-kit#16).
 *
 * An hour is the ceiling the console already has: its nginx gives `/api/` a one-hour
 * `proxy_read_timeout`, so a longer wait here would be cut by the proxy anyway. It still ends: a
 * request that is genuinely stuck is failed, just not one that is queued.
 */
export declare const DEFAULT_INGEST_TIMEOUT_MS = 3600000;
export interface IngestedDocument {
    uri: string;
    title?: string | null;
    ingestedAt?: string | null;
    /** What this document was ingested under. The set of these across the listing IS the corpus list. */
    tags?: string[];
    /** How many chunks the document holds. Absent from an older appliance. */
    chunks?: number | null;
    /**
     * How many of those chunks have no embedding, and so never come back from a semantic search. Zero
     * for a complete document; above zero, {@link DocumentsClient.startEmbedMissing} repairs it.
     */
    chunksWithoutEmbeddings?: number | null;
}
export interface DocumentList {
    documents: IngestedDocument[];
    totalChunks?: number;
}
/** What a retag left on the document: the list as the appliance stored it, trimmed and deduplicated. */
export interface TagsResult {
    status: 'tagged';
    uri: string;
    tags: string[];
}
/**
 * WHICH DATE, AND WHOSE.
 *
 * `modified` and `created` are the DOCUMENT'S own dates — when the file was last changed, when it
 * was written. `ingested` is when this appliance happened to see it, which is a fact about the
 * appliance and not about the document. They are offered separately because filtering "changed
 * last week" by ingestion time answers a different question and looks like the same one.
 *
 * A document whose source never carried the chosen date is EXCLUDED by a date filter rather than
 * guessed at.
 */
export type DateField = 'modified' | 'created' | 'ingested';
export interface AskRequest {
    question: string;
    /**
     * Narrow to documents carrying this TAG — the corpus to ask. The appliance applies it on both
     * retrieval paths, the composed answer and sources-only, as a membership test on each chunk's
     * tags (embabel/me#915).
     *
     * One tag rather than a set, matching what the server will do: its two retrieval paths combine
     * predicates differently, so a list would mean "all of these" on one and could mean "any of
     * these" on the other, and a filter whose meaning depends on whether an LLM was involved is
     * worse than none.
     */
    tag?: string;
    dateField?: DateField;
    /** ISO date, inclusive. */
    from?: string;
    to?: string;
    /** How many documents to retrieve. The server's own default applies when absent. */
    topK?: number;
    history?: Array<{
        role: string;
        content: string;
    }>;
}
export interface Citation {
    uri?: string | null;
    title?: string | null;
    quote?: string | null;
    [key: string]: unknown;
}
export interface Answer {
    /** The prose, as markdown. Null when the model produced none — `note` then says why. */
    answer: string | null;
    /** The appliance's explanation for a missing or partial answer, when it can give one. */
    note: string | null;
    /** Citations the model made that could not be tied back to a retrieved document. */
    unresolvedCitations: number;
    /** The filters actually applied, which is not always what was asked for. */
    filters: Record<string, unknown>;
    sources: Citation[];
}
/** Per-client settings. */
export interface DocumentsClientOptions {
    /** How long an ingest may stay open, queue included. Defaults to {@link DEFAULT_INGEST_TIMEOUT_MS}. */
    ingestTimeoutMs?: number;
}
/** Per-call settings for `upload` and `ingestUrl`. */
export interface IngestOptions {
    /** Overrides the client's ingest timeout for this one request. */
    timeoutMs?: number;
}
export declare class DocumentsClient {
    private readonly transport;
    private readonly ingestTimeoutMs;
    constructor(transport: Transport, options?: DocumentsClientOptions);
    /** Everything ingested, with the chunk total the graph holds for it. */
    list(): Promise<Outcome<DocumentList>>;
    /**
     * Ingest one file: converted, chunked, embedded, answerable once it lands.
     *
     * BYTES, NOT A `File`. The console has a `File` from an `<input>`; the Me app has an
     * `ArrayBuffer` that crossed an IPC bridge, because no file PATH may cross it and a `File` is not
     * structured-cloneable in the shape that matters. Bytes plus a name is the intersection, so one
     * method serves both rather than the Me app keeping a private upload path.
     */
    upload(filename: string, bytes: ArrayBuffer | Uint8Array | Blob, tags?: string[], options?: IngestOptions): Promise<Outcome<unknown>>;
    /**
     * Start ingesting one file and return at once with the JOB, which {@link followIngest} follows
     * to its end. Prefer this to {@link upload}: it has no deadline to guess, and it says where the
     * document has got.
     *
     * An appliance older than ingest jobs answers `unsupported` — fall back to {@link upload} there.
     */
    startUpload(filename: string, bytes: ArrayBuffer | Uint8Array | Blob, tags?: string[]): Promise<Outcome<IngestJob>>;
    /** {@link startUpload} for a web page: the appliance fetches it as part of the job. */
    startIngestUrl(url: string, tags?: string[]): Promise<Outcome<IngestJob>>;
    /**
     * Embed the chunks of an already-ingested document that have no embedding, without re-ingesting
     * it. Answers at once with a JOB, followed like any other ingest; on success the job's
     * `chunksWithoutEmbeddings` says how many are still missing, which is zero when the repair took.
     *
     * A document the caller's world does not hold is `refused` with status 404. An appliance with
     * nothing to embed with is `refused` with status 409; its reason is in the body's `message`.
     */
    startEmbedMissing(uri: string): Promise<Outcome<IngestJob>>;
    /**
     * The caller's ingest jobs, newest first: the ones still running and the ones that ended within
     * the appliance's retention window. This is how a client that was closed mid-batch finds its
     * batch again — the jobs outlive the page that started them.
     *
     * An appliance older than ingest jobs answers `unsupported`.
     */
    listIngests(): Promise<Outcome<IngestJobList>>;
    /**
     * Where one job has got. A job the appliance does not know — it restarted since, or never had
     * it — is `refused` with status 404, which is what {@link followIngest} reports as `lost`.
     */
    ingestJob(id: string): Promise<Outcome<IngestJob>>;
    /**
     * Follow a job until the appliance says it ended, or no longer knows it. No deadline: see
     * `ingests.ts` for why, and for what `stalled` does and does not mean.
     */
    followIngest(id: string, options?: FollowIngestOptions): Promise<IngestResult>;
    /**
     * Replace a document's tags, on the document and every chunk, without re-ingesting it. The list
     * REPLACES what was there; an empty list removes every tag. `not_found` when the caller's world
     * holds no document at `uri`.
     */
    setTags(uri: string, tags: string[]): Promise<Outcome<TagsResult>>;
    /** Remove a document and everything ingested from it — chunks, figures — from the caller's world. */
    remove(uri: string): Promise<Outcome<unknown>>;
    /** Ingest a web page by URL — the appliance fetches and converts it. */
    ingestUrl(url: string, tags?: string[], options?: IngestOptions): Promise<Outcome<unknown>>;
    private ingestDeadline;
    /**
     * Ask the ingested documents, with citations.
     *
     * `operationId` is how a surface narrates its OWN retrieval. The progress stream
     * (`GET /api/v1/virtual-cypher/events`) is per-USER, so every window of every app signed in as
     * this user sees every event; the appliance echoes this header back on each `retrieval.step`, and
     * a client that supplies one can ignore everything that is not its own. Without it, asking a
     * question in one window narrates into another.
     *
     * Empty strings are dropped rather than sent: `from: ''` is not a filter, and a server that reads
     * it as one would exclude every document.
     */
    ask(request: AskRequest, options?: {
        operationId?: string;
    }): Promise<Outcome<Answer>>;
}
/**
 * A correlation id for one ask, unique enough for the job it does: telling this window's retrieval
 * steps from another window's in a shared stream. Not a security boundary — the stream is already
 * scoped to the user — so a timestamp and some randomness is the whole requirement.
 */
export declare function newOperationId(prefix?: string): string;
//# sourceMappingURL=documents.d.ts.map