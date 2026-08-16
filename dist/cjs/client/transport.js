"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HttpTransport = void 0;
exports.basicAuth = basicAuth;
const outcome_ts_1 = require("./outcome.js");
/** HTTP Basic, the appliance's own scheme. Kept here so no caller hand-rolls the base64. */
function basicAuth(username, password) {
    const encoded = typeof globalThis.btoa === 'function'
        ? globalThis.btoa(`${username}:${password}`)
        : // Node before the global btoa, and the Electron main process.
            Buffer.from(`${username}:${password}`, 'utf8').toString('base64');
    return { Authorization: `Basic ${encoded}` };
}
/**
 * Spring's own 404 body for a path nothing is mapped to. A handler's documented 404 carries the
 * appliance's sentence in `error` and nothing else; this one carries `timestamp` and `path`, which
 * is the only reliable way to tell "no such run" from "this appliance is too old to know the
 * route". Getting that wrong in either direction is bad: a real refusal reported as a version
 * problem sends the user to upgrade for nothing, and a missing endpoint reported as a refusal
 * shows them a server message that was never about them.
 */
function looksLikeUnmappedRoute(status, body) {
    if (status === 405)
        return true; // the path exists but not with this verb — a moved route
    if (status !== 404)
        return false;
    if (body === undefined || body === null || typeof body !== 'object')
        return true; // HTML or empty
    const shape = body;
    if (typeof shape['error'] === 'string' && !('timestamp' in shape) && !('path' in shape)) {
        return false; // the documented refusal shape — a real answer from a real handler
    }
    return 'timestamp' in shape || 'path' in shape || !('error' in shape);
}
class HttpTransport {
    baseUrl;
    headers;
    doFetch;
    defaultTimeoutMs;
    constructor(config) {
        this.baseUrl = config.baseUrl.replace(/\/$/, '');
        this.headers = config.headers ?? (() => ({}));
        const injected = config.fetch ?? globalThis.fetch;
        if (typeof injected !== 'function') {
            throw new Error('No fetch available: pass one in HttpTransportConfig.fetch');
        }
        /*
         * BOUND, NOT JUST STORED. `window.fetch` is a method of the global, and
         * calling it as `this.doFetch(...)` hands it this transport as its receiver —
         * which a browser rejects outright: "Failed to execute 'fetch' on 'Window':
         * Illegal invocation". It cost nothing in Node, where the global fetch does
         * not check, so it survived until the console became the first browser to run
         * this and every single call failed as "could not reach the appliance".
         *
         * An INJECTED fetch is bound to globalThis too, deliberately: a test double
         * is a plain function that ignores its receiver, and a real fetch passed in
         * from a browser needs exactly the same treatment as one taken from it.
         */
        this.doFetch = injected.bind(globalThis);
        this.defaultTimeoutMs = config.timeoutMs ?? 30_000;
    }
    url(spec) {
        const query = spec.query ?? {};
        const params = new URLSearchParams();
        for (const [key, value] of Object.entries(query)) {
            if (value !== undefined)
                params.append(key, String(value));
        }
        const search = params.toString();
        return `${this.baseUrl}${spec.path}${search ? `?${search}` : ''}`;
    }
    async send(spec) {
        const controller = new AbortController();
        const timeoutMs = spec.timeoutMs ?? this.defaultTimeoutMs;
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        let response;
        try {
            const init = {
                method: spec.method,
                signal: controller.signal,
                headers: {
                    Accept: 'application/json',
                    ...(spec.body === undefined ? {} : { 'Content-Type': 'application/json' }),
                    ...this.headers(),
                },
            };
            if (spec.body !== undefined)
                init.body = JSON.stringify(spec.body);
            response = await this.doFetch(this.url(spec), init);
        }
        catch (cause) {
            const aborted = cause instanceof Error && cause.name === 'AbortError';
            return (0, outcome_ts_1.failure)('unreachable', aborted
                ? `The appliance did not answer within ${timeoutMs}ms`
                : `Could not reach the appliance: ${cause instanceof Error ? cause.message : String(cause)}`);
        }
        finally {
            clearTimeout(timer);
        }
        const text = await response.text().catch(() => '');
        let body;
        try {
            body = text.length > 0 ? JSON.parse(text) : undefined;
        }
        catch {
            body = undefined; // HTML error page, or a truncated stream
        }
        if (response.ok)
            return (0, outcome_ts_1.ok)(body);
        if (response.status === 401 || response.status === 403) {
            return (0, outcome_ts_1.failure)('unauthorized', serverMessage(body) ?? 'Not authorized', response.status, body);
        }
        if (looksLikeUnmappedRoute(response.status, body)) {
            return (0, outcome_ts_1.failure)('unsupported', `This appliance does not have ${spec.method} ${spec.path} — it is likely older than this client`, response.status, body);
        }
        if (response.status >= 500) {
            return (0, outcome_ts_1.failure)('failed', serverMessage(body) ?? `The appliance failed (${response.status})`, response.status, body);
        }
        return (0, outcome_ts_1.failure)('refused', serverMessage(body) ?? `Request refused (${response.status})`, response.status, body);
    }
}
exports.HttpTransport = HttpTransport;
/** The appliance's own sentence, when it sent one. Always preferred over anything invented here. */
function serverMessage(body) {
    if (body !== null && typeof body === 'object') {
        const error = body['error'];
        if (typeof error === 'string' && error.length > 0)
            return error;
    }
    return undefined;
}
//# sourceMappingURL=transport.js.map