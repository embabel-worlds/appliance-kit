import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
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
import { useCallback, useEffect, useRef, useState } from 'react';
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
/** An agent or routine name as a person reads it: `chase-failed-payment` is "Chase failed payment". */
export function displayName(slug) {
    const words = slug.replace(/[-_]/g, ' ').trim();
    return words.charAt(0).toUpperCase() + words.slice(1);
}
/**
 * Who asked, as the card's reader sees it. A person's own held call is theirs: "You" to the person who
 * made it — today the only one shown it, as the request's owner — and their name to anyone else, as
 * the appliance words its notification. Otherwise the agent, else the routine. A person's request
 * carries the appliance's placeholder routine, which names nobody, so it is never the fallback there.
 */
export function askerOf(request, viewer = request.ownerId) {
    if (request.raisedBy) {
        if (request.raisedBy === viewer)
            return 'You';
        return request.raisedByName?.trim() || request.raisedBy;
    }
    return displayName(request.agent ?? request.routine);
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
export function RequestStatusPill({ status }) {
    return (_jsxs("span", { className: `pill ${TONE[status]}`.trim(), children: [_jsx("span", { className: "dot", "aria-hidden": "true" }), STATUS_WORDS[status]] }));
}
export function ApprovalsSurface({ services, host, focusRequest }) {
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
    return (_jsxs("div", { className: "kit-feature kit-feature-approvals approvals", children: [_jsx(StudioPanel, { title: pending.length ? `Waiting for you (${pending.length})` : 'Waiting for you', aside: _jsx("button", { className: "btn ghost tiny", onClick: () => void load(), children: "Refresh" }), children: absent ? (_jsx(Status, { tone: "caution", children: problem })) : (_jsxs(_Fragment, { children: [problem && _jsx(Status, { tone: "error", children: problem }), loaded && pending.length === 0 && !problem && (_jsx("p", { className: "hint", children: "Nothing to decide. When an agent wants to do something it should not do alone, it asks here." })), pending.map((r) => (_jsx(RequestCard, { request: r, services: services, host: host, onDecided: replace, focused: r.id === focusRequest }, r.id)))] })) }), decided.length > 0 && (_jsx(StudioPanel, { title: "Decided", children: decided.map((r) => (_jsx(RequestCard, { request: r, services: services, host: host, onDecided: replace, focused: r.id === focusRequest }, r.id))) }))] }));
}
function RequestCard({ request, services, host, onDecided, focused, }) {
    const card = useRef(null);
    /* The card exists only once the list has loaded, so the scroll waits for it rather than for the link. */
    useEffect(() => {
        if (focused)
            card.current?.scrollIntoView?.({ block: 'center' });
    }, [focused]);
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
    const person = Boolean(request.raisedBy);
    const asker = askerOf(request);
    /*
     * A second person is what the rule asks for, but the appliance lets the person who asked approve
     * it anyway and records that they did — so the card says so before they choose, not after.
     */
    const ownAsk = person && request.raisedBy === request.ownerId;
    const secondPerson = ownAsk && request.secondPersonAsked === true;
    const first = request.evidence[0];
    const columns = first ? Object.keys(first) : [];
    return (_jsxs("article", { ref: card, className: focused ? 'request is-focused' : 'request', "aria-current": focused ? 'true' : undefined, children: [_jsxs("header", { className: "request-head", children: [_jsxs("span", { className: "request-who", children: [person ? (`${asker} asked`) : host?.openAgent ? (_jsx("button", { className: "request-agentlink", onClick: () => host.openAgent?.(request.routine), children: asker })) : (asker), !person && ' asks your OK'] }), _jsx(RequestStatusPill, { status: request.status })] }), _jsx("p", { className: "request-detail", children: request.detail }), request.quote && _jsx("blockquote", { className: "request-quote", children: request.quote }), request.untrusted && request.untrusted.length > 0 && (_jsxs("p", { className: "request-untrusted", children: ["Drafted after reading text from outside the business (", request.untrusted.join('; '), "). Such text can carry instructions meant for whoever reads it: read the draft with that in mind."] })), columns.length > 0 && (_jsx("div", { className: "request-evidence", children: _jsxs("table", { children: [_jsx("thead", { children: _jsx("tr", { children: columns.map((c) => _jsx("th", { children: c }, c)) }) }), _jsx("tbody", { children: request.evidence.map((row, i) => (_jsx("tr", { children: columns.map((c) => _jsx("td", { children: String(row[c] ?? '') }, c)) }, i))) })] }) })), _jsxs("details", { className: "request-call", children: [_jsx("summary", { children: "Technical details" }), _jsxs("p", { className: "hint", children: [person ? 'This' : _jsxs(_Fragment, { children: ["Routine ", _jsx("code", { children: request.routine })] }), " would call ", _jsx("code", { children: request.verb }), " with:"] }), _jsx("pre", { children: pretty(request.args) })] }), _jsxs("p", { className: "request-when hint", children: ["Asked ", when(request.raisedAt), open && _jsxs(_Fragment, { children: [" \u00B7 expires ", when(request.expiresAt)] }), request.decidedBy && (_jsxs(_Fragment, { children: [' · ', request.selfApproved
                                ? 'approved by you — your own request'
                                : `${request.status === 'REJECTED' ? 'rejected' : 'approved'} by ${request.decidedBy}`, ' ', when(request.decidedAt)] }))] }), request.reason && _jsxs("p", { className: "request-reason", children: ["Why not: ", request.reason] }), request.status === 'FAILED' && request.result && _jsx(Status, { tone: "error", children: request.result }), refusal && _jsx(Status, { tone: "error", children: refusal }), open && secondPerson && (_jsx("p", { className: "request-self hint", children: "You asked for this yourself. This change asks for a second person's approval; approving it yourself will be recorded." })), open && !rejecting && (_jsxs("div", { className: "row request-actions", children: [_jsx("button", { className: "btn", disabled: busy, onClick: () => void decide(true), children: "Approve" }), _jsx("button", { className: "btn ghost", disabled: busy, onClick: () => setRejecting(true), children: "Reject\u2026" })] })), open && rejecting && (_jsxs("div", { className: "row request-actions", children: [_jsx("input", { "aria-label": "Why reject", placeholder: "Why not? The agent learns from this.", value: reason, onChange: (e) => setReason(e.target.value) }), _jsx("button", { className: "btn", disabled: busy || !reason.trim(), onClick: () => void decide(false), children: "Reject" }), _jsx("button", { className: "btn ghost", disabled: busy, onClick: () => setRejecting(false), children: "Cancel" })] }))] }));
}
//# sourceMappingURL=ApprovalsSurface.js.map