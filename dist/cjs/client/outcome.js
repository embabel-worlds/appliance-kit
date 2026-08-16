"use strict";
/*
 * WHAT A CALL CAN COME BACK AS.
 *
 * Every method returns an Outcome rather than throwing, because the failure that matters most here
 * is not an error at all: an appliance older than the client simply does not have the endpoint. A
 * Me app installed in March talks to an appliance pulled in August, and the reverse — an app that
 * auto-updated against an appliance that did not — so there is no version at which both are
 * current. Both front ends need to say "your appliance predates this" rather than "something went
 * wrong", and neither can do that if a missing route arrives as an exception indistinguishable
 * from a network blip.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.isOk = exports.failure = exports.ok = void 0;
exports.expect = expect;
const ok = (value) => ({ ok: true, value });
exports.ok = ok;
const failure = (kind, message, status, body) => {
    const f = { ok: false, kind, message };
    if (status !== undefined)
        f.status = status;
    if (body !== undefined)
        f.body = body;
    return f;
};
exports.failure = failure;
/** Narrowing helper, so callers can write `if (isOk(r)) { r.value }` without a type assertion. */
const isOk = (outcome) => outcome.ok;
exports.isOk = isOk;
/**
 * Unwrap or throw. For the rare caller that genuinely cannot proceed and has no better story to
 * tell the user than an exception — NOT the default. A UI should branch on the outcome so an
 * `unsupported` can render "your appliance predates this" instead of a stack trace.
 */
function expect(outcome) {
    if (outcome.ok)
        return outcome.value;
    throw new Error(`${outcome.kind}: ${outcome.message}`);
}
//# sourceMappingURL=outcome.js.map