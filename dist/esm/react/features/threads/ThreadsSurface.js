import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
/*
 * THREADS: the conversations you and your agents share (embabel/me#1779).
 *
 * Shown INSIDE chat, not beside it. A thread is a conversation with more than one participant whose
 * answers may arrive later, which is a property of a conversation and never was a reason for a
 * second place to type. It had one, and the cost was the ordinary one: chat gained markdown, unread
 * and sessions while this rendered `{message.text}` into a `<p>`, so an agent's list arrived as
 * `- item`. Prose now comes from the kit's one renderer, and `chrome: 'pane'` lets the host's own
 * conversation list choose the thread.
 *
 * A person writes, @mentions an agent, and the agent answers in the thread as itself; agents asking
 * each other land here as well, so what colleagues say to each other is never hidden. The
 * attachment is the payload — a record, a view's rows frozen when sent, a request — and it shows as
 * a card that opens to the thing itself, never a paragraph about it. An answer given without one
 * is marked as having had nothing attached.
 *
 * Answers arrive in the background: while the thread is waiting on someone it says who, and looks
 * again every few seconds until they have answered.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Status, StudioPanel, failureMessage } from "../studio/chrome.js";
import { Prose } from "../prose/Prose.js";
const POLL_MS = 2500;
function when(iso) {
    if (!iso)
        return '';
    const date = new Date(iso);
    return Number.isNaN(date.getTime()) ? iso : date.toLocaleString();
}
export function ThreadsSurface({ services, host, initialThread, markdown, chrome = 'full' }) {
    const [threads, setThreads] = useState([]);
    const [problem, setProblem] = useState('');
    const [absent, setAbsent] = useState(false);
    const [selected, setSelected] = useState(initialThread ?? null);
    const [view, setView] = useState(null);
    const [title, setTitle] = useState('');
    const loadThreads = useCallback(async () => {
        const result = await services.listThreads();
        if (!result.ok) {
            setAbsent(result.kind === 'unsupported');
            setProblem(failureMessage(result, 'list threads'));
            return;
        }
        setProblem('');
        setThreads(result.value);
        setSelected((current) => current ?? result.value[0]?.id ?? null);
    }, [services]);
    const loadThread = useCallback(async (id) => {
        const result = await services.getThread(id);
        if (!result.ok) {
            setProblem(failureMessage(result, 'open the thread'));
            return;
        }
        setView(result.value);
    }, [services]);
    useEffect(() => {
        void loadThreads();
    }, [loadThreads]);
    useEffect(() => {
        if (selected)
            void loadThread(selected);
        else
            setView(null);
    }, [selected, loadThread]);
    // While someone is still answering, look again until they have.
    useEffect(() => {
        if (!selected || !view || view.waitingOn.length === 0)
            return;
        const timer = setTimeout(() => void loadThread(selected), POLL_MS);
        return () => clearTimeout(timer);
    }, [selected, view, loadThread]);
    async function start(event) {
        event.preventDefault();
        const result = await services.createThread(title.trim());
        if (!result.ok) {
            setProblem(failureMessage(result, 'start a thread'));
            return;
        }
        setTitle('');
        await loadThreads();
        setSelected(result.value.id);
    }
    if (chrome === 'pane') {
        return (_jsxs("div", { className: "kit-feature kit-feature-threads pane", children: [problem && _jsx(Status, { tone: absent ? 'caution' : 'error', children: problem }), view && (_jsx(ThreadPane, { view: view, services: services, host: host, markdown: markdown, onPosted: () => void loadThread(view.thread.id), onProblem: setProblem }))] }));
    }
    return (_jsxs("div", { className: "kit-feature kit-feature-threads team", children: [_jsx(StudioPanel, { title: "Threads", aside: _jsx("button", { className: "btn ghost tiny", onClick: () => void loadThreads(), children: "Refresh" }), children: absent ? _jsx(Status, { tone: "caution", children: problem }) : (_jsxs(_Fragment, { children: [problem && _jsx(Status, { tone: "error", children: problem }), _jsxs("form", { className: "row", onSubmit: (event) => void start(event), children: [_jsx("input", { value: title, placeholder: "A new thread about\u2026", onChange: (event) => setTitle(event.target.value) }), _jsx("button", { className: "btn", type: "submit", disabled: !title.trim(), children: "Start" })] }), _jsx("ul", { className: "threadlist", role: "listbox", "aria-label": "Threads", children: threads.map((t) => (_jsx("li", { children: _jsxs("button", { role: "option", "aria-selected": t.id === selected, onClick: () => setSelected(t.id), children: [_jsx("strong", { children: t.title }), _jsx("span", { className: "hint", children: when(t.updatedAt) })] }) }, t.id))) })] })) }), view && (_jsx(ThreadPane, { view: view, services: services, host: host, markdown: markdown, onPosted: () => void loadThread(view.thread.id), onProblem: setProblem }))] }));
}
function ThreadPane({ view, services, host, markdown, onPosted, onProblem }) {
    const [text, setText] = useState('');
    const [viewName, setViewName] = useState('');
    const [sending, setSending] = useState(false);
    async function send(event) {
        event?.preventDefault();
        if (sending || (!text.trim() && !viewName.trim()))
            return;
        setSending(true);
        const attachments = viewName.trim() ? [{ kind: 'VIEW', label: viewName.trim() }] : [];
        const result = await services.post(view.thread.id, text.trim(), attachments);
        setSending(false);
        if (!result.ok) {
            onProblem(failureMessage(result, 'post in the thread'));
            return;
        }
        setText('');
        setViewName('');
        onPosted();
    }
    return (_jsxs(StudioPanel, { title: view.thread.title, children: [_jsx("ol", { className: "threadmessages", children: view.messages.map((m) => _jsx(MessageItem, { message: m, host: host, markdown: markdown }, m.id)) }), view.waitingOn.length > 0 && (_jsxs("p", { className: "hint threadwaiting", children: [view.waitingOn.join(', '), " ", view.waitingOn.length === 1 ? 'is' : 'are', " answering\u2026"] })), _jsxs("form", { className: "threadcompose", onSubmit: (event) => void send(event), children: [_jsx("textarea", { value: text, rows: 3, placeholder: "Write, and @mention an agent to bring it in: @steward is Northwind at risk? Enter sends, Shift+Enter for a new line", onChange: (event) => setText(event.target.value), onKeyDown: (event) => {
                            // Enter sends, as in any chat; Shift+Enter is a new line, and Enter mid-composition picks an IME candidate.
                            if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
                                event.preventDefault();
                                void send();
                            }
                        } }), _jsxs("div", { className: "row", children: [_jsx("input", { value: viewName, placeholder: "Attach a view's rows (its name)", onChange: (event) => setViewName(event.target.value) }), _jsx("button", { className: "btn primary", type: "submit", disabled: sending || (!text.trim() && !viewName.trim()), children: sending ? 'Posting…' : 'Post' })] })] })] }));
}
function MessageItem({ message, host, markdown }) {
    const from = message.from;
    const name = from.kind === 'AGENT' && host?.openAgent
        ? _jsx("button", { className: "request-agentlink", onClick: () => host.openAgent?.(from.name), children: from.name })
        : from.name;
    return (_jsxs("li", { className: `threadmessage from-${from.kind.toLowerCase()}`, children: [_jsxs("header", { className: "row", children: [_jsx("strong", { children: name }), _jsx("span", { className: "hint", title: message.createdAt, children: when(message.createdAt) }), message.wordsOnly && _jsx("span", { className: "hint", children: "nothing attached" })] }), _jsx(Prose, { libs: markdown, text: message.text, className: "threadtext" }), message.attachments.map((a, i) => _jsx(AttachmentCard, { attachment: a }, i))] }));
}
/* The thing itself, opened: a record's properties, or the rows a view returned when it was sent. */
function AttachmentCard({ attachment }) {
    const first = attachment.rows?.[0];
    const columns = first ? Object.keys(first).slice(0, 6) : [];
    return (_jsxs("details", { className: "threadattachment", children: [_jsxs("summary", { children: [_jsx("span", { className: "pill", children: attachment.kind.toLowerCase() }), " ", attachment.label, attachment.id ? ` ${attachment.id}` : '', " \u2014 ", attachment.title] }), columns.length > 0 ? (_jsx("div", { className: "tablewrap", children: _jsxs("table", { className: "results-table", children: [_jsx("thead", { children: _jsx("tr", { children: columns.map((c) => _jsx("th", { children: c }, c)) }) }), _jsx("tbody", { children: attachment.rows.map((row, i) => (_jsx("tr", { children: columns.map((c) => _jsx("td", { children: String(row[c] ?? '') }, c)) }, i))) })] }) })) : (_jsx("dl", { className: "threadproperties", children: Object.entries(attachment.properties ?? {}).map(([k, v]) => (_jsxs(React.Fragment, { children: [_jsx("dt", { children: k }), _jsx("dd", { children: typeof v === 'object' ? JSON.stringify(v) : String(v) })] }, k))) })), attachment.capturedAt && _jsxs("p", { className: "hint", children: ["as it was ", when(attachment.capturedAt)] })] }));
}
//# sourceMappingURL=ThreadsSurface.js.map