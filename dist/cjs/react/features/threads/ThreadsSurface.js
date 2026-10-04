"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.ThreadsSurface = ThreadsSurface;
const jsx_runtime_1 = require("react/jsx-runtime");
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
const react_1 = __importStar(require("react"));
const chrome_tsx_1 = require("../studio/chrome.js");
const Prose_tsx_1 = require("../prose/Prose.js");
const MentionMenu_tsx_1 = require("./MentionMenu.js");
const mentions_ts_1 = require("./mentions.js");
const POLL_MS = 2500;
function when(iso) {
    if (!iso)
        return '';
    const date = new Date(iso);
    return Number.isNaN(date.getTime()) ? iso : date.toLocaleString();
}
function ThreadsSurface({ services, host, initialThread, markdown, agents, chrome = 'full' }) {
    const [threads, setThreads] = (0, react_1.useState)([]);
    const [problem, setProblem] = (0, react_1.useState)('');
    const [absent, setAbsent] = (0, react_1.useState)(false);
    const [selected, setSelected] = (0, react_1.useState)(initialThread ?? null);
    const [view, setView] = (0, react_1.useState)(null);
    const [title, setTitle] = (0, react_1.useState)('');
    const loadThreads = (0, react_1.useCallback)(async () => {
        const result = await services.listThreads();
        if (!result.ok) {
            setAbsent(result.kind === 'unsupported');
            setProblem((0, chrome_tsx_1.failureMessage)(result, 'list threads'));
            return;
        }
        setProblem('');
        setThreads(result.value);
        setSelected((current) => current ?? result.value[0]?.id ?? null);
    }, [services]);
    const loadThread = (0, react_1.useCallback)(async (id) => {
        const result = await services.getThread(id);
        if (!result.ok) {
            setProblem((0, chrome_tsx_1.failureMessage)(result, 'open the thread'));
            return;
        }
        setView(result.value);
    }, [services]);
    /* The pane shows no list, so it asks for none: the host chose the thread and `getThread` below
     * is the only read it needs. */
    (0, react_1.useEffect)(() => {
        if (chrome === 'full')
            void loadThreads();
    }, [loadThreads, chrome]);
    (0, react_1.useEffect)(() => {
        if (selected)
            void loadThread(selected);
        else
            setView(null);
    }, [selected, loadThread]);
    // While someone is still answering, look again until they have.
    (0, react_1.useEffect)(() => {
        if (!selected || !view || view.waitingOn.length === 0)
            return;
        const timer = setTimeout(() => void loadThread(selected), POLL_MS);
        return () => clearTimeout(timer);
    }, [selected, view, loadThread]);
    async function start(event) {
        event.preventDefault();
        const result = await services.createThread(title.trim());
        if (!result.ok) {
            setProblem((0, chrome_tsx_1.failureMessage)(result, 'start a thread'));
            return;
        }
        setTitle('');
        await loadThreads();
        setSelected(result.value.id);
    }
    if (chrome === 'pane') {
        return ((0, jsx_runtime_1.jsxs)("div", { className: "kit-feature kit-feature-threads pane", children: [problem && (0, jsx_runtime_1.jsx)(chrome_tsx_1.Status, { tone: absent ? 'caution' : 'error', children: problem }), view && ((0, jsx_runtime_1.jsx)(ThreadPane, { view: view, services: services, host: host, markdown: markdown, agents: agents, onPosted: () => void loadThread(view.thread.id), onProblem: setProblem }))] }));
    }
    return ((0, jsx_runtime_1.jsxs)("div", { className: "kit-feature kit-feature-threads team", children: [(0, jsx_runtime_1.jsx)(chrome_tsx_1.StudioPanel, { title: "Threads", aside: (0, jsx_runtime_1.jsx)("button", { className: "btn ghost tiny", onClick: () => void loadThreads(), children: "Refresh" }), children: absent ? (0, jsx_runtime_1.jsx)(chrome_tsx_1.Status, { tone: "caution", children: problem }) : ((0, jsx_runtime_1.jsxs)(jsx_runtime_1.Fragment, { children: [problem && (0, jsx_runtime_1.jsx)(chrome_tsx_1.Status, { tone: "error", children: problem }), (0, jsx_runtime_1.jsxs)("form", { className: "row", onSubmit: (event) => void start(event), children: [(0, jsx_runtime_1.jsx)("input", { value: title, placeholder: "A new thread about\u2026", onChange: (event) => setTitle(event.target.value) }), (0, jsx_runtime_1.jsx)("button", { className: "btn", type: "submit", disabled: !title.trim(), children: "Start" })] }), (0, jsx_runtime_1.jsx)("ul", { className: "threadlist", role: "listbox", "aria-label": "Threads", children: threads.map((t) => ((0, jsx_runtime_1.jsx)("li", { children: (0, jsx_runtime_1.jsxs)("button", { role: "option", "aria-selected": t.id === selected, onClick: () => setSelected(t.id), children: [(0, jsx_runtime_1.jsx)("strong", { children: t.title }), (0, jsx_runtime_1.jsx)("span", { className: "hint", children: when(t.updatedAt) })] }) }, t.id))) })] })) }), view && ((0, jsx_runtime_1.jsx)(ThreadPane, { view: view, services: services, host: host, markdown: markdown, agents: agents, onPosted: () => void loadThread(view.thread.id), onProblem: setProblem }))] }));
}
function ThreadPane({ view, services, host, markdown, agents = [], onPosted, onProblem }) {
    const [text, setText] = (0, react_1.useState)('');
    const [viewName, setViewName] = (0, react_1.useState)('');
    const [sending, setSending] = (0, react_1.useState)(false);
    /*
     * The mention being typed, if any. `null` is "no menu": dismissed with Escape, or the caret is
     * not in a mention. The caret is read from the element rather than tracked, because every way it
     * moves — clicking, arrowing, selecting — has to count, and only the element knows them all.
     */
    const box = (0, react_1.useRef)(null);
    const [mention, setMention] = (0, react_1.useState)(null);
    const offered = mention ? (0, mentions_ts_1.matching)(agents, mention.query) : [];
    const cursor = (0, MentionMenu_tsx_1.useMentionCursor)(offered.length);
    const open = mention !== null && offered.length > 0;
    const MENU = `mentions-${view.thread.id}`;
    /* Re-asked after every edit and every caret move, so the menu follows the caret out of a mention
     * as readily as into one. */
    const syncMention = (el) => {
        const found = (0, mentions_ts_1.activeMention)(el.value, el.selectionStart ?? el.value.length);
        setMention(found ? { query: found.query } : null);
    };
    const pick = (name) => {
        const el = box.current;
        if (!el)
            return;
        const next = (0, mentions_ts_1.applyMention)(el.value, el.selectionStart ?? el.value.length, name);
        setText(next.text);
        setMention(null);
        cursor.reset();
        /* After React has written the value: setting it first and the caret second would put the caret
         * where the OLD text ended. */
        requestAnimationFrame(() => {
            el.focus();
            el.setSelectionRange(next.caret, next.caret);
        });
    };
    async function send(event) {
        event?.preventDefault();
        if (sending || (!text.trim() && !viewName.trim()))
            return;
        setSending(true);
        const attachments = viewName.trim() ? [{ kind: 'VIEW', label: viewName.trim() }] : [];
        const result = await services.post(view.thread.id, text.trim(), attachments);
        setSending(false);
        if (!result.ok) {
            onProblem((0, chrome_tsx_1.failureMessage)(result, 'post in the thread'));
            return;
        }
        setText('');
        setViewName('');
        onPosted();
    }
    return ((0, jsx_runtime_1.jsxs)(chrome_tsx_1.StudioPanel, { title: view.thread.title, children: [(0, jsx_runtime_1.jsx)("ol", { className: "threadmessages", children: view.messages.map((m) => (0, jsx_runtime_1.jsx)(MessageItem, { message: m, host: host, markdown: markdown }, m.id)) }), view.waitingOn.length > 0 && ((0, jsx_runtime_1.jsxs)("p", { className: "hint threadwaiting", children: [view.waitingOn.join(', '), " ", view.waitingOn.length === 1 ? 'is' : 'are', " answering\u2026"] })), (0, jsx_runtime_1.jsxs)("form", { className: "threadcompose", onSubmit: (event) => void send(event), children: [(0, jsx_runtime_1.jsx)("textarea", { ref: box, value: text, rows: 3, placeholder: "Write, and @mention an agent to bring it in. Enter sends, Shift+Enter for a new line", role: "combobox", "aria-expanded": open, "aria-controls": open ? MENU : undefined, "aria-activedescendant": open ? `${MENU}-${cursor.active}` : undefined, "aria-autocomplete": "list", onChange: (event) => { setText(event.target.value); syncMention(event.target); }, onClick: (event) => syncMention(event.currentTarget), onBlur: () => setMention(null), onKeyUp: (event) => {
                            /* Arrows and Home/End move the caret without changing the text, so the menu would
                             * otherwise stay open on a mention the caret has left. */
                            if (event.key.startsWith('Arrow') || event.key === 'Home' || event.key === 'End') {
                                if (!(open && (event.key === 'ArrowDown' || event.key === 'ArrowUp')))
                                    syncMention(event.currentTarget);
                            }
                        }, onKeyDown: (event) => {
                            if (event.nativeEvent.isComposing)
                                return;
                            if (open) {
                                /* While the menu is up these keys belong to it. Enter picks a name rather than
                                 * posting, which is what every mention menu a person has used already does. */
                                if (event.key === 'ArrowDown') {
                                    event.preventDefault();
                                    cursor.move(1);
                                    return;
                                }
                                if (event.key === 'ArrowUp') {
                                    event.preventDefault();
                                    cursor.move(-1);
                                    return;
                                }
                                if (event.key === 'Enter' || event.key === 'Tab') {
                                    event.preventDefault();
                                    pick(offered[cursor.active]?.name ?? '');
                                    return;
                                }
                                if (event.key === 'Escape') {
                                    event.preventDefault();
                                    setMention(null);
                                    return;
                                }
                            }
                            // Enter sends, as in any chat; Shift+Enter is a new line, and Enter mid-composition picks an IME candidate.
                            if (event.key === 'Enter' && !event.shiftKey) {
                                event.preventDefault();
                                void send();
                            }
                        } }), open && ((0, jsx_runtime_1.jsx)(MentionMenu_tsx_1.MentionMenu, { agents: agents, query: mention.query, active: cursor.active, onPick: pick, id: MENU })), (0, jsx_runtime_1.jsxs)("div", { className: "row", children: [(0, jsx_runtime_1.jsx)("input", { value: viewName, placeholder: "Attach a view's rows (its name)", onChange: (event) => setViewName(event.target.value) }), (0, jsx_runtime_1.jsx)("button", { className: "btn primary", type: "submit", disabled: sending || (!text.trim() && !viewName.trim()), children: sending ? 'Posting…' : 'Post' })] })] })] }));
}
function MessageItem({ message, host, markdown }) {
    const from = message.from;
    const name = from.kind === 'AGENT' && host?.openAgent
        ? (0, jsx_runtime_1.jsx)("button", { className: "request-agentlink", onClick: () => host.openAgent?.(from.name), children: from.name })
        : from.name;
    return ((0, jsx_runtime_1.jsxs)("li", { className: `threadmessage from-${from.kind.toLowerCase()}`, children: [(0, jsx_runtime_1.jsxs)("header", { className: "row", children: [(0, jsx_runtime_1.jsx)("strong", { children: name }), (0, jsx_runtime_1.jsx)("span", { className: "hint", title: message.createdAt, children: when(message.createdAt) }), message.wordsOnly && (0, jsx_runtime_1.jsx)("span", { className: "hint", children: "nothing attached" })] }), (0, jsx_runtime_1.jsx)(Prose_tsx_1.Prose, { libs: markdown, text: message.text, className: "threadtext" }), message.attachments.map((a, i) => (0, jsx_runtime_1.jsx)(AttachmentCard, { attachment: a }, i))] }));
}
/* The thing itself, opened: a record's properties, or the rows a view returned when it was sent. */
function AttachmentCard({ attachment }) {
    const first = attachment.rows?.[0];
    const columns = first ? Object.keys(first).slice(0, 6) : [];
    return ((0, jsx_runtime_1.jsxs)("details", { className: "threadattachment", children: [(0, jsx_runtime_1.jsxs)("summary", { children: [(0, jsx_runtime_1.jsx)("span", { className: "pill", children: attachment.kind.toLowerCase() }), " ", attachment.label, attachment.id ? ` ${attachment.id}` : '', " \u2014 ", attachment.title] }), columns.length > 0 ? ((0, jsx_runtime_1.jsx)("div", { className: "tablewrap", children: (0, jsx_runtime_1.jsxs)("table", { className: "results-table", children: [(0, jsx_runtime_1.jsx)("thead", { children: (0, jsx_runtime_1.jsx)("tr", { children: columns.map((c) => (0, jsx_runtime_1.jsx)("th", { children: c }, c)) }) }), (0, jsx_runtime_1.jsx)("tbody", { children: attachment.rows.map((row, i) => ((0, jsx_runtime_1.jsx)("tr", { children: columns.map((c) => (0, jsx_runtime_1.jsx)("td", { children: String(row[c] ?? '') }, c)) }, i))) })] }) })) : ((0, jsx_runtime_1.jsx)("dl", { className: "threadproperties", children: Object.entries(attachment.properties ?? {}).map(([k, v]) => ((0, jsx_runtime_1.jsxs)(react_1.default.Fragment, { children: [(0, jsx_runtime_1.jsx)("dt", { children: k }), (0, jsx_runtime_1.jsx)("dd", { children: typeof v === 'object' ? JSON.stringify(v) : String(v) })] }, k))) })), attachment.capturedAt && (0, jsx_runtime_1.jsxs)("p", { className: "hint", children: ["as it was ", when(attachment.capturedAt)] })] }));
}
//# sourceMappingURL=ThreadsSurface.js.map