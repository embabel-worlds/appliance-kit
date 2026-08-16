import { type Outcome } from './outcome.ts';
export interface RequestSpec {
    method: 'GET' | 'POST' | 'PUT' | 'DELETE';
    /** Absolute path from the appliance root, e.g. `/api/v1/admin/kg/schema`. */
    path: string;
    query?: Record<string, string | number | boolean | undefined>;
    body?: unknown;
    /**
     * MULTIPART, for the one endpoint that is not JSON.
     *
     * A document upload is a file, and `JSON.stringify` over a `FormData` yields `{}` — silently,
     * with a `Content-Type: application/json` header on top of it. So the shape is stated rather than
     * sniffed: with `form`, the body is handed to `fetch` untouched and NO content type is set, which
     * is deliberate — the browser and undici both need to write the boundary themselves, and a
     * `multipart/form-data` header without one produces a request the server cannot parse.
     */
    form?: FormData;
    /**
     * Per-request headers, merged over the transport's own. `X-Embabel-Operation-Id` is the case
     * this exists for: the appliance echoes it on every progress event of the operation, which is
     * what lets one window narrate its own retrieval out of a per-USER event stream.
     */
    headers?: Record<string, string>;
    /** Overrides the transport default. Generation and execution can legitimately take minutes. */
    timeoutMs?: number;
}
/** What every client method talks to. Implement this to put the calls somewhere else — IPC, a test double. */
export interface Transport {
    send<T>(spec: RequestSpec): Promise<Outcome<T>>;
}
export interface HttpTransportConfig {
    /**
     * Prefix for every path. The console passes `''` — relative URLs, same origin, ambient
     * credentials. The Me main process passes the configured appliance URL.
     */
    baseUrl: string;
    /** Called per request, so a rotating credential does not need the transport rebuilt. */
    headers?: () => Record<string, string>;
    /** Injectable for tests and for the Electron main process, which has its own global. */
    fetch?: typeof globalThis.fetch;
    /** Default per-request deadline. */
    timeoutMs?: number;
}
/** HTTP Basic, the appliance's own scheme. Kept here so no caller hand-rolls the base64. */
export declare function basicAuth(username: string, password: string): Record<string, string>;
export declare class HttpTransport implements Transport {
    private readonly baseUrl;
    private readonly headers;
    private readonly doFetch;
    private readonly defaultTimeoutMs;
    constructor(config: HttpTransportConfig);
    private url;
    send<T>(spec: RequestSpec): Promise<Outcome<T>>;
}
//# sourceMappingURL=transport.d.ts.map