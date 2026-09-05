import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
/*
 * QUERY STUDIO — the virtual-Cypher surface, on the Worlds door.
 *
 * The Me app has had this for a while; the console had a Views runner that could show you a saved
 * query's rows but never what it asked, and no way to write one. Both now stand on the same three
 * packages, which is what makes them one product rather than two readings of a spec:
 *
 *  - `@embabel/appliance-kit` — the REST client, generated from the surface the assistant's
 *    contract test guards. Same calls, same typed outcomes, same "your appliance predates this".
 *  - `.../vc` — what the engine actually offers. Relevance is an EDGE and the mode is chosen AT
 *    the edge: no `via` is vector (about X), `via:'keyword'` is lexical (mentions X),
 *    `via:'agentic-rag'` with an `intent` is a bounded LLM loop judging every candidate. Three
 *    modes because they are three different questions. Nothing about the engine's shape is decided
 *    in this file.
 *  - `.../studio-kit` — the editor behaviour, so the same keystroke completes the same way here as
 *    it does in Me.
 *
 * Three honesty guarantees come from using the appliance's own surfaces rather than reimplementing
 * them: the SCHEMA panel and completion read the same snapshot the engine validates against;
 * VALIDATION is the engine's strict preflight run without execution, so "valid" here and "rejected"
 * there can never disagree; and the per-user scope is applied server-side, so an edited query can
 * be wrong but not unsafe.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { isBackgroundHandle, } from "../../../client/kg.js";
import { isOk } from "../../../client/outcome.js";
import { completeQuery, aliasMap, anchorLabels, declaredParams, rowColumns, rowsToCsv, rowsToMarkdown, scopeReference, } from "../../../vc/index.js";
import * as Vc from "../../../vc/index.js";
import { CYPHER_KEYWORDS, createCypherHint, createDefinitionTooltip, definitionTitle, formatDuration } from "../../../studio-kit/index.js";
import { CodeMirror, useEditor } from "../studio/editor.js";
import { useRunProgress } from "../studio/progress.js";
import { CopyButton, RowTable, Status, StudioPanel, failureMessage, isAbsent } from "../studio/chrome.js";
import { SessionPane } from "./SessionPane.js";
import { QueryRuntimeProvider, useQueryRuntime } from "./runtime.js";
/*
 * The hint is registered against the CodeMirror SINGLETON, so it must happen exactly once for the
 * app rather than once per mount. `schema()` reads through a mutable box instead of closing over a
 * value: the helper is installed before any schema has arrived, and a captured `null` would mean
 * completion stayed empty for the life of the page.
 */
const schemaBox = { current: null };
let schemaOwner = null;
let hintRegistered = false;
function registerHint() {
    if (hintRegistered)
        return;
    hintRegistered = true;
    CodeMirror.registerHelper('hint', 'cypher', createCypherHint(CodeMirror, Vc, { schema: () => schemaBox.current, keywords: CYPHER_KEYWORDS }));
}
const HISTORY_MAX = 20;
/**
 * THE RUN TO KILL, WHEN THE TRACE NEVER NAMED ONE.
 *
 * Stop normally uses the id the trace bound, because the run registry is keyed by the SSE queryId
 * by design. But the stream is opened as the execute request goes out, and a connection that
 * completes a few milliseconds late misses `query.started` — the run is perfectly killable, we just
 * never heard its id, and a Stop button that gives up there is the complaint this feature exists to
 * answer.
 *
 * So ask: `GET /kg/runs` is the appliance's own account of what this user is running. Match on the
 * cypher AS SUBMITTED and take the most recent, since one user can legitimately have several runs
 * in flight and the same text twice is the only case this cannot separate — a race the trace path
 * has too, and one that costs a wrong cancel rather than a wrong answer.
 */
async function inFlightRunId(services, cypher) {
    if (!cypher)
        return null;
    const outcome = await services.kg.runs();
    if (!isOk(outcome))
        return null;
    const mine = outcome.value
        .filter((run) => run.cypher.trim() === cypher)
        .sort((a, b) => b.startedAt - a.startedAt);
    return mine[0]?.runId ?? null;
}
/**
 * @param handedOver cypher arriving from another tab (a view expanded in Views), landed once. A
 *   changing value lands again; null never clobbers what is already in the editor.
 */
