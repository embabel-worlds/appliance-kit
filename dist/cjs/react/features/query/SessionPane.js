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
exports.SessionPane = SessionPane;
const jsx_runtime_1 = require("react/jsx-runtime");
/*
 * SESSION — the REPL reading of Query Studio. One line in, one result out, state accumulates.
 *
 * Enter ELABORATES the line (the kit's session grammar, `@embabel/appliance-kit/vc`), runs the
 * session form against the appliance —
 * capturing subset-shaped results as scopes, auto-named `_1`, `_2`, … — and appends to the
 * transcript. The `ran` line always shows the completed Cypher, so the terseness teaches the
 * real language rather than hiding it. The Cypher toggle shows the PIPELINE: the one real,
 * scope-free query this session has built, which "Open in editor" hands to the Query pane where
 * Save-as-view lives.
 *
 * Membership is frozen, values are live — said once, in the panel aside, not per row.
 */
const react_1 = require("react");
const kg_ts_1 = require("../../../client/kg.js");
const outcome_ts_1 = require("../../../client/outcome.js");
const index_ts_1 = require("../../../vc/index.js");
const Vc = __importStar(require("../../../vc/index.js"));
const index_ts_2 = require("../../../studio-kit/index.js");
const sessionRewind_ts_1 = require("./sessionRewind.js");
const editor_ts_1 = require("../studio/editor.js");
const chrome_tsx_1 = require("../studio/chrome.js");
const QueryStudioSurface_tsx_1 = require("./QueryStudioSurface.js");
const runtime_tsx_1 = require("./runtime.js");
/* THE SESSION SURVIVES LEAVING THE TAB — kept on the CLIENT, per browser, like the rail's
 * History list. Rows are deliberately NOT persisted (they can be large and re-running is one
 * Enter); everything else is: the transcript lines, the ↑/↓ input history, the BINDINGS (so a
 * continuation like `WHERE c.…` still works after coming back — the scopes live server-side
 * with their own TTL, and an expired one fails with the honest unknown-scope message), and the
 * pipeline display. */
