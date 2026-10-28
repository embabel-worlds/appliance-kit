"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LensRunner = LensRunner;
const jsx_runtime_1 = require("react/jsx-runtime");
/*
 * LENSES — the world's judgments composed in code, run beside its views.
 *
 * A view is one query; a lens is a program over several (a briefing, a triage) that the appliance
 * runs by id with declared params. Until this, a lens could be run only from REST or an app; the
 * console listed views and nothing else. This is the Views window's second mode, laid out the same
 * way: every lens in a list on the left under one filter, the chosen one on the right with its
 * params, Run, and what the run answered.
 *
 * WHAT IS SHOWN IS THE ENVELOPE. `POST /lenses/{id}/invoke` answers the same redacted envelope MCP's
 * `lens_open` and an app's `embabel.lenses.invoke` get, and this panel draws it as it came: the
 * outcome in words (EMPTY is a real empty; SOURCE_UNAVAILABLE is not), the warnings, the error's own
 * safe message, and the data — a table when it is rows, the JSON when it is a typed payload.
 *
 * WAITING. The host may answer a RUNNING envelope instead of holding the request open; the panel
 * then polls the run by its handle, says how long there has been no result, and can cancel it.
 * Leaving a lens mid-run cancels the run without asking, as leaving a view does.
 */