export function QueryStudioSurface({ services, host, handedOver }) {
    return (_jsx(QueryRuntimeProvider, { services: services, host: host, children: _jsx(QueryStudioBody, { handedOver: handedOver }) }));
}
function QueryStudioBody({ handedOver }) {
    const { services, host } = useQueryRuntime();
    const [schema, setSchema] = useState(null);
    const [validity, setValidity] = useState({ tone: null, text: '', violations: [] });
    /*
     * WHETHER THE VIOLATIONS ARE ON SCREEN, which is not the same question as whether the query is
     * valid.
     *
     * The preflight runs as you type, and half-typed Cypher is invalid by construction: `e.d` on the
     * way to `e.division` gets back a paragraph explaining that `d` is not a property of Electorate
     * and listing the twelve that are. Correct, useful when you asked, and — arriving mid-keystroke,
     * in red — it makes the editor look broken rather than helpful.
     *
     * So the PILL stays live: a quiet ✓ or "3 schema problems", which is a signal and costs nothing
     * to glance past. The PROSE waits until you ask for an answer (Run) or ask for it directly (the
     * pill is a button while there is something to show). Typing hides it again, because a verdict
     * is stale the moment the text moves.
     */
    const [showViolations, setShowViolations] = useState(false);
    const [runStatus, setRunStatus] = useState({ tone: null, text: '' });
    const [rows, setRows] = useState([]);
    /* The WHOLE result, because `apiCallLog`, `llmCallLog` and the call counts ride on it and were
     * being thrown away — they are what the Vaadin console's Stats view is made of. */
    const [result, setResult] = useState(null);
    const [view, setView] = useState('table');
    const [pane, setPane] = useState('query');
    const [ran, setRan] = useState(false);
    const [running, setRunning] = useState(false);
    /* A kill has been asked for and the run has not answered yet. Separate from `running` because
     * the two overlap: the query is still in flight for as long as it takes the engine to notice. */
    const [stopping, setStopping] = useState(false);
    const runningCypher = useRef(null);
    const [history, setHistory] = useState(() => host.history.read() ?? []);
    /* Bumped whenever a capture lands, so the Scopes rail re-reads without owning the execute path. */
    const [scopesVersion, setScopesVersion] = useState(0);
    const [fillsVersion, setFillsVersion] = useState(0);
    /* What the engine is doing while we wait. The appliance has published this trace all along; not
     * reading it is why a slow run looked identical to a wedged one. */
    const progress = useRunProgress(services.subscribeProgress);
    /* Pinned to the newest line: the one that just arrived is the one being stared at while someone
     * decides whether this run is worth waiting for. */
    const progressRef = useRef(null);
    // Validation stops asking for good once an appliance answers "no such endpoint" — nagging per
    // keystroke about a feature this server simply does not have helps nobody.
    const validateSupported = useRef(true);
    const validateTimer = useRef(null);
    const validatedCypher = useRef(null);
    const active = useRef(true);
    const schemaGeneration = useRef(0);
    const validationGeneration = useRef(0);
    const runGeneration = useRef(0);
    const owner = useRef(Symbol('query-schema-owner')).current;
    const runRef = useRef(() => { });
    /* Both callbacks go through refs rather than being passed directly. `scheduleValidation`
     * reaches `validateNow`, which reads `handle` — which comes out of this very call — so naming it
     * here would be a circular inference TypeScript gives up on. The ref breaks the cycle and, as a
     * bonus, keeps the editor from caring that a callback identity moved. */
    const editRef = useRef(() => { });
    const { ref: editorRef, handle } = useEditor({
        mode: 'application/x-cypher-query',
        onRun: () => runRef.current(),
        onEdit: () => editRef.current(),
    });
    registerHint();
    // ── the schema: one fetch, driving BOTH the browser panel and completion ────────────────────
    /* Fetched on mount AND on window focus: the schema changes underneath a long-lived tab — a
     * realm install adds labels — and a snapshot taken once at mount quietly stops matching what
     * the engine validates against. Focus is when someone comes back from installing something. */
    const loadSchema = useCallback(async () => {
        const generation = ++schemaGeneration.current;
        const outcome = await services.kg.schema();
        if (!active.current || generation !== schemaGeneration.current || schemaOwner !== owner)
            return;
        if (!isOk(outcome))
            return;
        setSchema(outcome.value);
        schemaBox.current = outcome.value;
    }, [owner, services]);
    useEffect(() => {
        active.current = true;
        schemaOwner = owner;
        validationGeneration.current += 1;
        runGeneration.current += 1;
        validateSupported.current = true;
        validatedCypher.current = null;
        setSchema(null);
        void loadSchema();
        const onFocus = () => void loadSchema();
        window.addEventListener('focus', onFocus);
        return () => {
            active.current = false;
            schemaGeneration.current += 1;
            validationGeneration.current += 1;
            runGeneration.current += 1;
            if (validateTimer.current)
                clearTimeout(validateTimer.current);
            validateTimer.current = null;
            window.removeEventListener('focus', onFocus);
            if (schemaOwner === owner) {
                schemaOwner = null;
                schemaBox.current = null;
            }
        };
    }, [loadSchema, owner]);
    /*
     * HOVER A LABEL, READ WHAT IT MEANS.
     *
     * The schema panel shows every declared definition, but the place labels are actually POINTED AT
     * is the query — hovering `Electorate` in your own Cypher should answer with the same declared
     * definition, and the tooltip is the kit's, so it is the same answer the Me app gives.
     *
     * Attached once the editor exists, and torn down with it: CodeMirror owns this DOM node and
     * React will not clean up listeners it never added.
     */
    useEffect(() => {
        const cm = handle.editor;
        if (!cm)
            return;
        const definitions = createDefinitionTooltip(document);
        const wrapper = cm.getWrapperElement();
        let hovered = null;
        const onMove = (e) => {
            const pos = cm.coordsChar({ left: e.clientX, top: e.clientY }, 'window');
            const token = cm.getTokenAt(pos);
            const word = token?.string ?? '';
            // coordsChar CLAMPS to the nearest character, so the cursor must genuinely be on the token —
            // otherwise the last word of a line answers for all the empty space after it.
            const start = cm.charCoords({ line: pos.line, ch: token.start }, 'window');
            const end = cm.charCoords({ line: pos.line, ch: token.end }, 'window');
            const inside = e.clientX >= start.left && e.clientX <= end.right
                && e.clientY >= start.top && e.clientY <= start.bottom;
            if (!inside) {
                hovered = null;
                return definitions.hide();
            }
            if (word === hovered)
                return;
            hovered = word;
            const box = { left: start.left, right: end.right, top: start.top, bottom: start.bottom };
            const labels = (schemaBox.current?.labels ?? []);
            const text = cm.getValue();
            // The cypher mode tokenizes `e:Electorate` as ONE atom, so the label is what follows the
            // colon. A bare alias (`e` in `e.division`) resolves through the query's own alias map, so
            // hovering it answers for its label too.
            const name = word.includes(':') ? word.slice(word.lastIndexOf(':') + 1) : word;
            const resolved = labels.some((l) => l.label === name) ? name : aliasMap(text)[name];
            const label = labels.find((l) => l.label === resolved);
            if (label) {
                return definitions.show(box, definitionTitle(label), label.description ?? '');
            }
            // `e.marginPct` → the PROPERTY's declared description: the alias before the dot names the
            // label, the token names the property.
            const owner = cm.getLine(pos.line).slice(0, token.start).match(/(\w+)\.$/);
            const ownerLabel = owner ? labels.find((l) => l.label === aliasMap(text)[owner[1] ?? '']) : undefined;
            const prop = ownerLabel?.properties?.find((pr) => pr.name === word && pr.description);
            if (prop && ownerLabel) {
                return definitions.show(box, `${ownerLabel.label}.${prop.name}`, prop.description ?? '');
            }
            definitions.hide();
        };
        const onLeave = () => { hovered = null; definitions.hide(); };
        wrapper.addEventListener('mousemove', onMove);
        wrapper.addEventListener('mouseleave', onLeave);
        return () => {
            wrapper.removeEventListener('mousemove', onMove);
            wrapper.removeEventListener('mouseleave', onLeave);
            definitions.hide();
        };
    }, [handle.editor]);
    // ── validation: the engine's strict preflight, debounced ────────────────────────────────────
    const validateNow = useCallback(async () => {
        // Validate what RUN will execute — the completed form — or the pill contradicts the Run button.
        const { cypher } = completeQuery(handle.getText());
        if (!cypher) {
            validatedCypher.current = null;
            return setValidity({ tone: null, text: '', violations: [] });
        }
        const generation = ++validationGeneration.current;
        const outcome = await services.kg.validate(cypher);
        if (!active.current || generation !== validationGeneration.current || completeQuery(handle.getText()).cypher !== cypher)
            return;
        if (!isOk(outcome)) {
            if (isAbsent(outcome))
                validateSupported.current = false;
            validatedCypher.current = null;
            return setValidity({ tone: null, text: '', violations: [] });
        }
        // `ok` IS the verdict on this endpoint — it means "this cypher passes the preflight", not
        // "the request worked". The handlers surface next door splits those into two booleans; this
        // one does not, and reading it as a transport result would call every rejected query valid.
        const { ok: valid, violations = [] } = outcome.value;
        validatedCypher.current = valid ? cypher : null;
        setValidity(valid
            ? { tone: 'ok', text: '✓ schema-valid', violations: [] }
            : { tone: 'error', text: `${violations.length} schema problem(s)`, violations });
    }, [handle, services]);
    const scheduleValidation = useCallback(() => {
        if (!validateSupported.current)
            return;
        if (validateTimer.current)
            clearTimeout(validateTimer.current);
        validationGeneration.current += 1;
        validatedCypher.current = null;
        setValidity((v) => ({ ...v, tone: null, text: '…' }));
        // Anything painted about the OLD text is wrong now.
        setShowViolations(false);
        validateTimer.current = setTimeout(() => void validateNow(), 700);
    }, [validateNow]);
    editRef.current = scheduleValidation;
    // ── running ─────────────────────────────────────────────────────────────────────────────────
    const run = useCallback(async () => {
        // A RETURN-less MATCH runs with its RETURN implied — same rule as the Session tab, so
        // `MATCH (c:Chunk)` is runnable everywhere. The editor's text is not rewritten.
        const { cypher, note: impliedNote } = completeQuery(handle.getText());
        if (!cypher || validatedCypher.current !== cypher)
            return;
        const generation = ++runGeneration.current;
        setRunning(true);
        setStopping(false);
        // The outcome is what you asked for; don't leave it on a tab nobody is looking at.
        setPane('results');
        /* The cypher AS SUBMITTED. Stop needs to name the run it is stopping, and by the time anyone
         * presses it the editor may hold something else entirely. */
        runningCypher.current = cypher;
        progress.begin();
        setView('trace');
        // Asking for an answer is asking why you cannot have one.
        setShowViolations(true);
        setRows([]);
        setResult(null);
        setRan(false);
        setRunStatus({ tone: null, text: 'Running — relevance joins fetch live, give it a moment…' });
        const outcome = await services.kg.execute(cypher);
        if (!active.current || generation !== runGeneration.current)
            return;
        setRunning(false);
        setStopping(false);
        runningCypher.current = null;
        /* The rows are here, so nothing further is coming — but the LINES stay on screen. Someone who
         * waited forty seconds is owed the account of where it went. */
        progress.end();
        if (!isOk(outcome)) {
            return setRunStatus({ tone: 'error', text: failureMessage(outcome, 'query execution') });
        }
        // `execute` has two success shapes. Without `background` this is always the finished result,
        // but the type says otherwise and reading `rows` off a handle would silently show zero rows.
        // The guard identifies the handle by its `runId` — testing for a MISSING `rowCount` instead
        // threw away the rows of any result that did not send one, which is how this looked in
        // practice: "parked in the background", over a payload holding the answer.
        if (isBackgroundHandle(outcome.value)) {
            return setRunStatus({ tone: 'caution', text: 'This query is running in the background.' });
        }
        const result = outcome.value;
        /* A KILLED run comes back 200, with no error and no rows — so the generic path below would
         * report "0 row(s)", which is the one thing it must never say. Zero rows because you stopped it
         * is not zero rows because the graph is empty, and `reason` exists exactly so a client need not
         * guess from the hint text. The hint is the engine's own: committed work is KEPT, so re-running
         * resumes from the first cold anchor rather than starting over. */
        if (result.reason === 'KILLED') {
            return setRunStatus({
                tone: 'caution',
                text: `Stopped. ${result.hint ?? 'Work already materialized is kept — run it again to resume from there.'}`,
            });
        }
        const rows = (result.rows ?? []);
        // `rowCount` is documented as required and is not always sent. The rows are the truth.
        const rowCount = result.rowCount ?? rows.length;
        const parts = [`${rowCount} row(s)`];
        if (impliedNote)
            parts.push(impliedNote);
        if (result.durationMs != null)
            parts.push(formatDuration(result.durationMs));
        for (const warning of result.warnings ?? [])
            parts.push(warning);
        if (!rowCount && result.hint)
            parts.push(result.hint);
        if (result.error)
            return setRunStatus({ tone: 'error', text: result.error });
        setRunStatus({ tone: (result.warnings ?? []).length ? 'caution' : 'ok', text: parts.join(' · ') });
        setRows(rows);
        setResult(result);
        setRan(true);
        // The rows are the answer; the trace was the wait. Go back to the answer.
        setView('table');
        setHistory((entries) => {
            const next = [{ cypher, rows: rowCount, at: new Date().toISOString() },
                ...entries.filter((e) => e.cypher !== cypher)].slice(0, HISTORY_MAX);
            host.history.write(next);
            return next;
        });
    }, [handle, progress, services]);
    runRef.current = () => void run();
    /*
     * STOPPING A RUN. The execute POST stays open — the appliance answers it with the typed KILLED
     * outcome once the kill lands, and that answer is where the "Stopped" status comes from. Nothing
     * here aborts the request: a client that hung up would leave the run going on the server and
     * would have to invent an explanation for a query it stopped watching.
     *
     * Cancellation is COOPERATIVE server-side — the expensive loops check a flag at their
     * boundaries, so granularity is about one model call. Stop is therefore a request, not a switch,
     * and the status says so rather than freezing the button and looking broken.
     */
    const stop = useCallback(async () => {
        setStopping(true);
        setRunStatus({ tone: null, text: 'Stopping — the engine checks between steps, so this can take a moment…' });
        const runId = progress.runId ?? (await inFlightRunId(services, runningCypher.current));
        if (!runId) {
            setStopping(false);
            return setRunStatus({ tone: 'caution', text: 'No matching query is still running, so it could not be stopped.' });
        }
        const outcome = await services.kg.kill(runId);
        if (!isOk(outcome)) {
            setStopping(false);
            return setRunStatus({ tone: 'error', text: failureMessage(outcome, 'stopping the run') });
        }
        /* `killed: false` means the registry had no such run — it finished between the click and the
         * call. The execute POST is about to return the real answer, so say nothing that contradicts
         * the rows that are one moment away. */
        if (!outcome.value.killed)
            setStopping(false);
    }, [progress.runId]);
    const land = useCallback((cypher) => {
        validatedCypher.current = null;
        handle.setText(cypher);
        scheduleValidation();
    }, [handle, scheduleValidation]);
    /* Recalling from History replaces the editor text, and the replaced text may be work in
     * progress — so it is stashed as a history entry first (rows null, shown as "not run"),
     * making the overwrite lossless. Collapsing the panel and focusing the editor are what
     * make the click VISIBLE: with History expanded above the editor, the landed text was
     * below the fold and a click looked like it did nothing. */
    const historyRef = useRef(null);
    const recall = useCallback((cypher) => {
        const current = handle.getText();
        if (current.trim() && current !== cypher) {
            setHistory((entries) => {
                if (entries.some((e) => e.cypher === current))
                    return entries;
                const next = [{ cypher: current, rows: null, at: new Date().toISOString() }, ...entries].slice(0, HISTORY_MAX);
                host.history.write(next);
                return next;
            });
        }
        land(cypher);
        historyRef.current?.removeAttribute('open');
        handle.editor?.focus();
    }, [handle, land]);
    /* Landed on arrival AND on change, so opening the same view twice still works. The editor is
     * created asynchronously, so this waits for it rather than firing into nothing. */
    const landed = useRef(null);
    useEffect(() => {
        if (!handedOver || !handle.editor || landed.current === handedOver)
            return;
        landed.current = handedOver;
        land(handedOver);
    }, [handedOver, handle.editor, land]);
    useEffect(() => {
        const el = progressRef.current;
        if (el)
            el.scrollTop = el.scrollHeight;
    }, [progress.lines]);
    /* CM5 measures itself against a laid-out DOM, and a `display: none` pane has no dimensions. An
     * editor coming back on screen therefore renders blank, or drops the cursor in the wrong place,
     * until it is told to measure again. This is the whole cost of hiding rather than unmounting,
     * and it is a cheap one. */
    useEffect(() => {
        if (pane === 'query')
            handle.editor?.refresh();
    }, [pane, handle.editor]);
    const columns = rowColumns(rows);
    return (_jsxs("div", { className: "kit-feature kit-feature-query studio", children: [_jsxs("div", { className: "studio-side", children: [_jsx(SchemaPanel, { schema: schema, onInsert: land, onReload: () => void loadSchema() }), _jsx(ScopesPanel, { version: scopesVersion, onInsert: land }), _jsx(FillsPanel, { version: fillsVersion })] }), _jsxs("div", { className: "studio-tabbed", children: [_jsx("nav", { className: "studiotabs", role: "tablist", children: ['query', 'results', 'session'].map((p) => (_jsx("button", { role: "tab", "aria-selected": pane === p, className: `studiotab${pane === p ? ' is-on' : ''}`, onClick: () => setPane(p), children: p === 'query' ? 'Query' : p === 'session' ? 'Interactive' : progress.live ? 'Results ●' : 'Results' }, p))) }), _jsxs("div", { className: "studio-pane studio-pane-query", hidden: pane !== 'query', children: [_jsx(Ask, { onLand: land, current: () => handle.getText() }), _jsxs("details", { className: "queryhistory", ref: historyRef, children: [_jsxs("summary", { className: "queryhistory-title", children: ["History \u00B7 ", history.length] }), history.length === 0 ? _jsx("p", { className: "hint", children: "Queries you run land here." }) : (_jsx("div", { className: "historylist", children: history.map((entry) => {
                                            const firstLine = entry.cypher.split('\n').find((l) => l.trim() && !l.trim().startsWith('//')) ?? entry.cypher;
                                            return (_jsxs("button", { className: "history-item", title: entry.cypher, onClick: () => recall(entry.cypher), children: [_jsx("span", { className: "history-cypher", children: firstLine }), _jsx("span", { className: "history-meta", children: entry.rows == null ? '· not run' : `· ${entry.rows} row(s)` })] }, entry.at));
                                        }) }))] }), _jsxs(StudioPanel, { title: "Query", aside: validity.violations.length > 0 && !showViolations
                                    ? (_jsxs("button", { className: "status error as-link", onClick: () => setShowViolations(true), children: [validity.text, " \u2014 show"] }))
                                    : _jsx(Status, { tone: validity.tone, children: validity.text }), children: [_jsxs("div", { className: "editor-wrap", children: [_jsx("div", { className: "editor-host", ref: editorRef }), _jsx(CopyButton, { label: "Copy", text: handle.getText() })] }), showViolations && validity.violations.length > 0 && (_jsx("div", { className: "verdict", children: validity.violations.map((v, i) => _jsx("div", { className: "violation", children: v }, i)) })), _jsxs("div", { className: "row studio-actions", children: [_jsx("button", { className: "btn primary", disabled: running || validity.tone !== 'ok'
                                                    || validatedCypher.current !== completeQuery(handle.getText()).cypher, onClick: () => void run(), children: running ? 'running…' : 'Run ⌘⏎' }), running && (_jsx("button", { className: "btn ghost", onClick: () => void stop(), children: stopping ? 'stopping…' : 'Stop' })), _jsx(SaveView, { current: () => handle.getText() }), _jsx(CaptureScope, { current: () => handle.getText(), onCaptured: () => setScopesVersion((v) => v + 1) }), _jsx(StartFill, { current: () => completeQuery(handle.getText()).cypher, onStarted: () => setFillsVersion((v) => v + 1) }), _jsx("span", { className: "hint", children: "\u2303Space completes from the schema" })] })] })] }), _jsx("div", { className: "studio-pane", hidden: pane !== 'results', children: _jsxs(StudioPanel, { title: "Results", aside: (ran || progress.lines.length > 0) && (_jsx("span", { className: "viewtabs", role: "tablist", children: ['table', 'raw', 'stats', 'trace'].map((v) => (_jsx("button", { role: "tab", "aria-selected": view === v, className: `viewtab${view === v ? ' is-on' : ''}`, onClick: () => setView(v), children: v === 'trace' && progress.live ? 'Trace ●' : v[0].toUpperCase() + v.slice(1) }, v))) })), children: [view === 'table' && (!ran ? _jsx("p", { className: "hint", children: "Nothing run yet." }) :
                                    rows.length === 0 ? _jsx("p", { className: "hint", children: "No rows." }) :
                                        _jsx(RowTable, { rows: rows, columns: columns })), view === 'raw' && (!ran ? _jsx("p", { className: "hint", children: "Nothing run yet." }) :
                                    _jsx("pre", { className: "rawresult", children: JSON.stringify(result ?? rows, null, 2) })), view === 'stats' && _jsx(ResultStats, { result: result, rowCount: rows.length, ran: ran }), view === 'trace' && (_jsxs("div", { className: "progresslist", ref: progressRef, children: [progress.lines.map((line) => (_jsx("div", { className: `progressline${line.failed ? ' failed' : ''}`, children: line.text }, line.key))), progress.lines.length === 0 && (_jsx("p", { className: "hint", children: progress.live
                                                ? 'Waiting for the engine to report…'
                                                : 'No trace is available for queries without virtual labels.' }))] })), _jsxs("div", { className: "row results-foot", children: [ran && rows.length > 0 && view === 'table' && (_jsxs(_Fragment, { children: [_jsx(CopyButton, { label: "Copy as Markdown", text: rowsToMarkdown(rows) }), _jsx(CopyButton, { label: "Copy as CSV", text: rowsToCsv(rows) })] })), _jsx(Status, { tone: runStatus.tone, children: runStatus.text })] })] }) }), _jsx("div", { className: "studio-pane", hidden: pane !== 'session', children: _jsx(SessionPane, { onCaptured: () => setScopesVersion((v) => v + 1), onOpenInEditor: (cypher) => { land(cypher); setPane('query'); } }) })] })] }));
}
// ── ask: English in, Cypher out ───────────────────────────────────────────────────────────────
/**
 * Generation only, never execution. The appliance can generate and run in one call (`/ask`), but a
 * studio that ran generated Cypher before showing it would spend the user's money on a query they
 * never saw. Generate, land it in the editor, let them read it, let them press Run.
 */
