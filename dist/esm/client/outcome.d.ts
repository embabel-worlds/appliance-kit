/** The endpoint answered. */
export interface Ok<T> {
    ok: true;
    value: T;
}
export type FailureKind = 
/** The route does not exist on this appliance — almost always a version older than this client. */
'unsupported'
/** No credentials, or the ones supplied were rejected. */
 | 'unauthorized'
/** The endpoint exists, understood the request, and declined it. `error` is the server's own words. */
 | 'refused'
/** The appliance could not be reached, or did not answer in time. */
 | 'unreachable'
/** The appliance answered 5xx. */
 | 'failed';
export interface Failure {
    ok: false;
    kind: FailureKind;
    /** Human-readable, and where possible the SERVER's own sentence rather than one invented here. */
    message: string;
    /** Present when the appliance answered at all. */
    status?: number;
    /** The parsed body, for a caller that wants the documented error shape (`valid`, `state`, …). */
    body?: unknown;
}
export type Outcome<T> = Ok<T> | Failure;
export declare const ok: <T>(value: T) => Ok<T>;
export declare const failure: (kind: FailureKind, message: string, status?: number, body?: unknown) => Failure;
/** Narrowing helper, so callers can write `if (isOk(r)) { r.value }` without a type assertion. */
export declare const isOk: <T>(outcome: Outcome<T>) => outcome is Ok<T>;
/**
 * Unwrap or throw. For the rare caller that genuinely cannot proceed and has no better story to
 * tell the user than an exception — NOT the default. A UI should branch on the outcome so an
 * `unsupported` can render "your appliance predates this" instead of a stack trace.
 */
export declare function expect<T>(outcome: Outcome<T>): T;
//# sourceMappingURL=outcome.d.ts.map