const react_1 = require("react");
const outcome_ts_1 = require("../../../client/outcome.js");
const rows_ts_1 = require("../../../vc/rows.js");
const format_ts_1 = require("../../../studio-kit/format.js");
const chrome_tsx_1 = require("../studio/chrome.js");
const runWait_tsx_1 = require("./runWait.js");
/** How often a RUNNING lens is asked whether it has finished. */
const POLL_MS = 1500;
const NO_ROUTE = () => null;
/** A blank field means "use the declared default"; a typed one is sent as its declared type. */
function argsFor(params, values) {
    const out = {};
    for (const [name, raw] of Object.entries(values)) {
        if (raw === '' || raw == null)
            continue;
        const type = params.find((param) => param.name === name)?.type?.toUpperCase();
        const number = Number(raw);
        out[name] = type === 'INT' && raw.trim() !== '' && Number.isFinite(number) ? number
            : type === 'BOOLEAN' ? raw === 'true'
                : raw;
    }
    return out;
}
function defaultArgs(lens) {
    return Object.fromEntries((lens.params ?? []).map((param) => [param.name, param.default == null ? '' : String(param.default)]));
}
/** The envelope's status line: what happened, in the outcome's own terms, with what it cost. */
function verdictOf(envelope) {
    const parts = [];
    const cost = envelope.metrics;
    if (cost?.durationMs != null)
        parts.push((0, format_ts_1.formatDuration)(cost.durationMs));
    if (cost?.externalCalls)
        parts.push(`${cost.externalCalls} external call(s)`);
    for (const warning of envelope.warnings ?? [])
        parts.push(warning.message);
    const tail = parts.length ? ` · ${parts.join(' · ')}` : '';
    if (envelope.status === 'CANCELLED')
        return { tone: 'caution', text: `Cancelled. ${envelope.error?.message ?? ''}`.trim() };
    if (envelope.status === 'FAILED' || envelope.error) {
        return { tone: 'error', text: `${envelope.outcome} — ${envelope.error?.message ?? 'The lens could not be run.'}${tail}` };
    }
    if (envelope.outcome === 'EMPTY')
        return { tone: null, text: `EMPTY — the lens ran and found nothing${tail}` };
    return { tone: (envelope.warnings ?? []).length || envelope.outcome !== 'OK' ? 'caution' : 'ok', text: `${envelope.outcome}${tail}` };
}
/** Rows when the payload is a list of records, which is what a table can show honestly. */
function rowsOf(data) {
    if (!Array.isArray(data) || data.length === 0)
        return null;
    return data.every((item) => item !== null && typeof item === 'object' && !Array.isArray(item))
        ? data
        : null;
}
function LensRunner({ services, host, modeSwitch }) {
    const [lenses, setLenses] = (0, react_1.useState)(null);
    const [error, setError] = (0, react_1.useState)('');
    const [selected, setSelected] = (0, react_1.useState)(null);
    const [args, setArgs] = (0, react_1.useState)({});
    const [filter, setFilter] = (0, react_1.useState)('');
    const [busy, setBusy] = (0, react_1.useState)(false);
    const [startedAt, setStartedAt] = (0, react_1.useState)(null);
    const [cancelling, setCancelling] = (0, react_1.useState)(false);
    /** A run handle is held, so there is a run Cancel can name. */
    const [cancellable, setCancellable] = (0, react_1.useState)(false);
    const [envelope, setEnvelope] = (0, react_1.useState)(null);
    const [status, setStatus] = (0, react_1.useState)({ tone: null, text: '' });
    /* Refs, because a run awaits across renders: which run owns the screen, and its handle. */
    const generation = (0, react_1.useRef)(0);
    const runHandle = (0, react_1.useRef)(null);
    const load = (0, react_1.useCallback)(async () => {
        const outcome = await services.list();
        if (!(0, outcome_ts_1.isOk)(outcome))
            return setError((0, chrome_tsx_1.failureMessage)(outcome, 'list lenses'));
        setError('');
        setLenses([...outcome.value].sort((a, b) => a.name.localeCompare(b.name)));
    }, [services]);
    (0, react_1.useEffect)(() => { void load(); }, [load]);
    const route = (0, react_1.useSyncExternalStore)(host.subscribeSelection, host.selectedLens ?? NO_ROUTE, host.selectedLens ?? NO_ROUTE);
    const drivenBy = (0, react_1.useRef)('');
    /*
     * LEAVING A LENS MID-RUN cancels it, without asking: the answer would arrive for a lens nobody is
     * looking at. Its answer is disowned first, so a late reply cannot land on another lens.
     */
    function abandonRun() {
        generation.current += 1;
        const handle = runHandle.current;
        runHandle.current = null;
        setBusy(false);
        setStartedAt(null);
        setCancelling(false);
        setCancellable(false);
        if (handle && services.kill)
            void services.kill(handle);
    }
    const abandonOnUnmount = (0, react_1.useRef)(abandonRun);
    abandonOnUnmount.current = abandonRun;
    (0, react_1.useEffect)(() => () => abandonOnUnmount.current(), []);
    function apply(lens) {
        abandonRun();
        setSelected(lens.id);
        setArgs(defaultArgs(lens));
        setEnvelope(null);
        setStatus({ tone: null, text: '' });
    }
    /* DRIVABLE FROM THE URL, as views are: `<id>` selects a lens, `<id>/run` selects and runs it, and
       a query string fills its params — `#lenses/briefing/run?since=2026-10-01` in the console. */
    (0, react_1.useEffect)(() => {
        if (!lenses || route === drivenBy.current)
            return;
        drivenBy.current = route;
        if (route === null)
            return;
        if (!route) {
            abandonRun();
            setSelected(null);
            return;
        }
        const [path = '', query = ''] = route.split('?');
        const [id, destination = ''] = path.split('/');
        const wanted = lenses.find((candidate) => candidate.id === id);
        if (!wanted)
            return;
        if (selected !== wanted.id)
            apply(wanted);
        const supplied = Object.fromEntries(new URLSearchParams(query));
        const nextArgs = { ...(selected === wanted.id ? args : defaultArgs(wanted)), ...supplied };
        if (Object.keys(supplied).length)
            setArgs(nextArgs);
        if (destination === 'run')
            void run(wanted, nextArgs);
    }, [lenses, route]);
    function navigate(id, destination) {
        if (!host.navigateToLens)
            return;
        drivenBy.current = id ? (destination === 'open' ? id : `${id}/${destination}`) : '';
        host.navigateToLens(id, destination);
    }
    function pick(lens) {
        if (lens.id === selected)
            return;
        apply(lens);
        navigate(lens.id, 'open');
    }
    async function run(lens, values) {
        abandonRun();
        const mine = ++generation.current;
        setBusy(true);
        setEnvelope(null);
        setStatus({ tone: null, text: '' });
        setStartedAt(performance.now());
        let outcome = await services.invoke(lens.id, argsFor(lens.params ?? [], values));
        // A RUNNING envelope's executionId is the run's handle: ask after it until it settles.
        while (mine === generation.current && (0, outcome_ts_1.isOk)(outcome) && outcome.value.status === 'RUNNING') {
            runHandle.current = outcome.value.executionId;
            setCancellable(true);
            await new Promise((resolve) => setTimeout(resolve, POLL_MS));
            if (mine !== generation.current)
                return;
            outcome = await services.run(outcome.value.executionId);
        }
        if (mine !== generation.current)
            return;
        runHandle.current = null;
        setBusy(false);
        setStartedAt(null);
        setCancelling(false);
        setCancellable(false);
        if (!(0, outcome_ts_1.isOk)(outcome))
            return setStatus({ tone: 'error', text: (0, chrome_tsx_1.failureMessage)(outcome, `run '${lens.name}'`) });
        setEnvelope(outcome.value);
        setStatus(verdictOf(outcome.value));
    }
    /* Cancel is a request: the run settles CANCELLED, and that settled envelope is what is shown. */
    async function cancel() {
        const handle = runHandle.current;
        if (!handle || !services.kill)
            return;
        setCancelling(true);
        const mine = generation.current;
        const outcome = await services.kill(handle);
        if (mine !== generation.current)
            return;
        generation.current += 1;
        runHandle.current = null;
        setBusy(false);
        setStartedAt(null);
        setCancelling(false);
        setCancellable(false);
        if (!(0, outcome_ts_1.isOk)(outcome))
            return setStatus({ tone: 'error', text: (0, chrome_tsx_1.failureMessage)(outcome, 'cancel this run') });
        setEnvelope(outcome.value);
        setStatus(verdictOf(outcome.value));
    }
    const list = lenses ?? [];
    const lens = list.find((candidate) => candidate.id === selected) ?? null;
    if (error || lenses == null || list.length === 0)
        return ((0, jsx_runtime_1.jsxs)("div", { className: "kit-feature kit-feature-views viewspage", children: [modeSwitch, error ? (0, jsx_runtime_1.jsx)(chrome_tsx_1.Status, { tone: "error", children: error }) : lenses == null ? (0, jsx_runtime_1.jsx)("p", { className: "hint", children: "loading\u2026" }) : ((0, jsx_runtime_1.jsx)(chrome_tsx_1.StudioPanel, { title: "Lenses", children: (0, jsx_runtime_1.jsx)("p", { className: "hint", children: "No lenses in this world yet. A lens comes with a realm or the world's own config, or is saved from chat." }) }))] }));
    const wanted = filter.trim().toLowerCase();
    const shown = list.filter((candidate) => !wanted || `${candidate.id} ${candidate.name} ${candidate.description ?? ''}`.toLowerCase().includes(wanted));
    const navigator = () => ((0, jsx_runtime_1.jsxs)(jsx_runtime_1.Fragment, { children: [modeSwitch, (0, jsx_runtime_1.jsx)("div", { className: "viewnav-filter", children: (0, jsx_runtime_1.jsx)("input", { type: "search", "aria-label": "Filter lenses", placeholder: `Filter ${list.length} lenses`, value: filter, onChange: (event) => setFilter(event.target.value) }) }), (0, jsx_runtime_1.jsxs)("div", { className: "viewnav-list", children: [shown.length === 0 && (0, jsx_runtime_1.jsxs)("p", { className: "hint viewnav-none", children: ["No lens matches \u201C", filter.trim(), "\u201D."] }), (0, jsx_runtime_1.jsxs)("nav", { className: "viewnav-section", "aria-label": "Lenses", children: [(0, jsx_runtime_1.jsxs)("span", { className: "viewnav-label", children: ["Lenses \u00B7 ", shown.length] }), shown.map((candidate) => ((0, jsx_runtime_1.jsxs)("button", { className: `viewsibling${candidate.id === lens?.id ? ' active' : ''}`, "aria-current": candidate.id === lens?.id ? 'page' : undefined, onClick: () => pick(candidate), children: [(0, jsx_runtime_1.jsx)("strong", { children: candidate.name }), (0, jsx_runtime_1.jsx)("small", { title: candidate.description || undefined, children: candidate.description || `${(candidate.params ?? []).length} parameter(s) · ${candidate.id}` })] }, candidate.id)))] })] })] }));
    const params = lens?.params ?? [];
    const rows = rowsOf(envelope?.data);
    const hasData = envelope?.data != null && !(Array.isArray(envelope.data) && envelope.data.length === 0);
    const json = hasData ? JSON.stringify(envelope?.data, null, 2) : '';
    return ((0, jsx_runtime_1.jsxs)("div", { className: "kit-feature kit-feature-views viewspage viewspage-selected", children: [(0, jsx_runtime_1.jsx)("aside", { className: "panel viewspage-sidebar", "aria-label": "Lenses", children: navigator() }), (0, jsx_runtime_1.jsxs)("details", { className: "panel viewspage-mobile-nav", children: [(0, jsx_runtime_1.jsx)("summary", { children: (0, jsx_runtime_1.jsxs)("span", { children: [(0, jsx_runtime_1.jsx)("strong", { children: "Browse lenses" }), (0, jsx_runtime_1.jsx)("small", { children: lens ? lens.name : `${list.length} lenses` })] }) }), (0, jsx_runtime_1.jsx)("div", { className: "viewspage-mobile-nav-body", children: navigator() })] }), !lens ? ((0, jsx_runtime_1.jsx)("div", { className: "viewspage-operation viewspage-none", children: (0, jsx_runtime_1.jsx)("p", { className: "hint", children: "Choose a lens to see what it takes and run it." }) })) : ((0, jsx_runtime_1.jsxs)("div", { className: "viewspage-operation", children: [(0, jsx_runtime_1.jsxs)("section", { className: "panel viewoperation-head", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsxs)("span", { className: "viewnav-label", children: ["Lens \u00B7 ", lens.id] }), (0, jsx_runtime_1.jsx)("div", { className: "viewoperation-title", children: (0, jsx_runtime_1.jsx)("h2", { children: lens.name }) }), (0, jsx_runtime_1.jsxs)("span", { className: "viewnote", children: [params.length, " parameter(s)"] })] }), lens.description && (0, jsx_runtime_1.jsx)("p", { className: "hint", children: lens.description })] }), (0, jsx_runtime_1.jsxs)("div", { className: "viewrunbar", children: [params.length === 0 ? (0, jsx_runtime_1.jsx)("span", { className: "hint", children: "No parameters." }) : params.map((param) => ((0, jsx_runtime_1.jsxs)("label", { className: "paramrow", children: [(0, jsx_runtime_1.jsxs)("span", { className: "paramname", children: [param.label && param.label !== param.name ? param.label : param.name, " ", (0, jsx_runtime_1.jsx)("em", { children: param.type?.toLowerCase() })] }), param.type?.toUpperCase() === 'BOOLEAN' ? ((0, jsx_runtime_1.jsxs)("select", { value: args[param.name] ?? '', onChange: (event) => setArgs((current) => ({ ...current, [param.name]: event.target.value })), children: [(0, jsx_runtime_1.jsx)("option", { value: "", children: param.default != null ? `default: ${param.default}` : param.required ? 'required' : 'not set' }), (0, jsx_runtime_1.jsx)("option", { value: "true", children: "true" }), (0, jsx_runtime_1.jsx)("option", { value: "false", children: "false" })] })) : ((0, jsx_runtime_1.jsx)("input", { value: args[param.name] ?? '', placeholder: param.default != null ? `default: ${param.default}` : param.required ? 'required' : 'optional', onChange: (event) => setArgs((current) => ({ ...current, [param.name]: event.target.value })), onKeyDown: (event) => { if (event.key === 'Enter')
                                            void run(lens, args); } }))] }, param.name))), (0, jsx_runtime_1.jsxs)("div", { className: "row viewrunbar-actions", children: [(0, jsx_runtime_1.jsx)("button", { className: "btn primary", disabled: busy, onClick: () => void run(lens, args), children: busy ? 'running…' : 'Run' }), busy && services.kill && cancellable && ((0, jsx_runtime_1.jsx)("button", { className: "btn ghost", "data-lens-cancel": true, onClick: () => void cancel(), children: cancelling ? 'cancelling…' : 'Cancel' }))] })] }), (0, jsx_runtime_1.jsx)("div", { className: "viewoperation-body", children: (0, jsx_runtime_1.jsxs)("section", { className: "viewpane viewpane-results", "aria-label": "What the lens answered", "data-lens-result": true, children: [(0, jsx_runtime_1.jsx)("div", { className: "viewpane-scroll view-results", tabIndex: 0, children: !envelope ? (busy ? (0, jsx_runtime_1.jsx)("p", { className: "hint", children: "Running\u2026 The result will appear here." }) : status.tone === 'error' ? null : (0, jsx_runtime_1.jsx)("p", { className: "hint", children: "Nothing run yet." }))
                                        : rows ? (0, jsx_runtime_1.jsx)(chrome_tsx_1.RowTable, { rows: rows, columns: (0, rows_ts_1.rowColumns)(rows) })
                                            : hasData ? (0, jsx_runtime_1.jsx)("pre", { className: "lensdata", children: json })
                                                : (0, jsx_runtime_1.jsx)("p", { className: "hint", children: envelope.outcome === 'EMPTY' ? 'Nothing to show.' : 'No data.' }) }), (0, jsx_runtime_1.jsxs)("div", { className: "row results-foot", children: [envelope?.outputType && (0, jsx_runtime_1.jsx)("span", { className: "viewnote", children: envelope.outputType }), hasData && (0, jsx_runtime_1.jsx)(chrome_tsx_1.CopyButton, { label: "Copy as JSON", text: json }), busy && startedAt != null && (0, jsx_runtime_1.jsx)(runWait_tsx_1.RunWait, { startedAt: startedAt, lastStep: null }), (0, jsx_runtime_1.jsx)(chrome_tsx_1.Status, { tone: status.tone, children: status.text })] })] }) })] }))] }));
}
//# sourceMappingURL=LensRunner.js.map