function Ask({ onLand, current }) {
    const { services } = useQueryRuntime();
    const [question, setQuestion] = useState('');
    const [instruction, setInstruction] = useState('');
    const [busy, setBusy] = useState(false);
    const [status, setStatus] = useState({ tone: null, text: '' });
    const [explanation, setExplanation] = useState('');
    async function go(refine) {
        // Two boxes, two questions: one describes the query you want, the other the change you want
        // made to the one on screen. Sharing a box made "refine" read as a second Write.
        const text = (refine ? instruction : question).trim();
        if (!text)
            return;
        setBusy(true);
        setExplanation('');
        setStatus({ tone: null, text: refine ? 'Revising your query…' : 'Writing the query…' });
        const outcome = refine ? await services.kg.refine(current(), text) : await services.kg.generate(text);
        setBusy(false);
        if (!isOk(outcome)) {
            return setStatus({ tone: 'error', text: failureMessage(outcome, refine ? 'query refinement' : 'query generation') });
        }
        const generated = outcome.value;
        if (!generated.cypher)
            return setStatus({ tone: 'error', text: 'Nothing came back.' });
        onLand(generated.cypher);
        setExplanation(generated.explain ?? '');
        // Generation reports the preflight verdict on what it wrote, so a query that will be rejected
        // says so here rather than at Run.
        setStatus(generated.valid
            ? { tone: 'ok', text: 'Landed in the editor — read it before you run it.' }
            : { tone: 'error', text: `Landed, but it has ${(generated.violations ?? []).length} schema problem(s).` });
    }
    return (_jsxs(StudioPanel, { title: "Ask", children: [_jsxs("div", { className: "ask-row", children: [_jsx("input", { value: question, placeholder: "which documents mention the renewal? \u00B7 files about trip logistics\u2026", onChange: (e) => setQuestion(e.target.value), onKeyDown: (e) => { if (e.key === 'Enter')
                            void go(false); } }), _jsx("button", { className: "btn primary", disabled: busy, onClick: () => void go(false), children: "Write the query" })] }), _jsxs("div", { className: "ask-row", children: [_jsx("input", { value: instruction, placeholder: "refine what's in the editor: also show the margin \u00B7 sort by state \u00B7 drop the limit\u2026", onChange: (e) => setInstruction(e.target.value), onKeyDown: (e) => { if (e.key === 'Enter')
                            void go(true); } }), _jsx("button", { className: "btn", disabled: busy || !current().trim(), onClick: () => void go(true), children: "Refine" })] }), _jsx(Status, { tone: status.tone, children: status.text }), explanation && _jsx("p", { className: "hint", children: explanation })] }));
}
// ── the schema browser ────────────────────────────────────────────────────────────────────────
/**
 * The query a label should OPEN with.
 *
 * An anchor label reads bare. A reach-only one — `anchor: false`, meaning the engine will not let
 * it open a pattern — is composed REACHED, through an edge from an anchor the schema actually
 * shows, because the bare scan is precisely what the preflight rejects. Handing someone a query
 * that cannot run is worse than handing them nothing.
 *
 * `anchor` is absent on an older appliance, and absent is read as true: a server that does not
 * express the distinction has no reach-only labels to protect.
 */
