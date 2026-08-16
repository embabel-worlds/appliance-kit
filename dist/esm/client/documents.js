/*
 * THE DOCUMENTS SURFACE — listing, ingesting, and asking.
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
/** Conversion, chunking and embedding, for a file that may be a large PDF. */
const INGEST_TIMEOUT_MS = 300_000;
export class DocumentsClient {
    transport;
    constructor(transport) {
        this.transport = transport;
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
    upload(filename, bytes, tags = []) {
        const form = new FormData();
        const blob = bytes instanceof Blob ? bytes : new Blob([bytes]);
        form.append('file', blob, filename);
        // One repeated field rather than a joined string: a tag containing a comma would otherwise
        // silently become two tags.
        for (const tag of tags.filter((t) => t.trim()))
            form.append('tags', tag.trim());
        return this.transport.send({ method: 'POST', path: `${DOCS}/upload`, form, timeoutMs: INGEST_TIMEOUT_MS });
    }
    /** Ingest a web page by URL — the appliance fetches and converts it. */
    ingestUrl(url, tags = []) {
        return this.transport.send({
            method: 'POST',
            path: `${DOCS}/url`,
            body: { url, tags: tags.filter((t) => t.trim()) },
            timeoutMs: INGEST_TIMEOUT_MS,
        });
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
        if (request.dateField)
            body['dateField'] = request.dateField;
        if (request.from)
            body['from'] = request.from;
        if (request.to)
            body['to'] = request.to;
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