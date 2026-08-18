import type { Outcome } from './outcome.ts';
import type { Transport } from './transport.ts';
export interface IngestedDocument {
    uri: string;
    title?: string | null;
    ingestedAt?: string | null;
    /** What this document was ingested under. The set of these across the listing IS the corpus list. */
    tags?: string[];
}
export interface DocumentList {
    documents: IngestedDocument[];
    totalChunks?: number;
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
     * Narrow to documents carrying this TAG — the corpus to ask.
     *
     * ACCEPTED BUT NOT YET HONOURED BY THE APPLIANCE, and the field is kept so that stays visible:
     * `PropertyFilter.HasElement` is not translatable by the store, so the server dropped its `tag`
     * parameter rather than narrow nothing on one retrieval path and fail the ask on the other. See
     * embabel/me#915. Sending it today is inert; when the operator lands, the server takes it and
     * nothing here changes.
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
export declare class DocumentsClient {
    private readonly transport;
    constructor(transport: Transport);
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
    upload(filename: string, bytes: ArrayBuffer | Uint8Array | Blob, tags?: string[]): Promise<Outcome<unknown>>;
    /** Ingest a web page by URL — the appliance fetches and converts it. */
    ingestUrl(url: string, tags?: string[]): Promise<Outcome<unknown>>;
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