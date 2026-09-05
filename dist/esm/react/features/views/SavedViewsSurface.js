import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
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
import { createContext, useCallback, useContext, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { isOk } from "../../../client/outcome.js";
import { rowColumns, rowsToCsv, rowsToMarkdown } from "../../../vc/rows.js";
import { formatDuration } from "../../../studio-kit/format.js";
import { CopyButton, RowTable, Status, StudioPanel, failureMessage } from "../studio/chrome.js";
const ViewsRuntimeContext = createContext(null);
function useViewsRuntime() {
    const runtime = useContext(ViewsRuntimeContext);
    if (!runtime)
        throw new Error('SavedViewsSurface runtime is missing');
    return runtime;
}
export function SavedViewsSurface({ services, host }) {
    return _jsx(ViewsRuntimeContext.Provider, { value: { services, host }, children: _jsx(SavedViewsBody, {}) });
}
function SavedViewsBody() {
    const { services, host } = useViewsRuntime();
    const [views, setViews] = useState(null);
    const [error, setError] = useState('');
    const [selected, setSelected] = useState(null);
    const [args, setArgs] = useState({});
    const [expanded, setExpanded] = useState({});
    const [status, setStatus] = useState({ tone: null, text: '' });
    const [rows, setRows] = useState([]);
    const [ran, setRan] = useState(false);
    const [busy, setBusy] = useState(false);
    const load = useCallback(async () => {
        const outcome = await services.kg.views();
        if (!isOk(outcome))
            return setError(failureMessage(outcome, 'saved views'));
        setError('');
        setViews(outcome.value);
    }, [services]);
    useEffect(() => { void load(); }, [load]);
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
    const hashRest = useSyncExternalStore(host.subscribeSelection, host.selectedView, host.selectedView);
    const drivenBy = useRef('');
    /** A driven run, waiting for React to apply the selection it depends on. */
    const pendingRun = useRef(false);
    useEffect(() => {
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
    useEffect(() => {
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
        if (!isOk(outcome))
            return setStatus({ tone: 'error', text: failureMessage(outcome, 'running a view') });
        const result = outcome.value;
        const got = (result.rows ?? []);
        // `rowCount` is documented as required and is not always sent. The rows are the truth.
        const rowCount = result.rowCount ?? got.length;
        if (result.error)
            return setStatus({ tone: 'error', text: result.error });
        const parts = [`${rowCount} row(s)`];
        if (result.durationMs != null)
            parts.push(formatDuration(result.durationMs));
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
        if (!isOk(outcome))
            return setStatus({ tone: 'error', text: failureMessage(outcome, 'view invocation') });
        if (!outcome.value.cypher)
            return setStatus({ tone: 'error', text: 'no cypher came back' });
        host.onOpenInStudio(outcome.value.cypher);
    }
    async function remove(name) {
        if (!confirm(`Delete the view '${name}'?`))
            return;
        const outcome = await services.kg.deleteView(name);
        if (!isOk(outcome))
            return setStatus({ tone: 'error', text: failureMessage(outcome, 'deleting views') });
        setSelected(null);
        void load();
    }
    async function refresh(name) {
        setStatus({ tone: null, text: 'recomputing the cache…' });
        const outcome = await services.kg.refreshView(name);
        if (!isOk(outcome))
            return setStatus({ tone: 'error', text: failureMessage(outcome, 'refreshing a view') });
        setStatus({ tone: 'ok', text: `'${name}' recomputed` });
        void load();
    }
    return (_jsxs("div", { className: "kit-feature kit-feature-views viewspage", children: [_jsx("div", { className: "viewspage-list", children: _jsx(StudioPanel, { title: "Views", children: error ? _jsx(Status, { tone: "error", children: error }) : views == null ? _jsx("p", { className: "hint", children: "loading\u2026" }) : (_jsxs(_Fragment, { children: [list.length === 0 && (_jsx("p", { className: "hint", children: "No saved views yet. Write a query in Query Studio and save it \u2014 that is where views come from." })), groupNames.map((g) => (_jsxs("div", { className: "viewgroup", children: [_jsxs("button", { className: "viewgroup-head", "data-viewgroup": g, "aria-expanded": !!expanded[g], onClick: () => setExpanded((e) => ({ ...e, [g]: !e[g] })), children: [_jsx("span", { className: "chev", children: expanded[g] ? '▾' : '▸' }), _jsx("strong", { children: g }), _jsx("span", { className: "viewcount", children: groups[g].length })] }), expanded[g] && groups[g].map((v) => (_jsxs("button", { className: `viewrow ${v.name === selected ? 'active' : ''}`, onClick: () => pick(v), children: [_jsx("strong", { children: v.name }), v.materialized && _jsx("span", { className: "viewtag", children: "materialized" }), _jsx("small", { children: v.description })] }, v.name)))] }, g)))] })) }) }), _jsx("div", { className: "viewspage-run", children: !view ? (_jsx(StudioPanel, { title: "Run a view", children: _jsx("p", { className: "hint", children: "Pick a view \u2014 its parameters and its cypher appear here." }) })) : (_jsxs(_Fragment, { children: [_jsxs(StudioPanel, { title: view.name, aside: _jsxs("span", { className: "row", children: [view.materialized && (_jsx("button", { className: "btn ghost tiny", onClick: () => void refresh(view.name), children: "Refresh cache" })), _jsx("button", { className: "btn ghost tiny", onClick: () => void remove(view.name), children: "Delete" })] }), children: [view.description && _jsx("p", { className: "hint", children: view.description }), Object.keys(params).length === 0 ? (_jsx("p", { className: "hint", children: "No parameters \u2014 runs as saved." })) : (_jsx("div", { className: "paramform", children: Object.entries(params).map(([key, spec]) => (_jsxs("label", { className: "paramrow", children: [_jsxs("span", { className: "paramname", children: [key, " ", _jsx("em", { children: spec?.type })] }), _jsx("input", { value: args[key] ?? '', placeholder: spec?.default != null ? `default: ${spec.default}` : 'no default', onChange: (e) => setArgs((a) => ({ ...a, [key]: e.target.value })) }), spec?.description && _jsx("small", { children: spec.description })] }, key))) })), _jsxs("div", { className: "row", children: [_jsx("button", { className: "btn primary", disabled: busy, onClick: () => void run(), children: busy ? 'running…' : 'Run' }), _jsx("button", { className: "btn", onClick: () => void openInStudio(), children: "Open in Query Studio" })] }), view.cypher && (
                                /* OPEN by default: the cypher is the view's substance — the tab's own header
                                   promises "opened in the studio to see what they expand to", and a closed
                                   drawer hid exactly that. Collapsible still, for a long body. */
                                _jsxs("details", { className: "cypherbox", open: true, children: [_jsxs("summary", { children: ["Cypher", view.materialized ? ' · materialized — reads its cache' : ''] }), _jsx("pre", { children: _jsx("code", { children: view.cypher }) })] }))] }), _jsx(WatchPanel, { viewName: view.name, args: args, onWriteAgent: (signalType) => {
                                // Straight to the Agents tab with the trigger already chosen. Copying a signal
                                // type by hand is where this journey used to end.
                                host.onCreateHandler({ signalType, view: view.name });
                            } }), _jsxs(StudioPanel, { title: "Results", children: [_jsx("span", { "data-state": "view.ran", hidden: !ran }), !ran ? _jsx("p", { className: "hint", children: "Nothing run yet." }) :
                                    rows.length === 0 ? _jsx("p", { className: "hint", children: "No rows." }) :
                                        _jsx(RowTable, { rows: rows, columns: rowColumns(rows) }), _jsxs("div", { className: "row results-foot", children: [ran && rows.length > 0 && (_jsxs(_Fragment, { children: [_jsx(CopyButton, { label: "Copy as Markdown", text: rowsToMarkdown(rows) }), _jsx(CopyButton, { label: "Copy as CSV", text: rowsToCsv(rows) })] })), _jsx(Status, { tone: status.tone, children: status.text })] })] })] })) })] }));
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
    const [watch, setWatch] = useState(null);
    const [absent, setAbsent] = useState(false);
    const [schedule, setSchedule] = useState(SCHEDULES[0][0]);
    const [busy, setBusy] = useState(false);
    const [status, setStatus] = useState({ tone: null, text: '' });
    const signalType = `view.${viewName}.changed`;
    const load = useCallback(async () => {
        const r = await services.watches.list();
        // 404 = an appliance older than the watch surface. Say nothing rather than nag.
        if (!r.ok && r.status === 404)
            return setAbsent(true);
        if (!r.ok)
            return;
        setWatch(r.value.find((w) => w.lensId === viewName) ?? null);
    }, [viewName, services]);
    useEffect(() => { void load(); }, [load]);
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
    return (_jsxs(StudioPanel, { title: "Watch", aside: watch ? _jsx("span", { className: "stage watching", children: "watching" }) : undefined, children: [!watch ? (_jsxs(_Fragment, { children: [_jsxs("p", { className: "hint", children: ["Run this view on a schedule, diff the answer, and publish ", _jsx("code", { children: signalType }), " when it changes. The watch publishes a signal; it does not notify anyone by itself."] }), _jsxs("div", { className: "row skillsource", children: [_jsx("select", { value: schedule, onChange: (e) => setSchedule(e.target.value), children: SCHEDULES.map(([cron, says]) => _jsx("option", { value: cron, children: says }, cron)) }), _jsx("input", { value: schedule, onChange: (e) => setSchedule(e.target.value), "aria-label": "cron expression" }), _jsx("button", { className: "btn", disabled: busy, onClick: () => void start(), children: "Watch this" })] }), _jsx("p", { className: "hint", children: "Any arguments above are frozen into the watch \u2014 the same question, asked on a timer." })] })) : (_jsxs(_Fragment, { children: [_jsxs("div", { className: "statline", children: [_jsx("span", { children: "Publishes" }), _jsx("strong", { children: _jsx("code", { children: signalType }) })] }), _jsxs("div", { className: "statline", children: [_jsx("span", { children: "Schedule" }), _jsx("strong", { children: watch.cron ?? 'not scheduled' })] }), _jsxs("div", { className: "statline", children: [_jsx("span", { children: "Delivery" }), _jsx("strong", { children: watch.delivery?.channel ?? 'none — it records diffs but publishes nothing' })] }), _jsxs("div", { className: "row studio-actions", children: [_jsx("button", { className: "btn", disabled: busy, onClick: () => void runNow(), children: "Run it now" }), _jsx("button", { className: "btn", onClick: () => onWriteAgent(signalType), children: "Write an agent for it" }), _jsx("button", { className: "btn ghost", disabled: busy, onClick: () => void stop(), children: "Stop watching" })] }), _jsxs("p", { className: "hint", children: ["This watch reruns on schedule and publishes ", _jsx("code", { children: signalType }), " when rows change. Add a handler only if you want an automated response."] }), _jsx("div", { className: "subhead", children: "Runs" }), _jsx(WatchReceipts, { watchId: watch.id })] })), _jsx(Status, { tone: status.tone, children: status.text })] }));
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
    const [runs, setRuns] = useState(null);
    const [diffs, setDiffs] = useState([]);
    const [deliveries, setDeliveries] = useState([]);
    const [problem, setProblem] = useState('');
    const load = useCallback(async () => {
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
    useEffect(() => { void load(); }, [load]);
    if (problem)
        return _jsx(Status, { tone: "error", children: problem });
    if (runs === null)
        return _jsx("p", { className: "hint", children: "Reading this watch's history\u2026" });
    if (runs.length === 0) {
        return _jsxs("p", { className: "hint", children: ["It has not run yet. ", _jsx("em", { children: "Run it now" }), " takes the first reading."] });
    }
    const diffFor = (run) => diffs.find((d) => d.id === run.diffId || d.targetRunId === run.id);
    return (_jsxs("div", { className: "receipts", children: [runs.slice(0, 8).map((run) => {
                const diff = diffFor(run);
                const changes = diff?.changes ?? [];
                const delivered = deliveries.filter((d) => d.diffId === diff?.id);
                const counts = ['ADDED', 'REMOVED', 'UPDATED']
                    .map((k) => [k, changes.filter((c) => c.kind === k).length])
                    .filter(([, n]) => n > 0)
                    .map(([k, n]) => `${n} ${k.toLowerCase()}`);
                return (_jsxs("div", { className: "receipt", children: [_jsxs("div", { className: "receipt-head", children: [_jsx("span", { className: `stage ${run.errorCode ? 'acting' : changes.length ? 'watching' : 'proposed'}`, children: run.errorCode ? 'failed' : changes.length ? 'changed' : 'no change' }), _jsx("strong", { children: whenShort(run.startedAt) }), _jsx("small", { children: (run.status ?? '').toLowerCase() })] }), run.errorCode && _jsx("p", { className: "receipt-line", children: run.errorCode }), changes.length > 0 && (_jsxs("p", { className: "receipt-line", children: [counts.join(' · '), changes.slice(0, 3).map((c) => c.key).filter(Boolean).length > 0 &&
                                    ` — ${changes.slice(0, 3).map((c) => c.key).filter(Boolean).join(', ')}`, changes.length > 3 ? ` and ${changes.length - 3} more` : ''] })), delivered.length > 0 && (_jsx("p", { className: "receipt-line receipt-delivery", children: delivered.map((d) => `published to ${d.channel ?? 'a channel'} · ${(d.status ?? '').toLowerCase()}`).join(' · ') })), changes.length > 0 && delivered.length === 0 && (_jsx("p", { className: "receipt-line hint", children: "No change signal was published for this run." }))] }, run.id));
            }), _jsxs("div", { className: "row", children: [_jsx("button", { className: "btn ghost tiny", onClick: () => void load(), children: "Refresh" }), runs.length > 8 && _jsxs("span", { className: "hint", children: ["showing the last 8 of ", runs.length] })] })] }));
}
//# sourceMappingURL=SavedViewsSurface.js.map