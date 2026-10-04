"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.displayName = displayName;
exports.RequestStatusPill = RequestStatusPill;
exports.ApprovalsSurface = ApprovalsSurface;
const jsx_runtime_1 = require("react/jsx-runtime");
/*
 * APPROVALS — what agents ask a person to approve before they act (embabel/me#1776).
 *
 * A request is an agent saying "I would do this, and here is why", and most people deciding are not
 * the people who wrote its routine. So the card speaks the business's words: who is asking, what
 * would change, the text it would write, and the rows that made it ask. The routine, the tool and
 * its raw arguments are folded under technical details, there to check, never to read first.
 *
 * Approving calls the verb as the person who approves. Rejecting needs a reason — the appliance
 * refuses one without — so the box for it is part of the reject control, not an afterthought.
 * Pending requests come first; decided, failed and expired ones stay below as the record, because
 * "what did my agents ask, and what did I say" is a question people come back with.
 */
const react_1 = require("react");
const chrome_tsx_1 = require("../studio/chrome.js");
const STATUS_WORDS = {
    PENDING: 'waiting for you',
    APPROVED: 'approved',
    FAILED: 'approved, but it failed',
    REJECTED: 'rejected',
    EXPIRED: 'expired unanswered',
};
const TONE = {
    PENDING: 'caution',
    APPROVED: 'ok',
    FAILED: 'error',
    REJECTED: '',
    EXPIRED: '',
};
function when(iso) {
    if (!iso)
        return '';
    const date = new Date(iso);
    return Number.isNaN(date.getTime()) ? iso : date.toLocaleString();
}
/** An agent or routine name as a person reads it: `chase-failed-payment` is "Chase failed payment". */
function displayName(slug) {
    const words = slug.replace(/[-_]/g, ' ').trim();
    return words.charAt(0).toUpperCase() + words.slice(1);
}
/** The verb's arguments, indented if they are JSON, as they were if not. */
function pretty(args) {
    try {
        return JSON.stringify(JSON.parse(args), null, 2);
    }
    catch {
        return args;
    }
}
/**
 * @deprecated A host built on desk draws state with desk's `Led` and the words beside it, not this
 * pill: see "Hosts built on desk" in the README. The pill is `display: flex`, so anywhere but a
 * flex row it stretches to the width of its container and reads as a text field.
 */