const MAX_SAVED_ENTRIES = 200;
const MAX_SAVED_INPUTS = 100;
const HELP = [
    ['MATCH (c:Chunk)', 'open a set — RETURN c implied, captured as a binding'],
    ['WHERE c.source CONTAINS ‘x’', 'the next clause — narrows the newest set'],
    ['MATCH (c)<-[:HAS_CHUNK]-(d:Document)', 'continue from a variable you bound'],
    ['RETURN d.title, d.uri', 'project — shown, not captured'],
    ['contracts = MATCH (d:Document) …', 'name a binding · pin contracts keeps it'],
    ['$contracts', 'peek a binding'],
];
function SessionPane({ onCaptured, onOpenInEditor }) {
    const { services, host } = (0, runtime_tsx_1.useQueryRuntime)();
    const saved = (0, react_1.useRef)(host.interactive.session.read()).current;
    const [entries, setEntries] = (0, react_1.useState)(saved?.entries ?? []);
    const [busy, setBusy] = (0, react_1.useState)(false);
    const [showPipeline, setShowPipeline] = (0, react_1.useState)(false);
    const [showHelp, setShowHelp] = (0, react_1.useState)(!saved || saved.entries.length === 0);
    const bindings = (0, react_1.useRef)(saved?.bindings ?? []);
    const counter = (0, react_1.useRef)(saved?.counter ?? 0);
    const inputHistory = (0, react_1.useRef)(saved?.inputs ?? []);
    const historyAt = (0, react_1.useRef)(-1);
    /* The prompt is a one-line CodeMirror, so ⌃Space (and type-ahead) complete from the SAME hint
     * the Query editor uses. Its alias context is synthesized from the session's own bindings —
     * `WHERE c.` completes Chunk's properties because the transcript bound `c` — by proxying
     * `getValue` to prepend one `MATCH (var:Label)` line per binding. Positions stay untouched:
     * the hint replaces text by cursor coordinates, which live on the REAL one-line editor. */
    const promptHost = (0, react_1.useRef)(null);
    const promptCm = (0, react_1.useRef)(null);
    const promptSchema = (0, react_1.useRef)(null);
    const submitRef = (0, react_1.useRef)(() => { });
    /* The session's one real query: the newest binding's stages, or the last projection's. */
    const [stages, setStages] = (0, react_1.useState)(saved?.stages ?? []);
    const [returnClause, setReturnClause] = (0, react_1.useState)(saved?.returnClause ?? null);
    const key = (0, react_1.useRef)((saved?.entries ?? []).reduce((m, e) => Math.max(m, e.key + 1), 0));
    const transcriptRef = (0, react_1.useRef)(null);
    const findBinding = (name) => bindings.current.find((b) => b.name === name);
    /* The LATEST binding for a variable wins — re-MATCHing `c` rebinds the name, shell-style. */
    const findByVariable = (variable) => [...bindings.current].reverse().find((b) => b.variable === variable);
    const current = () => bindings.current.at(-1) ?? null;
    (0, react_1.useEffect)(() => {
        /* Refetched on focus, like the studio's own schema fetch: a realm installed in another tab
         * adds labels, and completion must not keep offering yesterday's graph. */
        const load = async () => {
            const outcome = await services.kg.schema();
            if ((0, outcome_ts_1.isOk)(outcome))
                promptSchema.current = outcome.value;
        };
        void load();
        const onFocus = () => void load();
        window.addEventListener('focus', onFocus);
        return () => window.removeEventListener('focus', onFocus);
    }, []);
    (0, react_1.useEffect)(() => {
        if (!promptHost.current || promptCm.current)
            return;
        // The kit's session-aware completion: the schema, plus this session's bindings as alias
        // context — `WHERE c.` completes Chunk's properties because the transcript bound `c`.
        const sessionHint = (0, index_ts_2.createSessionCypherHint)(editor_ts_1.CodeMirror, Vc, {
            schema: () => promptSchema.current,
            keywords: index_ts_2.CYPHER_KEYWORDS,
            bindings: () => bindings.current.map((b) => ({ variable: b.variable, label: b.label })),
        });
        const complete = () => cm.showHint({ completeSingle: false, hint: sessionHint });
        const recall = (dir) => {
            const past = inputHistory.current;
            if (past.length === 0)
                return;
            const at = historyAt.current === -1 ? past.length : historyAt.current;
            const next = dir === -1 ? Math.max(0, at - 1) : Math.min(past.length, at + 1);
            historyAt.current = next === past.length ? -1 : next;
            cm.setValue(next === past.length ? '' : past[next]);
            cm.setCursor({ line: 0, ch: cm.getLine(0).length });
        };
        const cm = editor_ts_1.CodeMirror(promptHost.current, {
            mode: 'application/x-cypher-query',
            lineNumbers: false,
            viewportMargin: Infinity,
            placeholder: 'MATCH (c:Chunk) — Enter runs, RETURN c implied',
            extraKeys: {
                Enter: () => submitRef.current(),
                Up: () => recall(-1),
                Down: () => recall(1),
                'Ctrl-Space': complete,
            },
        });
        // One line, always: a pasted multi-line query flattens rather than growing a second prompt row.
        cm.on('beforeChange', (_cm, change) => {
            if (change.text.length > 1 && change.update)
                change.update(change.from, change.to, [change.text.join(' ')]);
        });
        // Same open-as-you-type triggers as the big editor, against the session-aware hint.
        cm.on('inputRead', (_cm, change) => {
            if (change.origin !== '+input')
                return;
            const ch = change.text[change.text.length - 1] ?? '';
            if (!/[:.'{\w]/.test(ch))
                return;
            const cursor = cm.getCursor();
            const before = cm.getLine(cursor.line).slice(0, cursor.ch);
            if (/(\(\s*\w*:\w*|\[\s*\w*:\w*|\w+\.\w*|\w+$)/.test(before))
                complete();
        });
        promptCm.current = cm;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    /* The placeholder follows the session: an empty box must SAY it is the place to type, and what
     * a useful next line would be. Keyed on entries — a capture changes what "next" means. */
    (0, react_1.useEffect)(() => {
        const cur = current();
        promptCm.current?.setOption?.('placeholder', cur
            ? `WHERE ${cur.variable}.… · MATCH (${cur.variable})-[…]->(x:Label) · RETURN ${cur.variable}.… — Enter runs`
            : 'MATCH (c:Chunk) — Enter runs, RETURN c implied');
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [entries]);
    const persist = (nextEntries, nextStages, nextReturn) => {
        try {
            const slim = nextEntries.slice(-MAX_SAVED_ENTRIES).map(({ rows, ...rest }) => rest);
            host.interactive.session.write({
                entries: slim,
                bindings: bindings.current,
                counter: counter.current,
                stages: nextStages,
                returnClause: nextReturn,
                inputs: inputHistory.current.slice(-MAX_SAVED_INPUTS),
            });
        }
        catch { /* quota or private mode — the session just stops surviving, never breaks */ }
    };
    const stagesRef = (0, react_1.useRef)(stages);
    const returnRef = (0, react_1.useRef)(returnClause);
    const applyPipeline = (nextStages, nextReturn) => {
        stagesRef.current = nextStages;
        returnRef.current = nextReturn;
        setStages(nextStages);
        setReturnClause(nextReturn);
    };
    const append = (entry) => {
        setEntries((all) => {
            const next = [...all, { ...entry, key: key.current++ }];
            persist(next, stagesRef.current, returnRef.current);
            return next;
        });
        // Pinned to the newest line, like the trace.
        requestAnimationFrame(() => {
            const el = transcriptRef.current;
            if (el)
                el.scrollTop = el.scrollHeight;
        });
    };
    async function submit() {
        const line = (promptCm.current?.getValue() ?? '').trim();
        if (!line || busy)
            return;
        promptCm.current?.setValue('');
        inputHistory.current.push(line);
        historyAt.current = -1;
        setShowHelp(false);
        const plan = (0, index_ts_1.planLine)(line, current(), `_${counter.current + 1}`, findBinding, findByVariable);
        if (plan.kind === 'error') {
            return append({ input: line, tone: 'error', text: `✗ ${plan.error}` });
        }
        if (plan.kind === 'pin') {
            setBusy(true);
            const outcome = await services.kg.pinScope(plan.pinTarget);
            setBusy(false);
            if (!(0, outcome_ts_1.isOk)(outcome))
                return append({ input: line, tone: 'error', text: `✗ ${(0, chrome_tsx_1.failureMessage)(outcome, 'pinning')}` });
            return append({ input: line, tone: 'ok', text: `⇒ $${plan.pinTarget} pinned — survives until you delete it` });
        }
        setBusy(true);
        const outcome = await services.kg.execute(plan.cypher, plan.captureAs ? { captureAs: plan.captureAs } : {});
        setBusy(false);
        if (!(0, outcome_ts_1.isOk)(outcome)) {
            return append({ input: line, ran: plan.cypher, tone: 'error', text: `✗ ${(0, chrome_tsx_1.failureMessage)(outcome, 'the session line')}` });
        }
        if ((0, kg_ts_1.isBackgroundHandle)(outcome.value)) {
            return append({ input: line, ran: plan.cypher, tone: 'error', text: '✗ the appliance parked this run — sessions are synchronous' });
        }
        const result = outcome.value;
        if (result.error) {
            return append({ input: line, ran: plan.cypher, tone: 'error', text: `✗ ${result.error}` });
        }
        const rows = (result.rows ?? []);
        const captured = result.capturedScope;
        if (plan.captureAs && captured) {
            counter.current += 1;
            const pipeline = [...(plan.pipeline ?? [])];
            const binding = {
                name: captured.name,
                variable: plan.variable ?? 'x',
                label: captured.outputLabel,
                members: Number(captured.members),
                pipeline,
            };
            // A re-binding under an explicit name replaces its earlier entry rather than duplicating.
            bindings.current = [...bindings.current.filter((b) => b.name !== binding.name), binding];
            applyPipeline(pipeline, `RETURN ${plan.variable === undefined ? 'x' : plan.variable}`);
            onCaptured();
            const hint = result.hint && !rows.length ? ` · ${result.hint}` : '';
            const implied = plan.note ? ` · ${plan.note}` : '';
            return append({
                input: line,
                ran: plan.cypher,
                tone: 'ok',
                text: `⇒ $${captured.name} · ${captured.members} ${captured.outputLabel} as \`${binding.variable}\` · frozen${captured.expiresAt == null ? ' · pinned' : ''}${implied}${hint}`,
                rows,
                scope: captured.name,
            });
        }
        // Tabular (or a capture the appliance refused into a plain run — its message already showed).
        if (plan.tabularPipeline) {
            applyPipeline(plan.tabularPipeline.slice(0, -1), plan.tabularPipeline.at(-1) ?? null);
        }
        const parts = [`${rows.length} row(s)`];
        if (plan.tabular && plan.captureAs === undefined && plan.note)
            parts.push(plan.note);
        else if (plan.note)
            parts.push(plan.note);
        if (!rows.length && result.hint)
            parts.push(result.hint);
        for (const warning of result.warnings ?? [])
            parts.push(warning);
        append({ input: line, ran: plan.cypher, tone: 'note', text: `⇒ ${parts.join(' · ')}`, rows });
    }
    submitRef.current = () => void submit();
    /**
     * Delete a row of the script. A captured row's scope goes with it (server-side too), and its
     * binding leaves the session — later rows are UNAFFECTED because every binding carries its own
     * self-contained pipeline; only a future line referencing the deleted name will fail, honestly.
     * The displayed pipeline falls back to the newest surviving binding's.
     */
    const removeEntry = async (entry) => {
        if (entry.scope) {
            bindings.current = bindings.current.filter((b) => b.name !== entry.scope);
            const survivor = bindings.current.at(-1);
            applyPipeline(survivor?.pipeline ?? [], survivor ? `RETURN ${survivor.variable}` : null);
        }
        setEntries((all) => {
            const next = all.filter((e) => e.key !== entry.key);
            persist(next, stagesRef.current, returnRef.current);
            return next;
        });
        if (entry.scope) {
            await services.kg.deleteScope(entry.scope);
            onCaptured();
        }
    };
    /**
     * BACK OUT: drop this row and everything after it.
     *
     * The row ✕ above deletes ONE row and leaves the rest standing, which is right when a line was
     * simply a mistake — every binding carries its own self-contained pipeline, so the others are
     * genuinely unaffected. It is the wrong tool for a bad row you have since built on. A session is
     * read top to bottom, and once you decide a step was wrong, the steps you took because of it are
     * not results you want to keep looking at.
     *
     * So this is a rewind rather than a delete: the scopes go server-side, the bindings leave the
     * session, the pipeline falls back to the newest survivor, and the auto-name counter winds back
     * to the highest `_n` still standing — so the next capture is `_3` again, and the session is in
     * the state it was in before the bad line, not a state that merely looks like it.
     */
    const backOutFrom = async (entry) => {
        const index = entries.findIndex((e) => e.key === entry.key);
        if (index < 0)
            return;
        const scopes = entries.slice(index).map((e) => e.scope).filter((name) => !!name);
        bindings.current = bindings.current.filter((b) => !scopes.includes(b.name));
        const survivor = bindings.current.at(-1);
        applyPipeline(survivor?.pipeline ?? [], survivor ? `RETURN ${survivor.variable}` : null);
        counter.current = (0, sessionRewind_ts_1.rewoundCounter)(bindings.current.map((b) => b.name));
        const kept = entries.slice(0, index);
        setEntries(kept);
        persist(kept, stagesRef.current, returnRef.current);
        if (scopes.length > 0) {
            // Server-side too, exactly as the single-row delete does: a scope nothing references is
            // still holding a result set until its TTL, and the user just said they do not want it.
            await Promise.all(scopes.map((name) => services.kg.deleteScope(name)));
            onCaptured();
        }
    };
    /** Forget the local script (and its saved copy). Server-side scopes are untouched —
     *  they expire on their own TTL, or die with their rows' ✕. */
    const clearSession = () => {
        bindings.current = [];
        counter.current = 0;
        inputHistory.current = [];
        applyPipeline([], null);
        setEntries([]);
        setShowHelp(true);
        host.interactive.session.write(null);
    };
    const pipeline = (0, index_ts_1.pipelineText)(stages, returnClause);
    return ((0, jsx_runtime_1.jsxs)(chrome_tsx_1.StudioPanel, { title: "Interactive", aside: (0, jsx_runtime_1.jsxs)("span", { className: "row", children: [(0, jsx_runtime_1.jsx)("span", { className: "hint", children: "membership frozen \u00B7 values live" }), entries.length > 0 && ((0, jsx_runtime_1.jsx)("button", { className: "btn ghost tiny", title: "Forget this script locally \u2014 server scopes keep their own TTL", onClick: clearSession, children: "Clear" }))] }), children: [(0, jsx_runtime_1.jsxs)("div", { className: "progresslist session-transcript", ref: transcriptRef, children: [entries.length === 0 && showHelp && ((0, jsx_runtime_1.jsxs)("div", { className: "hint session-help", children: [(0, jsx_runtime_1.jsx)("p", { children: "Type a line, press Enter. Each set you build becomes a named binding." }), (0, jsx_runtime_1.jsx)("table", { children: (0, jsx_runtime_1.jsx)("tbody", { children: HELP.map(([what, does]) => ((0, jsx_runtime_1.jsxs)("tr", { children: [(0, jsx_runtime_1.jsx)("td", { children: (0, jsx_runtime_1.jsx)("code", { children: what }) }), (0, jsx_runtime_1.jsx)("td", { children: does })] }, what))) }) })] })), entries.map((entry, index) => ((0, jsx_runtime_1.jsxs)("div", { className: "session-entry", children: [(0, jsx_runtime_1.jsxs)("div", { className: "session-rowacts", children: [index < entries.length - 1 && ((0, jsx_runtime_1.jsxs)("button", { className: "btn ghost tiny session-back", title: `Back out: drop this row and the ${entries.length - index - 1} after it`, onClick: () => void backOutFrom(entry), children: ["\u293A", entries.length - index] })), (0, jsx_runtime_1.jsx)("button", { className: "btn ghost tiny session-del", title: entry.scope ? `Delete just this row and scope $${entry.scope}` : 'Delete just this row', onClick: () => void removeEntry(entry), children: "\u2715" })] }), (0, jsx_runtime_1.jsxs)("div", { className: "session-input", children: ["\u00BB ", entry.input] }), entry.ran && entry.ran !== entry.input && (0, jsx_runtime_1.jsxs)("div", { className: "session-ran hint", children: ["ran ", entry.ran] }), (0, jsx_runtime_1.jsx)("div", { className: `session-out ${entry.tone}`, children: entry.text }), entry.rows && entry.rows.length > 0 && ((0, jsx_runtime_1.jsxs)("details", { className: "session-rows", children: [(0, jsx_runtime_1.jsx)("summary", { className: "hint", children: "rows \u25B8" }), (0, jsx_runtime_1.jsx)(chrome_tsx_1.RowTable, { rows: entry.rows.slice(0, 25), columns: (0, index_ts_1.rowColumns)(entry.rows) })] }))] }, entry.key))), busy && (0, jsx_runtime_1.jsx)("div", { className: "hint", children: "running\u2026" })] }), (0, jsx_runtime_1.jsxs)("div", { className: "ask-row session-prompt", children: [(0, jsx_runtime_1.jsx)("span", { className: "session-mark", "aria-hidden": "true", children: "\u00BB" }), (0, jsx_runtime_1.jsx)("div", { className: "session-cm", ref: promptHost }), (0, jsx_runtime_1.jsx)("button", { className: "btn primary", disabled: busy, onClick: () => void submit(), children: "Enter" })] }), (0, jsx_runtime_1.jsx)("p", { className: "hint", children: current()
                    ? `next clause of $${current().name} — WHERE ${current().variable}.… · MATCH (${current().variable})-[…]->(x:Label) · RETURN ${current().variable}.… — ⌃Space completes`
                    : 'MATCH (c:Chunk) — RETURN c is implied · ⌃Space completes from the schema' }), (0, jsx_runtime_1.jsxs)("div", { className: "row", children: [(0, jsx_runtime_1.jsx)("button", { className: "btn ghost tiny", disabled: !stages.length && !returnClause, onClick: () => setShowPipeline((v) => !v), children: showPipeline ? 'Hide Cypher' : 'Cypher' }), showPipeline && pipeline && ((0, jsx_runtime_1.jsxs)(jsx_runtime_1.Fragment, { children: [(0, jsx_runtime_1.jsx)(chrome_tsx_1.CopyButton, { label: "Copy", text: pipeline }), (0, jsx_runtime_1.jsx)("button", { className: "btn ghost tiny", onClick: () => onOpenInEditor(pipeline), children: "Open in editor \u2192" })] })), pipeline && (0, jsx_runtime_1.jsx)(QueryStudioSurface_tsx_1.SaveView, { current: () => pipeline })] }), showPipeline && pipeline && (
            /* The one REAL query this session has built — scope-free, anchored, what a view keeps.
               It recomputes: data that moved since a capture froze can return different rows, which
               is what saving a view means. */
            (0, jsx_runtime_1.jsx)("pre", { className: "rawresult session-pipeline", children: pipeline }))] }));
}
//# sourceMappingURL=SessionPane.js.map