function useQuery(schema, label) {
    const bare = `MATCH (n:${label.label})\nRETURN n LIMIT 25`;
    if (label.anchor !== false)
        return bare;
    const anchors = new Set(anchorLabels(schema));
    const relationships = (schema?.relationships ?? []);
    const inbound = relationships.find((r) => r.to === label.label && anchors.has(r.from));
    if (inbound)
        return `MATCH (a:${inbound.from})-[:${inbound.type}]->(n:${label.label})\nRETURN n LIMIT 25`;
    const outbound = relationships.find((r) => r.from === label.label && anchors.has(r.to));
    if (outbound)
        return `MATCH (n:${label.label})-[:${outbound.type}]->(a:${outbound.to})\nRETURN n LIMIT 25`;
    // Nothing in the schema reaches it. Say so in the query rather than composing a scan that fails.
    return `// ${label.label} is reach-only: traverse to it from a bound anchor\n${bare}`;
}
/**
 * The engine's OWN snapshot, virtual labels included — the same one validation checks against and
 * completion offers from. A hand-maintained list of labels would be a fourth reading of the graph
 * and the first to go stale.
 */
function SchemaPanel({ schema, onInsert, onReload }) {
    const [filter, setFilter] = useState('');
    const [open, setOpen] = useState(null);
    const labels = (schema?.labels ?? []);
    const needle = filter.trim().toLowerCase();
    // Alphabetical, not server order: the panel is a lookup, and lookups sort.
    const shown = (needle ? labels.filter((l) => l.label.toLowerCase().includes(needle)) : labels)
        .slice().sort((a, b) => a.label.localeCompare(b.label));
    return (_jsx(StudioPanel, { title: "Schema", aside: _jsxs("span", { className: "hint", children: [labels.length, " labels", onReload && (_jsx("button", { className: "btn ghost tiny", title: "Re-read the schema \u2014 after installing a realm", onClick: onReload, children: "\u21BB" }))] }), children: schema == null ? _jsx("p", { className: "hint", children: "loading\u2026" }) : (_jsxs(_Fragment, { children: [_jsx("input", { value: filter, placeholder: "filter labels", onChange: (e) => setFilter(e.target.value) }), _jsxs("div", { className: "schemalist", children: [shown.map((label) => (_jsxs("div", { className: "schemarow", children: [_jsxs("button", { className: "schemaname", onClick: () => setOpen((o) => (o === label.label ? null : label.label)), children: [_jsx("strong", { children: definitionTitle(label) }), label.anchor === false && _jsx("span", { className: "viewtag", children: "reach-only" })] }), _jsx("button", { className: "btn ghost tiny", title: useQuery(schema, label), onClick: () => onInsert(useQuery(schema, label)), children: "Query" }), open === label.label && label.description && _jsx("small", { className: "schemadesc", children: label.description }), open === label.label && (_jsxs("ul", { className: "proplist", children: [(label.properties ?? []).map((p) => (_jsxs("li", { children: [_jsx("code", { children: p.name }), p.description && _jsxs("span", { children: [" \u2014 ", p.description] })] }, p.name))), (label.properties ?? []).length === 0 && _jsx("li", { className: "hint", children: "no declared properties" })] }))] }, label.label))), shown.length === 0 && _jsxs("p", { className: "hint", children: ["nothing matches \"", filter, "\""] })] })] })) }));
}
// ── keeping what you wrote ────────────────────────────────────────────────────────────────────
/**
 * Save the query in the editor as a named view. Writing one belongs HERE, next to the thing being
 * written; browsing and running them is the Views tab.
 *
 * The APPLIANCE persists it — a console never edits world YAML itself, so what is stored is what
 * the server validated.
 */