function RequestStatusPill({ status }) {
    return ((0, jsx_runtime_1.jsxs)("span", { className: `pill ${TONE[status]}`.trim(), children: [(0, jsx_runtime_1.jsx)("span", { className: "dot", "aria-hidden": "true" }), STATUS_WORDS[status]] }));
}
function ApprovalsSurface({ services, host }) {
    const [requests, setRequests] = (0, react_1.useState)([]);
    const [loaded, setLoaded] = (0, react_1.useState)(false);
    const [absent, setAbsent] = (0, react_1.useState)(false);
    const [problem, setProblem] = (0, react_1.useState)('');
    const load = (0, react_1.useCallback)(async () => {
        const result = await services.listRequests();
        setLoaded(true);
        if (!result.ok) {
            setAbsent(result.kind === 'unsupported');
            setProblem((0, chrome_tsx_1.failureMessage)(result, 'list requests'));
            return;
        }
        setAbsent(false);
        setProblem('');
        setRequests(result.value);
    }, [services]);
    (0, react_1.useEffect)(() => {
        void load();
    }, [load]);
    const replace = (0, react_1.useCallback)((request) => {
        setRequests((all) => all.map((r) => (r.id === request.id ? request : r)));
    }, []);
    const pending = requests.filter((r) => r.status === 'PENDING');
    const decided = requests.filter((r) => r.status !== 'PENDING');
    return ((0, jsx_runtime_1.jsxs)("div", { className: "kit-feature kit-feature-approvals approvals", children: [(0, jsx_runtime_1.jsx)(chrome_tsx_1.StudioPanel, { title: pending.length ? `Waiting for you (${pending.length})` : 'Waiting for you', aside: (0, jsx_runtime_1.jsx)("button", { className: "btn ghost tiny", onClick: () => void load(), children: "Refresh" }), children: absent ? ((0, jsx_runtime_1.jsx)(chrome_tsx_1.Status, { tone: "caution", children: problem })) : ((0, jsx_runtime_1.jsxs)(jsx_runtime_1.Fragment, { children: [problem && (0, jsx_runtime_1.jsx)(chrome_tsx_1.Status, { tone: "error", children: problem }), loaded && pending.length === 0 && !problem && ((0, jsx_runtime_1.jsx)("p", { className: "hint", children: "Nothing to decide. When an agent wants to do something it should not do alone, it asks here." })), pending.map((r) => ((0, jsx_runtime_1.jsx)(RequestCard, { request: r, services: services, host: host, onDecided: replace }, r.id)))] })) }), decided.length > 0 && ((0, jsx_runtime_1.jsx)(chrome_tsx_1.StudioPanel, { title: "Decided", children: decided.map((r) => ((0, jsx_runtime_1.jsx)(RequestCard, { request: r, services: services, host: host, onDecided: replace }, r.id))) }))] }));
}
function RequestCard({ request, services, host, onDecided, }) {
    const [busy, setBusy] = (0, react_1.useState)(false);
    const [refusal, setRefusal] = (0, react_1.useState)('');
    const [rejecting, setRejecting] = (0, react_1.useState)(false);
    const [reason, setReason] = (0, react_1.useState)('');
    const open = request.status === 'PENDING';
    async function decide(approve) {
        if (busy)
            return;
        setBusy(true);
        const result = approve ? await services.approve(request.id) : await services.reject(request.id, reason.trim());
        setBusy(false);
        if (!result.ok) {
            setRefusal((0, chrome_tsx_1.failureMessage)(result, approve ? 'approve this request' : 'reject this request'));
            return;
        }
        setRefusal('');
        setRejecting(false);
        onDecided(result.value);
    }
    const asker = displayName(request.agent ?? request.routine);
    const first = request.evidence[0];
    const columns = first ? Object.keys(first) : [];
    return ((0, jsx_runtime_1.jsxs)("article", { className: "request", children: [(0, jsx_runtime_1.jsxs)("header", { className: "request-head", children: [(0, jsx_runtime_1.jsxs)("span", { className: "request-who", children: [host?.openAgent ? ((0, jsx_runtime_1.jsx)("button", { className: "request-agentlink", onClick: () => host.openAgent?.(request.routine), children: asker })) : (asker), ' ', "asks your OK"] }), (0, jsx_runtime_1.jsx)(RequestStatusPill, { status: request.status })] }), (0, jsx_runtime_1.jsx)("p", { className: "request-detail", children: request.detail }), request.quote && (0, jsx_runtime_1.jsx)("blockquote", { className: "request-quote", children: request.quote }), request.untrusted && request.untrusted.length > 0 && ((0, jsx_runtime_1.jsxs)("p", { className: "request-untrusted", children: ["Drafted after reading text from outside the business (", request.untrusted.join('; '), "). Such text can carry instructions meant for whoever reads it: read the draft with that in mind."] })), columns.length > 0 && ((0, jsx_runtime_1.jsx)("div", { className: "request-evidence", children: (0, jsx_runtime_1.jsxs)("table", { children: [(0, jsx_runtime_1.jsx)("thead", { children: (0, jsx_runtime_1.jsx)("tr", { children: columns.map((c) => (0, jsx_runtime_1.jsx)("th", { children: c }, c)) }) }), (0, jsx_runtime_1.jsx)("tbody", { children: request.evidence.map((row, i) => ((0, jsx_runtime_1.jsx)("tr", { children: columns.map((c) => (0, jsx_runtime_1.jsx)("td", { children: String(row[c] ?? '') }, c)) }, i))) })] }) })), (0, jsx_runtime_1.jsxs)("details", { className: "request-call", children: [(0, jsx_runtime_1.jsx)("summary", { children: "Technical details" }), (0, jsx_runtime_1.jsxs)("p", { className: "hint", children: ["Routine ", (0, jsx_runtime_1.jsx)("code", { children: request.routine }), " would call ", (0, jsx_runtime_1.jsx)("code", { children: request.verb }), " with:"] }), (0, jsx_runtime_1.jsx)("pre", { children: pretty(request.args) })] }), (0, jsx_runtime_1.jsxs)("p", { className: "request-when hint", children: ["Asked ", when(request.raisedAt), open && (0, jsx_runtime_1.jsxs)(jsx_runtime_1.Fragment, { children: [" \u00B7 expires ", when(request.expiresAt)] }), request.decidedBy && (0, jsx_runtime_1.jsxs)(jsx_runtime_1.Fragment, { children: [" \u00B7 ", request.status === 'REJECTED' ? 'rejected' : 'approved', " by ", request.decidedBy, " ", when(request.decidedAt)] })] }), request.reason && (0, jsx_runtime_1.jsxs)("p", { className: "request-reason", children: ["Why not: ", request.reason] }), request.status === 'FAILED' && request.result && (0, jsx_runtime_1.jsx)(chrome_tsx_1.Status, { tone: "error", children: request.result }), refusal && (0, jsx_runtime_1.jsx)(chrome_tsx_1.Status, { tone: "error", children: refusal }), open && !rejecting && ((0, jsx_runtime_1.jsxs)("div", { className: "row request-actions", children: [(0, jsx_runtime_1.jsx)("button", { className: "btn", disabled: busy, onClick: () => void decide(true), children: "Approve" }), (0, jsx_runtime_1.jsx)("button", { className: "btn ghost", disabled: busy, onClick: () => setRejecting(true), children: "Reject\u2026" })] })), open && rejecting && ((0, jsx_runtime_1.jsxs)("div", { className: "row request-actions", children: [(0, jsx_runtime_1.jsx)("input", { "aria-label": "Why reject", placeholder: "Why not? The agent learns from this.", value: reason, onChange: (e) => setReason(e.target.value) }), (0, jsx_runtime_1.jsx)("button", { className: "btn", disabled: busy || !reason.trim(), onClick: () => void decide(false), children: "Reject" }), (0, jsx_runtime_1.jsx)("button", { className: "btn ghost", disabled: busy, onClick: () => setRejecting(false), children: "Cancel" })] }))] }));
}
//# sourceMappingURL=ApprovalsSurface.js.map