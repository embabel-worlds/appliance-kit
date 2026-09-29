import { followIngest } from "./ingests.js";
/*
 * THE DOCUMENTS SURFACE — listing, ingesting, retagging, removing, and asking.
 *
 * THESE TYPES ARE HAND-WRITTEN, WHICH IS NOT THE RULE HERE. `kg.ts` and `handlers.ts` take every
 * type from `generated/openapi.ts`, because the assistant's contract test guards those prefixes and
 * a hand-typed shape there would be a guess wearing a type's clothes. `/api/v1/documents` is not in
 * the generated spec at all, so there is nothing to generate from. The shapes below are read off
 * the Me app's `api.ts`/`documents.ts`, which have been calling these endpoints in production for
 * a while — the same justification `vc/events.ts` carries, and the same standing invitation: the
 * day the server publishes these in its guarded surface, delete this and regenerate.
 *
 * WHY THIS EXISTS AT ALL. Me has a Documents TAB — ask, with citations you can open, and a drop
 * zone that ingests. The Worlds console had a card in the corner of another page that could list
 * and upload but never ask. The half that was missing is the half that matters, and rebuilding it
 * from a second reading of the endpoints is how two front ends end up disagreeing about what a
 * date filter means. So it is written once, here.
 */
const DOCS = '/api/v1/documents';
/** Retrieval and answering run a bounded LLM loop; three minutes is not a hang. */
const ASK_TIMEOUT_MS = 180_000;
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
export const DEFAULT_INGEST_TIMEOUT_MS = 3_600_000;
const INGESTS = `${DOCS}/ingests`;
/**
 * Starting an ingest job returns once the appliance HAS the document — the file saved, the URL
 * recorded — not once it has read it. Two minutes is for the bytes: a 50 MB upload over a slow link.
 */
const START_INGEST_TIMEOUT_MS = 120_000;
/** `3_600_000` reads as "60 min", `90_000` as "90 s": a person reads this, not a log parser. */
function duration(ms) {
    if (ms >= 60_000 && ms % 60_000 === 0)
        return `${ms / 60_000} min`;
    if (ms >= 1_000 && ms % 1_000 === 0)
        return `${ms / 1_000} s`;
    return `${ms}ms`;
}
/**
 * The timeout says what is true: the kit stopped waiting, and the appliance did not necessarily
 * stop working. Reported as a plain failure, a person sends the file again and ingests it twice.
 */
