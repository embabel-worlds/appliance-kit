"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SavedViewsSurface = SavedViewsSurface;
const jsx_runtime_1 = require("react/jsx-runtime");
/*
 * VIEWS — the world's saved questions, as a place rather than a panel.
 *
 * A view is the durable thing: someone worked out a question worth asking, named it, and now
 * anyone can ask it again with different arguments. That is not a sub-feature of the editor, so it
 * is not buried in the editor's rail — it is where you go when you want an ANSWER rather than a
 * query. Writing one is still Query Studio's job, and "Save as view" lives there.
 *
 * BECAUSE THERE IS NO EDITOR HERE, running is the appliance's ONE-CALL form: `runView` merges your
 * arguments over the declared defaults and returns rows. Query Studio deliberately uses the
 * two-step instead — invocation, then execute — because a studio should show you the cypher a view
 * expands to before it costs you anything. Same engine, two honest paths, and "Open in Query
 * Studio" is how you cross from this one to that one.
 */
const react_1 = require("react");
const outcome_ts_1 = require("../../../client/outcome.js");
const rows_ts_1 = require("../../../vc/rows.js");
const format_ts_1 = require("../../../studio-kit/format.js");
const chrome_tsx_1 = require("../studio/chrome.js");
const ViewsRuntimeContext = (0, react_1.createContext)(null);
function useViewsRuntime() {
    const runtime = (0, react_1.useContext)(ViewsRuntimeContext);
    if (!runtime)
        throw new Error('SavedViewsSurface runtime is missing');
    return runtime;
}
function SavedViewsSurface({ services, host }) {
    return (0, jsx_runtime_1.jsx)(ViewsRuntimeContext.Provider, { value: { services, host }, children: (0, jsx_runtime_1.jsx)(SavedViewsBody, {}) });
}
function SavedViewsBody() {
    const { services, host } = useViewsRuntime();
    const [views, setViews] = (0, react_1.useState)(null);
    const [error, setError] = (0, react_1.useState)('');
    const [selected, setSelected] = (0, react_1.useState)(null);
    const [args, setArgs] = (0, react_1.useState)({});
    const [expanded, setExpanded] = (0, react_1.useState)({});
    const [status, setStatus] = (0, react_1.useState)({ tone: null, text: '' });
    const [rows, setRows] = (0, react_1.useState)([]);
    const [ran, setRan] = (0, react_1.useState)(false);
    const [busy, setBusy] = (0, react_1.useState)(false);
    const load = (0, react_1.useCallback)(async () => {
        const outcome = await services.kg.views();
        if (!(0, outcome_ts_1.isOk)(outcome))
            return setError((0, chrome_tsx_1.failureMessage)(outcome, 'saved views'));
        setError('');
        setViews(outcome.value);
    }, [services]);
    (0, react_1.useEffect)(() => { void load(); }, [load]);
    /*
     * DRIVABLE FROM THE URL: `#views/<name>` selects a view, `#views/<name>/run` selects and runs it.
     *
     * The console's own vocabulary (place.ts owns `#tab/rest`, and Apps already reads it), which is
     * what makes a TOUR able to move this panel: a tour step says `run: view.X` and the app navigates
     * here and runs it, in the panel where the user would find it again — rather than printing a
     * table into a transcript somewhere else, which teaches them nothing about where results live.
     */
    /*
     * SUBSCRIBED, not read during render. A hash change from `#views/A/run` to `#views/B/run` keeps
     * the tab the same, so App's listener sets the same tab and React bails out of re-rendering —
     * this panel never learned it had been asked for a different view, and a tour's second `run:`
     * silently did nothing while its caption said otherwise. Seen in a screenshot: the caption
     * described PlaceDossier while the panel still showed DistrictCrimeLeague.
     */
    const hashRest = (0, react_1.useSyncExternalStore)(host.subscribeSelection, host.selectedView, host.selectedView);
    const drivenBy = (0, react_1.useRef)('');
    /** A driven run, waiting for React to apply the selection it depends on. */
    const pendingRun = (0, react_1.useRef)(false);
    (0, react_1.useEffect)(() => {
        if (!views)
            return;
        const rest = hashRest;
        if (!rest || rest === drivenBy.current)
            return;
        const [name, tail = ''] = rest.split('/');
        const wanted = views.find((v) => v.name === name);
        if (!wanted)
            return;
        drivenBy.current = rest;
        pick(wanted);
        // Point at the group heading when the drive had to OPEN it. A realm's views live behind a
        // collapsed heading, and a tour that expands it silently teaches the user nothing about where
        // they are — they see views appear and never learn they can get back to them.
        {
            setTimeout(() => {
                const head = document.querySelector(`[data-viewgroup="${CSS.escape(wanted.source || 'World')}"]`);
                if (!head)
                    return;
                head.classList.add('tour-flash');
                head.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
                setTimeout(() => head.classList.remove('tour-flash'), 1800);
            }, 120);
        }
        // `Name/run?domain=acme.com` — the arguments a tour supplies ride in the query, so a driven run
        // is the same act as a typed one and lands in the same fields, where the user can see and
        // change them.
        const [verb, query = ''] = tail.split('?');
        const supplied = Object.fromEntries(new URLSearchParams(query));
        if (Object.keys(supplied).length)
            setArgs((a) => ({ ...a, ...supplied }));
        // Run once the SELECTION HAS LANDED, not on a timer — see [pendingRun].
        if (verb === 'run')
            pendingRun.current = true;
    }, [views, hashRest]);
    const list = views ?? [];
    const view = list.find((v) => v.name === selected) ?? null;
    // The other half of the URL driving: the selection has landed, so the run can happen with the
    // view and its arguments actually in hand.
    (0, react_1.useEffect)(() => {
        if (!pendingRun.current || !view)
            return;
        pendingRun.current = false;
        void run();
    }, [view, args]);
    const params = (view?.params ?? {});
    /*
     * Provenance grouping. `source` is the realm that shipped a view; null means it was authored in
     * this world's own config. A flat list is unreadable the moment a few realms are aboard, and the
     * group header is also the answer to "where did this come from?".
     */
    const groups = {};
    for (const v of list)
        (groups[v.source || 'World'] ??= []).push(v);
    const groupNames = Object.keys(groups).sort((a, b) => (a === 'World' ? -1 : b === 'World' ? 1 : a.localeCompare(b)));
    function pick(v) {
        setExpanded((e) => ({ ...e, [v.source || 'World']: true }));
        setSelected(v.name);
        setStatus({ tone: null, text: '' });
        setRows([]);
        setRan(false);
        setArgs(Object.fromEntries(Object.entries((v.params ?? {}))
            .map(([k, spec]) => [k, spec?.default == null ? '' : String(spec.default)])));
    }
    /** A blank field means "use the declared default", NOT "pass an empty string". */
    const supplied = () => Object.fromEntries(Object.entries(args).filter(([, v]) => v !== '' && v != null));
    async function run() {
        if (!view)
            return;
        setBusy(true);
        setRows([]);
        setRan(false);
        setStatus({ tone: null, text: 'running…' });
        const outcome = await services.kg.runView(view.name, supplied());
        setBusy(false);
        if (!(0, outcome_ts_1.isOk)(outcome))
            return setStatus({ tone: 'error', text: (0, chrome_tsx_1.failureMessage)(outcome, 'running a view') });
        const result = outcome.value;
        const got = (result.rows ?? []);
        // `rowCount` is documented as required and is not always sent. The rows are the truth.
        const rowCount = result.rowCount ?? got.length;
        if (result.error)
            return setStatus({ tone: 'error', text: result.error });
        const parts = [`${rowCount} row(s)`];
        if (result.durationMs != null)
            parts.push((0, format_ts_1.formatDuration)(result.durationMs));
        for (const warning of result.warnings ?? [])
            parts.push(warning);
        if (!rowCount && result.hint)
            parts.push(result.hint);
        setStatus({ tone: (result.warnings ?? []).length ? 'caution' : 'ok', text: parts.join(' · ') });
        setRows(got);
        setRan(true);
    }
    /** Expand with these arguments and hand the runnable cypher to the editor next door. */
    async function openInStudio() {
        if (!view)
            return;
        setStatus({ tone: null, text: 'expanding…' });
        const outcome = await services.kg.viewInvocation(view.name, supplied());
        if (!(0, outcome_ts_1.isOk)(outcome))
            return setStatus({ tone: 'error', text: (0, chrome_tsx_1.failureMessage)(outcome, 'view invocation') });
        if (!outcome.value.cypher)
            return setStatus({ tone: 'error', text: 'no cypher came back' });
        host.onOpenInStudio(outcome.value.cypher);
    }
    async function remove(name) {
        if (!confirm(`Delete the view '${name}'?`))
            return;
        const outcome = await services.kg.deleteView(name);
        if (!(0, outcome_ts_1.isOk)(outcome))
            return setStatus({ tone: 'error', text: (0, chrome_tsx_1.failureMessage)(outcome, 'deleting views') });
        setSelected(null);
        void load();
    }
    async function refresh(name) {
        setStatus({ tone: null, text: 'recomputing the cache…' });
        const outcome = await services.kg.refreshView(name);
        if (!(0, outcome_ts_1.isOk)(outcome))
            return setStatus({ tone: 'error', text: (0, chrome_tsx_1.failureMessage)(outcome, 'refreshing a view') });
        setStatus({ tone: 'ok', text: `'${name}' recomputed` });
        void load();
    }
    return ((0, jsx_runtime_1.jsxs)("div", { className: "kit-feature kit-feature-views viewspage", children: [(0, jsx_runtime_1.jsx)("div", { className: "viewspage-list", children: (0, jsx_runtime_1.jsx)(chrome_tsx_1.StudioPanel, { title: "Views", children: error ? (0, jsx_runtime_1.jsx)(chrome_tsx_1.Status, { tone: "error", children: error }) : views == null ? (0, jsx_runtime_1.jsx)("p", { className: "hint", children: "loading\u2026" }) : ((0, jsx_runtime_1.jsxs)(jsx_runtime_1.Fragment, { children: [list.length === 0 && ((0, jsx_runtime_1.jsx)("p", { className: "hint", children: "No saved views yet. Write a query in Query Studio and save it \u2014 that is where views come from." })), groupNames.map((g) => ((0, jsx_runtime_1.jsxs)("div", { className: "viewgroup", children: [(0, jsx_runtime_1.jsxs)("button", { className: "viewgroup-head", "data-viewgroup": g, "aria-expanded": !!expanded[g], onClick: () => setExpanded((e) => ({ ...e, [g]: !e[g] })), children: [(0, jsx_runtime_1.jsx)("span", { className: "chev", children: expanded[g] ? '▾' : '▸' }), (0, jsx_runtime_1.jsx)("strong", { children: g }), (0, jsx_runtime_1.jsx)("span", { className: "viewcount", children: groups[g].length })] }), expanded[g] && groups[g].map((v) => ((0, jsx_runtime_1.jsxs)("button", { className: `viewrow ${v.name === selected ? 'active' : ''}`, onClick: () => pick(v), children: [(0, jsx_runtime_1.jsx)("strong", { children: v.name }), v.materialized && (0, jsx_runtime_1.jsx)("span", { className: "viewtag", children: "materialized" }), (0, jsx_runtime_1.jsx)("small", { children: v.description })] }, v.name)))] }, g)))] })) }) }), (0, jsx_runtime_1.jsx)("div", { className: "viewspage-run", children: !view ? ((0, jsx_runtime_1.jsx)(chrome_tsx_1.StudioPanel, { title: "Run a view", children: (0, jsx_runtime_1.jsx)("p", { className: "hint", children: "Pick a view \u2014 its parameters and its cypher appear here." }) })) : ((0, jsx_runtime_1.jsxs)(jsx_runtime_1.Fragment, { children: [(0, jsx_runtime_1.jsxs)(chrome_tsx_1.StudioPanel, { title: view.name, aside: (0, jsx_runtime_1.jsxs)("span", { className: "row", children: [view.materialized && ((0, jsx_runtime_1.jsx)("button", { className: "btn ghost tiny", onClick: () => void refresh(view.name), children: "Refresh cache" })), (0, jsx_runtime_1.jsx)("button", { className: "btn ghost tiny", onClick: () => void remove(view.name), children: "Delete" })] }), children: [view.description && (0, jsx_runtime_1.jsx)("p", { className: "hint", children: view.description }), Object.keys(params).length === 0 ? ((0, jsx_runtime_1.jsx)("p", { className: "hint", children: "No parameters \u2014 runs as saved." })) : ((0, jsx_runtime_1.jsx)("div", { className: "paramform", children: Object.entries(params).map(([key, spec]) => ((0, jsx_runtime_1.jsxs)("label", { className: "paramrow", children: [(0, jsx_runtime_1.jsxs)("span", { className: "paramname", children: [key, " ", (0, jsx_runtime_1.jsx)("em", { children: spec?.type })] }), (0, jsx_runtime_1.jsx)("input", { value: args[key] ?? '', placeholder: spec?.default != null ? `default: ${spec.default}` : 'no default', onChange: (e) => setArgs((a) => ({ ...a, [key]: e.target.value })) }), spec?.description && (0, jsx_runtime_1.jsx)("small", { children: spec.description })] }, key))) })), (0, jsx_runtime_1.jsxs)("div", { className: "row", children: [(0, jsx_runtime_1.jsx)("button", { className: "btn primary", disabled: busy, onClick: () => void run(), children: busy ? 'running…' : 'Run' }), (0, jsx_runtime_1.jsx)("button", { className: "btn", onClick: () => void openInStudio(), children: "Open in Query Studio" })] }), view.cypher && (
                                /* OPEN by default: the cypher is the view's substance — the tab's own header
                                   promises "opened in the studio to see what they expand to", and a closed
                                   drawer hid exactly that. Collapsible still, for a long body. */
                                (0, jsx_runtime_1.jsxs)("details", { className: "cypherbox", open: true, children: [(0, jsx_runtime_1.jsxs)("summary", { children: ["Cypher", view.materialized ? ' · materialized — reads its cache' : ''] }), (0, jsx_runtime_1.jsx)("pre", { children: (0, jsx_runtime_1.jsx)("code", { children: view.cypher }) })] }))] }), (0, jsx_runtime_1.jsx)(WatchPanel, { viewName: view.name, args: args, onWriteAgent: (signalType) => {
                                // Straight to the Agents tab with the trigger already chosen. Copying a signal
                                // type by hand is where this journey used to end.
                                host.onCreateHandler({ signalType, view: view.name });
                            } }), (0, jsx_runtime_1.jsxs)(chrome_tsx_1.StudioPanel, { title: "Results", children: [(0, jsx_runtime_1.jsx)("span", { "data-state": "view.ran", hidden: !ran }), !ran ? (0, jsx_runtime_1.jsx)("p", { className: "hint", children: "Nothing run yet." }) :
                                    rows.length === 0 ? (0, jsx_runtime_1.jsx)("p", { className: "hint", children: "No rows." }) :
                                        (0, jsx_runtime_1.jsx)(chrome_tsx_1.RowTable, { rows: rows, columns: (0, rows_ts_1.rowColumns)(rows) }), (0, jsx_runtime_1.jsxs)("div", { className: "row results-foot", children: [ran && rows.length > 0 && ((0, jsx_runtime_1.jsxs)(jsx_runtime_1.Fragment, { children: [(0, jsx_runtime_1.jsx)(chrome_tsx_1.CopyButton, { label: "Copy as Markdown", text: (0, rows_ts_1.rowsToMarkdown)(rows) }), (0, jsx_runtime_1.jsx)(chrome_tsx_1.CopyButton, { label: "Copy as CSV", text: (0, rows_ts_1.rowsToCsv)(rows) })] })), (0, jsx_runtime_1.jsx)(chrome_tsx_1.Status, { tone: status.tone, children: status.text })] })] })] })) })] }));
}
/*
 * WATCHING A VIEW — the shortest path from a saved question to an agent.
 *
 * The appliance's watch subsystem does the work: it re-materializes the subject on a cron, diffs
 * the result with a declarative `DiffSpec`, and keeps every run, snapshot and diff. This panel adds
 * no logic to that; it creates a Watch whose subject is this view and whose delivery channel is
 * `signal`.
 *
 * THE CHANNEL IS THE WHOLE DESIGN. `signal` publishes `view.<name>.changed` onto the bus, where any
 * number of agents can match it. The alternative channel — notifying one person — would weld a
 * single reaction into the noticing, and the second thing that wanted to care would have to edit
 * the first thing's body. So this panel shows the signal type and offers to write an agent, rather
 * than offering a "notify me" checkbox.
 *
 * The presets are the schedules people actually mean. 6-field cron, hour in the HOUR field —
 * `0 0 7 * * *` is 7am daily; `0 7 * * * *` is seven minutes past every hour, which is the mistake
 * everybody makes once.
 */