export function SaveView({ current }) {
    const { services } = useQueryRuntime();
    const [open, setOpen] = useState(false);
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [busy, setBusy] = useState(false);
    const [status, setStatus] = useState({ tone: null, text: '' });
    /** Set when the saved body is not the body typed — see the note where it is assigned. */
    const [promoted, setPromoted] = useState(null);
    // The parameters this query declares, so saving one tells you what it will ask for.
    const declared = open ? declaredParams(current()) : [];
    /** This query's scope references, so the panel can say what promoting it will do BEFORE it runs. */
    const scopeRefs = open ? [...new Set([...current().matchAll(/`\$([A-Za-z_]\w*)`/g)].map((m) => m[1]))] : [];
    async function save() {
        const viewName = name.trim();
        const cypher = current().trim();
        if (!viewName || !cypher)
            return setStatus({ tone: 'error', text: 'a view needs a name and a query' });
        setBusy(true);
        const outcome = await services.kg.saveView(description.trim() ? { name: viewName, cypher, description: description.trim() } : { name: viewName, cypher });
        setBusy(false);
        if (!isOk(outcome))
            return setStatus({ tone: 'error', text: failureMessage(outcome, 'saving views') });
        if (!outcome.value.ok) {
            // THE APPLIANCE'S OWN WORDS. "The appliance refused it" threw away the one thing the
            // refusal was written to carry — which scope blocks the save, that it was captured with
            // LIMIT so its members are particular rows from one moment, and that a view re-runs. The
            // reader could act on that sentence and could do nothing at all with ours.
            const refusal = outcome.value.error;
            return setStatus({ tone: 'error', text: refusal || `Could not save '${viewName}'.` });
        }
        // PROMOTION IS NOT SILENT. A body written against captured scopes is stored with each
        // reference replaced by what the scope was captured from, so what the world keeps is not
        // the text that was typed. Showing it is the difference between the feature being true and
        // the author knowing it happened — and the note carries the part that changes underneath
        // them: a scope holds rows frozen at capture, a view asks the question again.
        setPromoted(outcome.value.savedCypher ? { cypher: outcome.value.savedCypher, note: outcome.value.note } : null);
        setStatus({ tone: 'ok', text: `Saved '${viewName}' — it is in the Views tab.` });
        setName('');
        setDescription('');
    }
    if (!open)
        return _jsx("button", { className: "btn", onClick: () => setOpen(true), children: "Save as view\u2026" });
    return (_jsxs("div", { className: "saveview", children: [_jsxs("div", { className: "row", children: [_jsxs("label", { className: "field", children: [_jsx("span", { children: "Name" }), _jsx("input", { value: name, placeholder: "recent_contracts", onChange: (e) => setName(e.target.value) })] }), _jsxs("label", { className: "field grow", children: [_jsx("span", { children: "Description" }), _jsx("input", { value: description, placeholder: "what this view answers", onChange: (e) => setDescription(e.target.value) })] })] }), declared.length > 0 && (_jsxs("p", { className: "hint", children: ["Declares ", declared.map((p) => `$${p}`).join(', '), " \u2014 they become its parameters."] })), scopeRefs.length > 0 && (_jsxs("p", { className: "hint", children: ["Uses ", scopeRefs.map((s) => `$${s}`).join(', '), " \u2014 saving inlines what each was captured from, because a scope expires and a view must not."] })), promoted && (_jsxs("div", { className: "promoted", children: [_jsx("p", { className: "hint", children: "Saved as \u2014 scope references written out, so it runs on its own:" }), _jsx("pre", { className: "promoted-cypher", children: promoted.cypher }), promoted.note && _jsx("p", { className: "hint", children: promoted.note })] })), _jsxs("div", { className: "row", children: [_jsx("button", { className: "btn primary", disabled: busy, onClick: () => void save(), children: busy ? 'saving…' : 'Save to this world' }), _jsx("button", { className: "btn ghost", onClick: () => { setOpen(false); setStatus({ tone: null, text: '' }); setPromoted(null); }, children: "Cancel" }), _jsx(Status, { tone: status.tone, children: status.text })] })] }));
}
// ── captured scopes: the REPL bindings ────────────────────────────────────────────────────────
/**
 * The session rail's scope list — the appliance's frozen result-set bindings, per acting user.
 * A scope is CONSUMED in a query as (x:`$name`); Use lands exactly that, opened as a peek. The
 * membership is frozen but the values are live, and the panel says so once rather than per row.
 *
 * Absent endpoint = older appliance: the panel says CONTRACT GAP once and stops asking, the same
 * honesty rule as the other surfaces on this door.
 */
