import { type Outcome } from './outcome.ts';
export interface RequestSpec {
    method: 'GET' | 'POST' | 'PUT' | 'DELETE';
    /** Absolute path from the appliance root, e.g. `/api/v1/admin/kg/schema`. */
    path: string;
    query?: Record<string, string | number | boolean | undefined>;
    body?: unknown;
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