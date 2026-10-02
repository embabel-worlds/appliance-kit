import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
/*
 * APPROVALS — what agents ask a person to approve before they act (embabel/me#1776).
 *
 * A request is a routine saying "I would do this, and here is why": the verb it would call, its
 * arguments, one line of reason, and the rows that made it think so. The surface leads with the
 * reason and the evidence, because that is what a person decides on; the verb and its arguments are
 * there to check, not to read first.
 *
 * Approving calls the verb as the person who approves. Rejecting needs a reason — the appliance
 * refuses one without — so the box for it is part of the reject control, not an afterthought.
 * Pending requests come first; decided, failed and expired ones stay below as the record, because
 * "what did my agents ask, and what did I say" is a question people come back with.
 */
import { useCallback, useEffect, useState } from 'react';
import { Status, StudioPanel, failureMessage } from "../studio/chrome.js";
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
/** The verb's arguments, indented if they are JSON, as they were if not. */
function pretty(args) {
    try {
        return JSON.stringify(JSON.parse(args), null, 2);
    }
    catch {
        return args;
    }
}
export function RequestStatusPill({ status }) {
    return (_jsxs("span", { className: `pill ${TONE[status]}`.trim(), children: [_jsx("span", { className: "dot", "aria-hidden": "true" }), STATUS_WORDS[status]] }));
}
export function ApprovalsSurface({ services, host }) {
    const [requests, setRequests] = useState([]);
    const [loaded, setLoaded] = useState(false);
    const [absent, setAbsent] = useState(false);
    const [problem, setProblem] = useState('');
    const load = useCallback(async () => {
        const result = await services.listRequests();
        setLoaded(true);
        if (!result.ok) {
            setAbsent(result.kind === 'unsupported');
            setProblem(failureMessage(result, 'list requests'));
            return;
        }
        setAbsent(false);
        setProblem('');
        setRequests(result.value);
    }, [services]);
    useEffect(() => {
        void load();
    }, [load]);
    const replace = useCallback((request) => {
        setRequests((all) => all.map((r) => (r.id === request.id ? request : r)));
    }, []);
    const pending = requests.filter((r) => r.status === 'PENDING');
    const decided = requests.filter((r) => r.status !== 'PENDING');
    return (_jsxs("div", { className: "kit-feature kit-feature-approvals approvals", children: [_jsx(StudioPanel, { title: pending.length ? `Waiting for you (${pending.length})` : 'Waiting for you', aside: _jsx("button", { className: "btn ghost tiny", onClick: () => void load(), children: "Refresh" }), children: absent ? (_jsx(Status, { tone: "caution", children: problem })) : (_jsxs(_Fragment, { children: [problem && _jsx(Status, { tone: "error", children: problem }), loaded && pending.length === 0 && !problem && (_jsx("p", { className: "hint", children: "Nothing to decide. When an agent wants to do something it should not do alone, it asks here." })), pending.map((r) => (_jsx(RequestCard, { request: r, services: services, host: host, onDecided: replace }, r.id)))] })) }), decided.length > 0 && (_jsx(StudioPanel, { title: "Decided", children: decided.map((r) => (_jsx(RequestCard, { request: r, services: services, host: host, onDecided: replace }, r.id))) }))] }));
}
function RequestCard({ request, services, host, onDecided, }) {
    const [busy, setBusy] = useState(false);
    const [refusal, setRefusal] = useState('');
    const [rejecting, setRejecting] = useState(false);
    const [reason, setReason] = useState('');
    const open = request.status === 'PENDING';
    async function decide(approve) {
        if (busy)
            return;
        setBusy(true);
        const result = approve ? await services.approve(request.id) : await services.reject(request.id, reason.trim());
        setBusy(false);
        if (!result.ok) {
            setRefusal(failureMessage(result, approve ? 'approve this request' : 'reject this request'));
            return;
        }
        setRefusal('');
        setRejecting(false);
        onDecided(result.value);
    }
    const first = request.evidence[0];
    const columns = first ? Object.keys(first) : [];
    return (_jsxs("article", { className: "request", children: [_jsxs("header", { className: "request-head", children: [_jsxs("span", { className: "request-who", children: [host?.openAgent ? (_jsx("button", { className: "request-agentlink", onClick: () => host.openAgent?.(request.routine), children: request.routine })) : (request.routine), ' ', "asks"] }), _jsx(RequestStatusPill, { status: request.status })] }), _jsx("p", { className: "request-detail", children: request.detail }), request.untrusted && request.untrusted.length > 0 && (_jsxs("p", { className: "request-untrusted", children: ["Drafted after reading text from outside the business (", request.untrusted.join('; '), "). Such text can carry instructions meant for whoever reads it: read the draft with that in mind."] })), columns.length > 0 && (_jsx("div", { className: "request-evidence", children: _jsxs("table", { children: [_jsx("thead", { children: _jsx("tr", { children: columns.map((c) => _jsx("th", { children: c }, c)) }) }), _jsx("tbody", { children: request.evidence.map((row, i) => (_jsx("tr", { children: columns.map((c) => _jsx("td", { children: String(row[c] ?? '') }, c)) }, i))) })] }) })), _jsxs("details", { className: "request-call", children: [_jsxs("summary", { children: ["It would call ", _jsx("code", { children: request.verb })] }), _jsx("pre", { children: pretty(request.args) })] }), _jsxs("p", { className: "request-when hint", children: ["Asked ", when(request.raisedAt), open && _jsxs(_Fragment, { children: [" \u00B7 expires ", when(request.expiresAt)] }), request.decidedBy && _jsxs(_Fragment, { children: [" \u00B7 ", request.status === 'REJECTED' ? 'rejected' : 'approved', " by ", request.decidedBy, " ", when(request.decidedAt)] })] }), request.reason && _jsxs("p", { className: "request-reason", children: ["Why not: ", request.reason] }), request.status === 'FAILED' && request.result && _jsx(Status, { tone: "error", children: request.result }), refusal && _jsx(Status, { tone: "error", children: refusal }), open && !rejecting && (_jsxs("div", { className: "row request-actions", children: [_jsx("button", { className: "btn", disabled: busy, onClick: () => void decide(true), children: "Approve" }), _jsx("button", { className: "btn ghost", disabled: busy, onClick: () => setRejecting(true), children: "Reject\u2026" })] })), open && rejecting && (_jsxs("div", { className: "row request-actions", children: [_jsx("input", { "aria-label": "Why reject", placeholder: "Why not? The agent learns from this.", value: reason, onChange: (e) => setReason(e.target.value) }), _jsx("button", { className: "btn", disabled: busy || !reason.trim(), onClick: () => void decide(false), children: "Reject" }), _jsx("button", { className: "btn ghost", disabled: busy, onClick: () => setRejecting(false), children: "Cancel" })] }))] }));
}
//# sourceMappingURL=ApprovalsSurface.js.map