/*
 * A FILL, AS THE SERVER ACTUALLY SENDS IT.
 *
 * `/admin/kg/fills` is outside the guarded OpenAPI snapshot, so this type is hand-written — which
 * is exactly the hazard `api.ts` names: "a hand-written type here would be a guess wearing a
 * type's clothes". This one guessed wrong. The server's `Fill` keeps its DEFINITION separate from
 * the half that changes every tick (`VcFillService.Fill` / `FillProgress`), so `state`, `ticks`,
 * `liveCallsTotal` and `lastError` arrive nested under `progress` — not flat, as this declared.
 *
 * The cost of that one wrong shape was the whole Query Studio tab: `f.state` was undefined,
 * `.toLowerCase()` threw during render, and React unmounted the tree to a blank page for anyone
 * who had a fill on record.
 *
 * So every field the panel reads is optional here and defaulted at the point of use. A type that
 * cannot be generated should claim the least it can get away with, not the most.
 */
/* "Run slowly": hand the query to the fill driver instead of this tab. The right verb for a
 * deep `periods:` history or an open sweep — the appliance advances it a budgeted, source-paced
 * chunk every couple of minutes, survives restarts, and the Fills panel carries the progress. */
function StartFill({ current, onStarted }) {
    const { services } = useQueryRuntime();
    const [busy, setBusy] = useState(false);
    const start = async () => {
        const cypher = current().trim();
        if (!cypher)
            return;
        setBusy(true);
        const r = await services.fills.create(cypher, (cypher.split('\n')[0] ?? '').slice(0, 60));
        setBusy(false);
        if (r.ok)
            onStarted();
    };
    return (_jsx("button", { className: "btn ghost", disabled: busy, onClick: () => void start(), title: "Run this query as a background fill: a budgeted chunk every couple of minutes until nothing is left to fetch. For deep histories and open sweeps.", children: busy ? 'starting…' : 'Fill' }));
}
/* EARN THE RAIL SPACE, same rule as Scopes: the panel exists only while fills exist. Polls while
 * any fill is RUNNING — progress is the point — and goes quiet once everything is DONE. */