const SCHEDULES = [
    ['0 0 7 * * *', 'every morning at 7'],
    ['0 0 * * * *', 'hourly, on the hour'],
    ['0 */15 * * * *', 'every 15 minutes'],
    ['0 0 9 * * MON', 'Monday mornings at 9'],
];
/** As `/watches` reports one. Only the fields this panel reads. */
function WatchPanel({ viewName, args, onWriteAgent }) {
    const { services } = useViewsRuntime();
    const [watch, setWatch] = (0, react_1.useState)(null);
    const [absent, setAbsent] = (0, react_1.useState)(false);
    const [schedule, setSchedule] = (0, react_1.useState)(SCHEDULES[0][0]);
    const [busy, setBusy] = (0, react_1.useState)(false);
    const [status, setStatus] = (0, react_1.useState)({ tone: null, text: '' });
    const signalType = `view.${viewName}.changed`;
    const load = (0, react_1.useCallback)(async () => {
        const r = await services.watches.list();
        // 404 = an appliance older than the watch surface. Say nothing rather than nag.
        if (!r.ok && r.status === 404)
            return setAbsent(true);
        if (!r.ok)
            return;
        setWatch(r.value.find((w) => w.lensId === viewName) ?? null);
    }, [viewName, services]);
    (0, react_1.useEffect)(() => { void load(); }, [load]);
    async function start() {
        setBusy(true);
        const r = await services.watches.create({
            lensId: viewName,
            name: viewName,
            params: args,
            cron: schedule,
            delivery: { channel: 'signal' },
        });
        setBusy(false);
        if (!r.ok) {
            return setStatus({ tone: 'error', text: r.message });
        }
        setStatus({ tone: 'ok', text: 'Watching. The first run takes a baseline; changes after that publish a signal.' });
        void load();
    }
    async function stop() {
        if (!watch)
            return;
        setBusy(true);
        await services.watches.delete(watch.id);
        setBusy(false);
        setWatch(null);
        setStatus({ tone: null, text: 'Stopped. Nothing is publishing for this view.' });
    }
    async function runNow() {
        if (!watch)
            return;
        setBusy(true);
        const r = await services.watches.run(watch.id);
        setBusy(false);
        setStatus(r.ok
            ? { tone: 'ok', text: 'Ran. Any change is on the watch’s diffs, and has published a signal.' }
            : { tone: 'error', text: r.message });
    }
    if (absent)
        return null;
    return ((0, jsx_runtime_1.jsxs)(chrome_tsx_1.StudioPanel, { title: "Watch", aside: watch ? (0, jsx_runtime_1.jsx)("span", { className: "stage watching", children: "watching" }) : undefined, children: [!watch ? ((0, jsx_runtime_1.jsxs)(jsx_runtime_1.Fragment, { children: [(0, jsx_runtime_1.jsxs)("p", { className: "hint", children: ["Run this view on a schedule, diff the answer, and publish ", (0, jsx_runtime_1.jsx)("code", { children: signalType }), " when it moves. It notifies nobody by itself \u2014 the signal is what an agent reacts to."] }), (0, jsx_runtime_1.jsxs)("div", { className: "row skillsource", children: [(0, jsx_runtime_1.jsx)("select", { value: schedule, onChange: (e) => setSchedule(e.target.value), children: SCHEDULES.map(([cron, says]) => (0, jsx_runtime_1.jsx)("option", { value: cron, children: says }, cron)) }), (0, jsx_runtime_1.jsx)("input", { value: schedule, onChange: (e) => setSchedule(e.target.value), "aria-label": "cron expression" }), (0, jsx_runtime_1.jsx)("button", { className: "btn", disabled: busy, onClick: () => void start(), children: "Watch this" })] }), (0, jsx_runtime_1.jsx)("p", { className: "hint", children: "Any arguments above are frozen into the watch \u2014 the same question, asked on a timer." })] })) : ((0, jsx_runtime_1.jsxs)(jsx_runtime_1.Fragment, { children: [(0, jsx_runtime_1.jsxs)("div", { className: "statline", children: [(0, jsx_runtime_1.jsx)("span", { children: "Publishes" }), (0, jsx_runtime_1.jsx)("strong", { children: (0, jsx_runtime_1.jsx)("code", { children: signalType }) })] }), (0, jsx_runtime_1.jsxs)("div", { className: "statline", children: [(0, jsx_runtime_1.jsx)("span", { children: "Schedule" }), (0, jsx_runtime_1.jsx)("strong", { children: watch.cron ?? 'not scheduled' })] }), (0, jsx_runtime_1.jsxs)("div", { className: "statline", children: [(0, jsx_runtime_1.jsx)("span", { children: "Delivery" }), (0, jsx_runtime_1.jsx)("strong", { children: watch.delivery?.channel ?? 'none — it records diffs but publishes nothing' })] }), (0, jsx_runtime_1.jsxs)("div", { className: "row studio-actions", children: [(0, jsx_runtime_1.jsx)("button", { className: "btn", disabled: busy, onClick: () => void runNow(), children: "Run it now" }), (0, jsx_runtime_1.jsx)("button", { className: "btn", onClick: () => onWriteAgent(signalType), children: "Write an agent for it" }), (0, jsx_runtime_1.jsx)("button", { className: "btn ghost", disabled: busy, onClick: () => void stop(), children: "Stop watching" })] }), (0, jsx_runtime_1.jsxs)("p", { className: "hint", children: ["Nothing reacts to this yet unless an agent matches ", (0, jsx_runtime_1.jsx)("code", { children: signalType }), ". The watch makes the change a fact; an agent decides what it is worth."] }), (0, jsx_runtime_1.jsx)("div", { className: "subhead", children: "Runs" }), (0, jsx_runtime_1.jsx)(WatchReceipts, { watchId: watch.id })] })), (0, jsx_runtime_1.jsx)(chrome_tsx_1.Status, { tone: status.tone, children: status.text })] }));
}
/*
 * RECEIPTS — what the watch actually did.
 *
 * A watch that runs and shows you nothing is indistinguishable from a watch that does not run, and
 * that is the worst possible first impression for the one feature here nobody else has. The
 * appliance already keeps every run, snapshot, diff and delivery; none of it had a surface.
 *
 * Three facts are joined, because separately none of them is a receipt:
 *
 *   RUNS       — it woke up, and whether it completed        (/watches/{id}/runs)
 *   DIFFS      — what actually changed, if anything          (/watches/{id}/changes)
 *   DELIVERIES — that the change was PUBLISHED as a signal   (/watches/{id}/deliveries)
 *
 * The last one is the point. "The answer moved" is interesting; "the answer moved and every agent
 * bound to it was woken" is the claim this product makes, and a delivery row is the evidence.
 */