function ingestTimeoutMessage(timeoutMs) {
    return `The ingest did not finish within ${duration(timeoutMs)}. The appliance may still be `
        + 'queueing or ingesting it and can still complete it — check the documents list before sending it again.';
}
/** The multipart body both upload paths send. */
function uploadForm(filename, bytes, tags) {
    const form = new FormData();
    const blob = bytes instanceof Blob ? bytes : new Blob([bytes]);
    form.append('file', blob, filename);
    // One repeated field rather than a joined string: a tag containing a comma would otherwise
    // silently become two tags.
    for (const tag of tags.filter((t) => t.trim()))
        form.append('tags', tag.trim());
    return form;
}
export class DocumentsClient {
    transport;
    ingestTimeoutMs;
    constructor(transport, options = {}) {
        this.transport = transport;
        this.ingestTimeoutMs = options.ingestTimeoutMs ?? DEFAULT_INGEST_TIMEOUT_MS;
    }
    /** Everything ingested, with the chunk total the graph holds for it. */
    list() {
        return this.transport.send({ method: 'GET', path: DOCS });
    }
    /**
     * Ingest one file: converted, chunked, embedded, answerable once it lands.
     *
     * BYTES, NOT A `File`. The console has a `File` from an `<input>`; the Me app has an
     * `ArrayBuffer` that crossed an IPC bridge, because no file PATH may cross it and a `File` is not
     * structured-cloneable in the shape that matters. Bytes plus a name is the intersection, so one
     * method serves both rather than the Me app keeping a private upload path.
     */
    upload(filename, bytes, tags = [], options = {}) {
        return this.transport.send({
            method: 'POST',
            path: `${DOCS}/upload`,
            form: uploadForm(filename, bytes, tags),
            ...this.ingestDeadline(options),
        });
    }
    /**
     * Start ingesting one file and return at once with the JOB, which {@link followIngest} follows
     * to its end. Prefer this to {@link upload}: it has no deadline to guess, and it says where the
     * document has got.
     *
     * An appliance older than ingest jobs answers `unsupported` — fall back to {@link upload} there.
     */
    startUpload(filename, bytes, tags = []) {
        return this.transport.send({ method: 'POST', path: INGESTS, form: uploadForm(filename, bytes, tags), timeoutMs: START_INGEST_TIMEOUT_MS });
    }
    /** {@link startUpload} for a web page: the appliance fetches it as part of the job. */
    startIngestUrl(url, tags = []) {
        return this.transport.send({
            method: 'POST',
            path: `${INGESTS}/url`,
            body: { url, tags: tags.filter((t) => t.trim()) },
            timeoutMs: START_INGEST_TIMEOUT_MS,
        });
    }
    /**
     * Embed the chunks of an already-ingested document that have no embedding, without re-ingesting
     * it. Answers at once with a JOB, followed like any other ingest; on success the job's
     * `chunksWithoutEmbeddings` says how many are still missing, which is zero when the repair took.
     *
     * A document the caller's world does not hold is `refused` with status 404. An appliance with
     * nothing to embed with is `refused` with status 409; its reason is in the body's `message`.
     */
    startEmbedMissing(uri) {
        return this.transport.send({ method: 'POST', path: `${DOCS}/embed-missing`, body: { uri }, timeoutMs: START_INGEST_TIMEOUT_MS });
    }
    /**
     * Where one job has got. A job the appliance does not know — it restarted since, or never had
     * it — is `refused` with status 404, which is what {@link followIngest} reports as `lost`.
     */
    ingestJob(id) {
        return this.transport.send({ method: 'GET', path: `${INGESTS}/${encodeURIComponent(id)}` });
    }
    /**
     * Follow a job until the appliance says it ended, or no longer knows it. No deadline: see
     * `ingests.ts` for why, and for what `stalled` does and does not mean.
     */
    followIngest(id, options = {}) {
        return followIngest(id, (job) => this.ingestJob(job), options);
    }
    /**
     * Replace a document's tags, on the document and every chunk, without re-ingesting it. The list
     * REPLACES what was there; an empty list removes every tag. `not_found` when the caller's world
     * holds no document at `uri`.
     */
    setTags(uri, tags) {
        return this.transport.send({ method: 'PUT', path: `${DOCS}/tags`, body: { uri, tags } });
    }
    /** Remove a document and everything ingested from it — chunks, figures — from the caller's world. */
    remove(uri) {
        return this.transport.send({ method: 'DELETE', path: DOCS, query: { uri } });
    }
    /** Ingest a web page by URL — the appliance fetches and converts it. */
    ingestUrl(url, tags = [], options = {}) {
        return this.transport.send({
            method: 'POST',
            path: `${DOCS}/url`,
            body: { url, tags: tags.filter((t) => t.trim()) },
            ...this.ingestDeadline(options),
        });
    }
    ingestDeadline(options) {
        const timeoutMs = options.timeoutMs ?? this.ingestTimeoutMs;
        return { timeoutMs, timeoutMessage: ingestTimeoutMessage(timeoutMs) };
    }
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
    ask(request, options = {}) {
        const body = {
            question: request.question,
            history: request.history ?? [],
            answer: true,
        };
        if (request.tag)
            body['tag'] = request.tag;
        /* ONE `window` OBJECT, which is what the appliance reads. This used to send `dateField`, `from`
           and `to` at the top level; the server's request type has no such fields and ignores unknown
           ones, so every date filter narrowed nothing and nothing said so. The field is sent only with
           a bound: a field alone is not a range. */
        if (request.from || request.to) {
            body['window'] = {
                field: request.dateField ?? 'modified',
                ...(request.from ? { from: request.from } : {}),
                ...(request.to ? { to: request.to } : {}),
            };
        }
        if (request.topK)
            body['topK'] = request.topK;
        return this.transport.send({
            method: 'POST',
            path: `${DOCS}/ask`,
            body,
            headers: options.operationId ? { 'X-Embabel-Operation-Id': options.operationId } : undefined,
            timeoutMs: ASK_TIMEOUT_MS,
        });
    }
}
/**
 * A correlation id for one ask, unique enough for the job it does: telling this window's retrieval
 * steps from another window's in a shared stream. Not a security boundary — the stream is already
 * scoped to the user — so a timestamp and some randomness is the whole requirement.
 */
export function newOperationId(prefix = 'ask') {
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
//# sourceMappingURL=documents.js.map