function FillsPanel({ version }) {
    const { services } = useQueryRuntime();
    const [fills, setFills] = useState(null);
    const [supported, setSupported] = useState(true);
    useEffect(() => {
        if (!supported)
            return;
        let stop = false;
        const load = async () => {
            const r = await services.fills.list();
            if (stop)
                return;
            if (!r.ok) {
                if (r.status === 404)
                    setSupported(false);
                return;
            }
            setFills(r.value);
            if (r.value.some((f) => f.progress?.state === 'RUNNING'))
                setTimeout(() => { if (!stop)
                    void load(); }, 20000);
        };
        void load();
        return () => { stop = true; };
    }, [version, supported, services]);
    if (!supported || fills == null || fills.length === 0)
        return null;
    const cancel = async (id) => {
        await services.fills.delete(id);
        const r = await services.fills.list();
        if (r.ok)
            setFills(r.value);
    };
    return (_jsx(StudioPanel, { title: "Fills", aside: _jsx("span", { className: "hint", children: "slow background materializations" }), children: _jsx("div", { className: "schemalist", children: fills.map((f) => (_jsxs("div", { className: "schemarow", children: [_jsxs("div", { className: "schemaname", title: f.cypher, children: [_jsx("strong", { children: f.label || f.id }), _jsx("span", { className: `viewtag${f.progress?.state === 'RUNNING' ? '' : f.progress?.lastError ? ' is-bad' : ''}`, children: (f.progress?.state ?? 'pending').toLowerCase() }), _jsxs("small", { children: [f.progress?.ticks ?? 0, " tick(s) \u00B7 ", f.progress?.liveCallsTotal ?? 0, " live call(s)", f.progress?.lastError ? ` · ${f.progress.lastError.slice(0, 60)}` : ''] })] }), f.progress?.state === 'RUNNING' && (_jsx("button", { className: "btn ghost tiny", title: "Stop driving this fill \u2014 everything fetched stays cached", onClick: () => void cancel(f.id), children: "Cancel" }))] }, f.id))) }) }));
}
function ScopesPanel({ version, onInsert }) {
    const { services } = useQueryRuntime();
    const [scopes, setScopes] = useState(null);
    const [supported, setSupported] = useState(true);
    const [status, setStatus] = useState('');
    useEffect(() => {
        if (!supported)
            return;
        void (async () => {
            const outcome = await services.kg.scopes();
            if (!isOk(outcome)) {
                if (isAbsent(outcome))
                    setSupported(false);
                return;
            }
            setScopes(outcome.value.scopes ?? []);
        })();
    }, [version, supported, services]);
    const act = async (label, call) => {
        setStatus(label);
        await call();
        setStatus('');
        const outcome = await services.kg.scopes();
        if (isOk(outcome))
            setScopes(outcome.value.scopes ?? []);
    };
    /* EARN THE RAIL SPACE. An empty scopes panel above (or below) the schema is noise that
     * made the rail confusing — the panel appears once a capture EXISTS, which is also the
     * moment its contents mean something. An appliance without the surface shows nothing here;
     * the Interactive pane reports that honestly at the moment of a capture attempt. */
    if (!supported || scopes == null || scopes.length === 0)
        return null;
    return (_jsxs(StudioPanel, { title: "Scopes", aside: _jsx("span", { className: "hint", children: "frozen rows, live values" }), children: [scopes == null ? _jsx("p", { className: "hint", children: "loading\u2026" }) : scopes.length === 0 ? (_jsx("p", { className: "hint", children: "Run a query with \u201CCapture as scope\u201D and its rows become a named binding here." })) : (_jsx("div", { className: "schemalist", children: scopes.map((scope) => (_jsxs("div", { className: "schemarow", children: [_jsxs("button", { className: "schemaname", title: scope.statement, onClick: () => onInsert(`MATCH ${scopeReference(scope.name, 'x')}\nRETURN x LIMIT 25`), children: [_jsxs("strong", { children: ["$", scope.name] }), scope.expiresAt == null && _jsx("span", { className: "viewtag", children: "pinned" }), _jsxs("small", { children: [scope.outputLabel, " \u00B7 ", scope.members, " member(s)"] })] }), scope.expiresAt != null && (_jsx("button", { className: "btn ghost tiny", title: "Keep this scope until you delete it", onClick: () => void act(`pinning ${scope.name}…`, () => services.kg.pinScope(scope.name)), children: "Pin" })), _jsx("button", { className: "btn ghost tiny", title: "Delete this scope", onClick: () => void act(`deleting ${scope.name}…`, () => services.kg.deleteScope(scope.name)), children: "\u2715" })] }, scope.name))) })), status && _jsx("p", { className: "hint", children: status })] }));
}
/**
 * Run the query in the editor AND freeze its result set as a named scope — the appliance's
 * capture-on-execute, synchronous by contract. Kept beside Save-as-view deliberately: one keeps
 * the QUESTION, the other keeps this run's ROWS. The appliance refuses a projection (tabular —
 * nothing to freeze) and its message lands here verbatim.
 */
