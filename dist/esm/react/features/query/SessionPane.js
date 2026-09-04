import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
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
import { useEffect, useRef, useState } from 'react';
import { isBackgroundHandle } from "../../../client/kg.js";
import { isOk } from "../../../client/outcome.js";
import { pipelineText, planLine, rowColumns, } from "../../../vc/index.js";
import * as Vc from "../../../vc/index.js";
import { CYPHER_KEYWORDS, createSessionCypherHint } from "../../../studio-kit/index.js";
import { rewoundCounter } from "./sessionRewind.js";
import { CodeMirror } from "../studio/editor.js";
import { CopyButton, RowTable, StudioPanel, failureMessage } from "../studio/chrome.js";
import { SaveView } from "./QueryStudioSurface.js";
import { useQueryRuntime } from "./runtime.js";
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
export function SessionPane({ onCaptured, onOpenInEditor }) {
    const { services, host } = useQueryRuntime();
    const saved = useRef(host.interactive.session.read()).current;
    const [entries, setEntries] = useState(saved?.entries ?? []);
    const [busy, setBusy] = useState(false);
    const [showPipeline, setShowPipeline] = useState(false);
    const [showHelp, setShowHelp] = useState(!saved || saved.entries.length === 0);
    const bindings = useRef(saved?.bindings ?? []);
    const counter = useRef(saved?.counter ?? 0);
    const inputHistory = useRef(saved?.inputs ?? []);
    const historyAt = useRef(-1);
    /* The prompt is a one-line CodeMirror, so ⌃Space (and type-ahead) complete from the SAME hint
     * the Query editor uses. Its alias context is synthesized from the session's own bindings —
     * `WHERE c.` completes Chunk's properties because the transcript bound `c` — by proxying
     * `getValue` to prepend one `MATCH (var:Label)` line per binding. Positions stay untouched:
     * the hint replaces text by cursor coordinates, which live on the REAL one-line editor. */
    const promptHost = useRef(null);
    const promptCm = useRef(null);
    const promptSchema = useRef(null);
    const submitRef = useRef(() => { });
    const active = useRef(true);
    const schemaGeneration = useRef(0);
    const operationGeneration = useRef(0);
    /* The session's one real query: the newest binding's stages, or the last projection's. */
    const [stages, setStages] = useState(saved?.stages ?? []);
    const [returnClause, setReturnClause] = useState(saved?.returnClause ?? null);
    const key = useRef((saved?.entries ?? []).reduce((m, e) => Math.max(m, e.key + 1), 0));
    const transcriptRef = useRef(null);
    const findBinding = (name) => bindings.current.find((b) => b.name === name);
    /* The LATEST binding for a variable wins — re-MATCHing `c` rebinds the name, shell-style. */
    const findByVariable = (variable) => [...bindings.current].reverse().find((b) => b.variable === variable);
    const current = () => bindings.current.at(-1) ?? null;
    useEffect(() => {
        active.current = true;
        /* Refetched on focus, like the studio's own schema fetch: a realm installed in another tab
         * adds labels, and completion must not keep offering yesterday's graph. */
        const load = async () => {
            const generation = ++schemaGeneration.current;
            const outcome = await services.kg.schema();
            if (!active.current || generation !== schemaGeneration.current)
                return;
            if (isOk(outcome))
                promptSchema.current = outcome.value;
        };
        void load();
        const onFocus = () => void load();
        window.addEventListener('focus', onFocus);
        return () => {
            active.current = false;
            schemaGeneration.current += 1;
            operationGeneration.current += 1;
            promptSchema.current = null;
            window.removeEventListener('focus', onFocus);
        };
    }, [services]);
    useEffect(() => {
        if (!promptHost.current || promptCm.current)
            return;
        // The kit's session-aware completion: the schema, plus this session's bindings as alias
        // context — `WHERE c.` completes Chunk's properties because the transcript bound `c`.
        const sessionHint = createSessionCypherHint(CodeMirror, Vc, {
            schema: () => promptSchema.current,
            keywords: CYPHER_KEYWORDS,
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
        const cm = CodeMirror(promptHost.current, {
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
        const beforeChange = (_cm, change) => {
            if (change.text.length > 1 && change.update)
                change.update(change.from, change.to, [change.text.join(' ')]);
        };
        cm.on('beforeChange', beforeChange);
        // Same open-as-you-type triggers as the big editor, against the session-aware hint.
        const inputRead = (_cm, change) => {
            if (change.origin !== '+input')
                return;
            const ch = change.text[change.text.length - 1] ?? '';
            if (!/[:.'{\w]/.test(ch))
                return;
            const cursor = cm.getCursor();
            const before = cm.getLine(cursor.line).slice(0, cursor.ch);
            if (/(\(\s*\w*:\w*|\[\s*\w*:\w*|\w+\.\w*|\w+$)/.test(before))
                complete();
        };
        cm.on('inputRead', inputRead);
        promptCm.current = cm;
        return () => {
            cm.off('beforeChange', beforeChange);
            cm.off('inputRead', inputRead);
            cm.getWrapperElement().remove();
            if (promptCm.current === cm)
                promptCm.current = null;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    /* The placeholder follows the session: an empty box must SAY it is the place to type, and what
     * a useful next line would be. Keyed on entries — a capture changes what "next" means. */
    useEffect(() => {
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
    const stagesRef = useRef(stages);
    const returnRef = useRef(returnClause);
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
        const plan = planLine(line, current(), `_${counter.current + 1}`, findBinding, findByVariable);
        if (plan.kind === 'error') {
            return append({ input: line, tone: 'error', text: `✗ ${plan.error}` });
        }
        if (plan.kind === 'pin') {
            const generation = ++operationGeneration.current;
            setBusy(true);
            const outcome = await services.kg.pinScope(plan.pinTarget);
            if (!active.current || generation !== operationGeneration.current)
                return;
            setBusy(false);
            if (!isOk(outcome))
                return append({ input: line, tone: 'error', text: `✗ ${failureMessage(outcome, 'pinning')}` });
            return append({ input: line, tone: 'ok', text: `⇒ $${plan.pinTarget} pinned — survives until you delete it` });
        }
        const generation = ++operationGeneration.current;
        setBusy(true);
        const outcome = await services.kg.execute(plan.cypher, plan.captureAs ? { captureAs: plan.captureAs } : {});
        if (!active.current || generation !== operationGeneration.current)
            return;
        setBusy(false);
        if (!isOk(outcome)) {
            return append({ input: line, ran: plan.cypher, tone: 'error', text: `✗ ${failureMessage(outcome, 'the session line')}` });
        }
        if (isBackgroundHandle(outcome.value)) {
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
            if (!active.current)
                return;
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
        counter.current = rewoundCounter(bindings.current.map((b) => b.name));
        const kept = entries.slice(0, index);
        setEntries(kept);
        persist(kept, stagesRef.current, returnRef.current);
        if (scopes.length > 0) {
            // Server-side too, exactly as the single-row delete does: a scope nothing references is
            // still holding a result set until its TTL, and the user just said they do not want it.
            await Promise.all(scopes.map((name) => services.kg.deleteScope(name)));
            if (!active.current)
                return;
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
    const pipeline = pipelineText(stages, returnClause);
    return (_jsxs(StudioPanel, { title: "Interactive", aside: _jsxs("span", { className: "row", children: [_jsx("span", { className: "hint", children: "membership frozen \u00B7 values live" }), entries.length > 0 && (_jsx("button", { className: "btn ghost tiny", title: "Forget this script locally \u2014 server scopes keep their own TTL", onClick: clearSession, children: "Clear" }))] }), children: [_jsxs("div", { className: "progresslist session-transcript", ref: transcriptRef, children: [entries.length === 0 && showHelp && (_jsxs("div", { className: "hint session-help", children: [_jsx("p", { children: "Type a line, press Enter. Each set you build becomes a named binding." }), _jsx("table", { children: _jsx("tbody", { children: HELP.map(([what, does]) => (_jsxs("tr", { children: [_jsx("td", { children: _jsx("code", { children: what }) }), _jsx("td", { children: does })] }, what))) }) })] })), entries.map((entry, index) => (_jsxs("div", { className: "session-entry", children: [_jsxs("div", { className: "session-rowacts", children: [index < entries.length - 1 && (_jsxs("button", { className: "btn ghost tiny session-back", title: `Back out: drop this row and the ${entries.length - index - 1} after it`, onClick: () => void backOutFrom(entry), children: ["\u293A", entries.length - index] })), _jsx("button", { className: "btn ghost tiny session-del", title: entry.scope ? `Delete just this row and scope $${entry.scope}` : 'Delete just this row', onClick: () => void removeEntry(entry), children: "\u2715" })] }), _jsxs("div", { className: "session-input", children: ["\u00BB ", entry.input] }), entry.ran && entry.ran !== entry.input && _jsxs("div", { className: "session-ran hint", children: ["ran ", entry.ran] }), _jsx("div", { className: `session-out ${entry.tone}`, children: entry.text }), entry.rows && entry.rows.length > 0 && (_jsxs("details", { className: "session-rows", children: [_jsx("summary", { className: "hint", children: "rows \u25B8" }), _jsx(RowTable, { rows: entry.rows.slice(0, 25), columns: rowColumns(entry.rows) })] }))] }, entry.key))), busy && _jsx("div", { className: "hint", children: "running\u2026" })] }), _jsxs("div", { className: "ask-row session-prompt", children: [_jsx("span", { className: "session-mark", "aria-hidden": "true", children: "\u00BB" }), _jsx("div", { className: "session-cm", ref: promptHost }), _jsx("button", { className: "btn primary", disabled: busy, onClick: () => void submit(), children: "Enter" })] }), _jsx("p", { className: "hint", children: current()
                    ? `next clause of $${current().name} — WHERE ${current().variable}.… · MATCH (${current().variable})-[…]->(x:Label) · RETURN ${current().variable}.… — ⌃Space completes`
                    : 'MATCH (c:Chunk) — RETURN c is implied · ⌃Space completes from the schema' }), _jsxs("div", { className: "row", children: [_jsx("button", { className: "btn ghost tiny", disabled: !stages.length && !returnClause, onClick: () => setShowPipeline((v) => !v), children: showPipeline ? 'Hide Cypher' : 'Cypher' }), showPipeline && pipeline && (_jsxs(_Fragment, { children: [_jsx(CopyButton, { label: "Copy", text: pipeline }), _jsx("button", { className: "btn ghost tiny", onClick: () => onOpenInEditor(pipeline), children: "Open in editor \u2192" })] })), pipeline && _jsx(SaveView, { current: () => pipeline })] }), showPipeline && pipeline && (
            /* The one REAL query this session has built — scope-free, anchored, what a view keeps.
               It recomputes: data that moved since a capture froze can return different rows, which
               is what saving a view means. */
            _jsx("pre", { className: "rawresult session-pipeline", children: pipeline }))] }));
}
//# sourceMappingURL=SessionPane.js.map