/** `2026-08-27T22:53:44Z` → `27 Aug 22:53`. Local, short, and never the seconds — a receipt is
 *  read for "when roughly", and the id is there when somebody needs to be exact. */
function whenShort(iso) {
    if (!iso)
        return '—';
    const d = new Date(iso);
    return Number.isNaN(d.getTime())
        ? String(iso).slice(0, 16).replace('T', ' ')
        : d.toLocaleString(undefined, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}
function WatchReceipts({ watchId }) {
    const { services } = useViewsRuntime();
    const [runs, setRuns] = (0, react_1.useState)(null);
    const [diffs, setDiffs] = (0, react_1.useState)([]);
    const [deliveries, setDeliveries] = (0, react_1.useState)([]);
    const [problem, setProblem] = (0, react_1.useState)('');
    const load = (0, react_1.useCallback)(async () => {
        const [r, c, d] = await Promise.all([
            services.watches.runs(watchId),
            services.watches.changes(watchId),
            services.watches.deliveries(watchId),
        ]);
        if (!r.ok)
            return setProblem(`The appliance would not list this watch's runs (HTTP ${r.status}).`);
        setProblem('');
        // Newest first: a receipt is read from the top, and the run somebody just triggered is the
        // one they are looking for.
        setRuns([...r.value].reverse());
        setDiffs(c.ok ? c.value : []);
        setDeliveries(d.ok ? d.value : []);
    }, [watchId, services]);
    (0, react_1.useEffect)(() => { void load(); }, [load]);
    if (problem)
        return (0, jsx_runtime_1.jsx)(chrome_tsx_1.Status, { tone: "error", children: problem });
    if (runs === null)
        return (0, jsx_runtime_1.jsx)("p", { className: "hint", children: "Reading this watch's history\u2026" });
    if (runs.length === 0) {
        return (0, jsx_runtime_1.jsxs)("p", { className: "hint", children: ["It has not run yet. ", (0, jsx_runtime_1.jsx)("em", { children: "Run it now" }), " takes the first reading."] });
    }
    const diffFor = (run) => diffs.find((d) => d.id === run.diffId || d.targetRunId === run.id);
    return ((0, jsx_runtime_1.jsxs)("div", { className: "receipts", children: [runs.slice(0, 8).map((run) => {
                const diff = diffFor(run);
                const changes = diff?.changes ?? [];
                const delivered = deliveries.filter((d) => d.diffId === diff?.id);
                const counts = ['ADDED', 'REMOVED', 'UPDATED']
                    .map((k) => [k, changes.filter((c) => c.kind === k).length])
                    .filter(([, n]) => n > 0)
                    .map(([k, n]) => `${n} ${k.toLowerCase()}`);
                return ((0, jsx_runtime_1.jsxs)("div", { className: "receipt", children: [(0, jsx_runtime_1.jsxs)("div", { className: "receipt-head", children: [(0, jsx_runtime_1.jsx)("span", { className: `stage ${run.errorCode ? 'acting' : changes.length ? 'watching' : 'proposed'}`, children: run.errorCode ? 'failed' : changes.length ? 'changed' : 'no change' }), (0, jsx_runtime_1.jsx)("strong", { children: whenShort(run.startedAt) }), (0, jsx_runtime_1.jsx)("small", { children: (run.status ?? '').toLowerCase() })] }), run.errorCode && (0, jsx_runtime_1.jsx)("p", { className: "receipt-line", children: run.errorCode }), changes.length > 0 && ((0, jsx_runtime_1.jsxs)("p", { className: "receipt-line", children: [counts.join(' · '), changes.slice(0, 3).map((c) => c.key).filter(Boolean).length > 0 &&
                                    ` — ${changes.slice(0, 3).map((c) => c.key).filter(Boolean).join(', ')}`, changes.length > 3 ? ` and ${changes.length - 3} more` : ''] })), delivered.length > 0 && ((0, jsx_runtime_1.jsx)("p", { className: "receipt-line receipt-delivery", children: delivered.map((d) => `published to ${d.channel ?? 'a channel'} · ${(d.status ?? '').toLowerCase()}`).join(' · ') })), changes.length > 0 && delivered.length === 0 && ((0, jsx_runtime_1.jsxs)("p", { className: "receipt-line hint", children: ["Nothing was published \u2014 this watch has no ", (0, jsx_runtime_1.jsx)("code", { children: "signal" }), " delivery, so no agent was woken."] }))] }, run.id));
            }), (0, jsx_runtime_1.jsxs)("div", { className: "row", children: [(0, jsx_runtime_1.jsx)("button", { className: "btn ghost tiny", onClick: () => void load(), children: "Refresh" }), runs.length > 8 && (0, jsx_runtime_1.jsxs)("span", { className: "hint", children: ["showing the last 8 of ", runs.length] })] })] }));
}
//# sourceMappingURL=SavedViewsSurface.js.map