function CaptureScope({ current, onCaptured }) {
    const { services } = useQueryRuntime();
    const [open, setOpen] = useState(false);
    const [name, setName] = useState('');
    const [busy, setBusy] = useState(false);
    const [status, setStatus] = useState({ tone: null, text: '' });
    async function capture() {
        const scopeName = name.trim();
        // Same completion as Run and the Session tab: `MATCH (c:Chunk)` captures without a RETURN.
        const { cypher } = completeQuery(current());
        if (!cypher)
            return setStatus({ tone: 'error', text: 'nothing to capture — write a query first' });
        if (!scopeName)
            return setStatus({ tone: 'error', text: 'name the scope — the name is how a later query references it' });
        setBusy(true);
        setStatus({ tone: null, text: 'Running and freezing the result set…' });
        const outcome = await services.kg.execute(cypher, { captureAs: scopeName });
        setBusy(false);
        if (!isOk(outcome))
            return setStatus({ tone: 'error', text: failureMessage(outcome, 'capturing a scope') });
        if (isBackgroundHandle(outcome.value)) {
            return setStatus({ tone: 'error', text: 'This query is running in the background; capturing a scope requires a synchronous result.' });
        }
        const result = outcome.value;
        if (result.error)
            return setStatus({ tone: 'error', text: result.error });
        const captured = result.capturedScope;
        if (!captured)
            return setStatus({ tone: 'error', text: 'The run finished but nothing was captured.' });
        setStatus({
            tone: 'ok',
            text: `Captured ${captured.members} member(s) as $${captured.name} — reference it as (x:\`$${captured.name}\`).`,
        });
        setName('');
        onCaptured();
    }
    if (!open)
        return _jsx("button", { className: "btn", onClick: () => setOpen(true), children: "Capture as scope\u2026" });
    return (_jsxs("div", { className: "saveview", children: [_jsxs("div", { className: "row", children: [_jsxs("label", { className: "field", children: [_jsx("span", { children: "Scope name" }), _jsx("input", { value: name, placeholder: "overdue", onChange: (e) => setName(e.target.value) })] }), _jsx("button", { className: "btn primary", disabled: busy, onClick: () => void capture(), children: busy ? 'capturing…' : 'Run & capture' }), _jsx("button", { className: "btn ghost", onClick: () => { setOpen(false); setStatus({ tone: null, text: '' }); }, children: "Cancel" })] }), _jsx(Status, { tone: status.tone, children: status.text })] }));
}
// ── stats ─────────────────────────────────────────────────────────────────────────────────────
/**
 * What the run COST, in the Vaadin Cypher console's terms: wall time, external fetches, LLM calls,
 * rows — and then the calls themselves, in order.
 *
 * The logs are the point. `apiCallLog` is every fetch as `producer(key)`, in the order it
 * happened, so a repeated line is an N+1 fan-out you can SEE rather than infer from a duration.
 * `llmCallLog` is separate because a model call is a different kind of expensive from a fetch.
 *
 * All of it already rode on the execute response and was being discarded.
 */
function ResultStats({ result, rowCount, ran }) {
    if (!ran || !result)
        return _jsx("p", { className: "hint", children: "Nothing run yet." });
    const fetches = result.apiCallLog ?? [];
    const llm = result.llmCallLog ?? [];
    return (_jsxs("div", { className: "stats", children: [_jsxs("div", { className: "statline", children: [_jsx("span", { children: "Time" }), _jsx("strong", { children: formatDuration(result.durationMs ?? 0) })] }), _jsxs("div", { className: "statline", children: [_jsx("span", { children: "API calls" }), _jsx("strong", { children: (result.apiCalls ?? 0).toLocaleString() })] }), _jsxs("div", { className: "statline", children: [_jsx("span", { children: "LLM calls" }), _jsx("strong", { children: (result.llmCalls ?? 0).toLocaleString() })] }), _jsxs("div", { className: "statline", children: [_jsx("span", { children: "Rows" }), _jsx("strong", { children: (result.rowCount ?? rowCount).toLocaleString() })] }), fetches.length > 0 && (_jsxs("div", { className: "calllog", children: [_jsxs("div", { className: "subhead", children: ["Fetches (", fetches.length, ")"] }), fetches.map((c, i) => _jsx("div", { className: "callline", children: c }, i))] })), llm.length > 0 && (_jsxs("div", { className: "calllog", children: [_jsxs("div", { className: "subhead", children: ["LLM calls (", llm.length, ")"] }), llm.map((c, i) => _jsx("div", { className: "callline", children: c }, i))] })), fetches.length === 0 && llm.length === 0 && (_jsx("p", { className: "hint", children: "No external fetches and no model calls \u2014 this ran entirely on the graph." }))] }));
}
//# sourceMappingURL=QueryStudioSurface.js.map