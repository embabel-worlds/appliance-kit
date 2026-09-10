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
import React, { createContext, useCallback, useContext, useEffect, useRef, useState, useSyncExternalStore } from 'react';
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
    const [expandedRealm, setExpandedRealm] = useState(null);
    const [watchedViews, setWatchedViews] = useState(null);
    const [watchSummaryLoaded, setWatchSummaryLoaded] = useState(false);
    const [watchSupported, setWatchSupported] = useState(true);
    const [pane, setPane] = useState('run');
    const [schema, setSchema] = useState(null);
    const [schemaError, setSchemaError] = useState('');
    const [status, setStatus] = useState({ tone: null, text: '' });
    const [rows, setRows] = useState([]);
    const [ran, setRan] = useState(false);
    const [busy, setBusy] = useState(false);
    const load = useCallback(async () => {
        const outcome = await services.kg.views();
        if (!isOk(outcome))
            return setError(failureMessage(outcome, 'list saved views'));
        setError('');
        setViews(outcome.value);
    }, [services]);
    useEffect(() => { void load(); }, [load]);
    useEffect(() => {
        void services.watches.list().then((outcome) => {
            setWatchSummaryLoaded(true);
            if (isOk(outcome))
                return setWatchedViews(new Set(outcome.value.map((watch) => watch.lensId)));
        });
        if (services.kg.schema) {
            void services.kg.schema().then((outcome) => {
                if (isOk(outcome)) {
                    setSchema(outcome.value);
                    setSchemaError('');
                }
                else {
                    setSchemaError(failureMessage(outcome, 'load the graph schema'));
                }
            });
        }
        else {
            setSchemaError('This host does not provide the graph schema.');
        }
    }, [services]);
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
    const operationRef = useRef(null);
    const paneNavRef = useRef(null);
    const sectionRefs = useRef({});
    const pendingPaneScroll = useRef(false);
    /** Keep the requested values explicit; React may not have committed the form update yet. */
    const pendingRun = useRef(null);
    useEffect(() => {
        if (!views)
            return;
        const rest = hashRest;
        if (rest === drivenBy.current)
            return;
        pendingPaneScroll.current = false;
        pendingRun.current = null;
        drivenBy.current = rest;
        // null means the host is showing another workspace. Keep this mounted surface intact so a
        // Query Studio or Agents handoff can return to the operation, arguments and results.
        if (rest === null)
            return;
        if (!rest) {
            setSelected(null);
            return;
        }
        const [name, tail = ''] = rest.split('/');
        const wanted = views.find((candidate) => candidate.name === name);
        if (!wanted)
            return;
        const [destination, query = ''] = tail.split('?');
        const shouldReveal = destination === 'run' || destination === 'results' || destination === 'schema' || destination === 'watch';
        const nextPane = destination === 'results' || destination === 'schema' || destination === 'watch'
            ? destination
            : 'run';
        pendingPaneScroll.current = shouldReveal;
        if (selected === wanted.name) {
            setPane(nextPane);
            if (shouldReveal && pane === nextPane)
                requestAnimationFrame(() => revealPane(nextPane));
        }
        else {
            applyView(wanted, nextPane, shouldReveal);
        }
        // The visible form and the queued request use the same merge, without waiting for setArgs.
        const supplied = Object.fromEntries(new URLSearchParams(query));
        const nextArgs = { ...(selected === wanted.name ? args : defaultArgs(wanted)), ...supplied };
        if (Object.keys(supplied).length)
            setArgs(nextArgs);
        if (destination === 'run')
            pendingRun.current = { name: wanted.name, args: nextArgs };
    }, [views, hashRest, selected]);
    const list = views ?? [];
    const view = list.find((v) => v.name === selected) ?? null;
    // Wait only for the matching view; the request already carries its intended arguments.
    useEffect(() => {
        const pending = pendingRun.current;
        if (!pending || view?.name !== pending.name)
            return;
        pendingRun.current = null;
        void run(pending.args);
    }, [view, args, hashRest]);
    const params = (view?.params ?? {});
    const referencedLabels = new Set();
    for (const match of view?.cypher?.matchAll(/:\s*`?([A-Za-z_][A-Za-z0-9_]*)`?/g) ?? []) {
        if (match[1])
            referencedLabels.add(match[1]);
    }
    if (view?.outputLabel)
        referencedLabels.add(view.outputLabel);
    const viewSchemaLabels = (schema?.labels ?? []).filter((label) => referencedLabels.has(label.label));
    /*
     * Provenance grouping. `source` is the realm that shipped a view; null means it was authored in
     * this world's own config. A flat list is unreadable the moment a few realms are aboard, and the
     * group header is also the answer to "where did this come from?".
     */
    const groups = {};
    for (const v of list)
        (groups[v.source || 'World'] ??= []).push(v);
    const groupNames = Object.keys(groups).sort((a, b) => (a === 'World' ? -1 : b === 'World' ? 1 : a.localeCompare(b)));
    function routeFor(name, destination) {
        return destination === 'open' ? name : `${name}/${destination}`;
    }
    function navigate(name, destination, replace = false) {
        if (!host.navigateToView)
            return;
        drivenBy.current = name ? routeFor(name, destination) : null;
        host.navigateToView(name, destination, replace);
    }
    function defaultArgs(v) {
        return Object.fromEntries(Object.entries((v.params ?? {}))
            .map(([k, spec]) => [k, spec?.default == null ? '' : String(spec.default)]));
    }
    function applyView(v, nextPane, reveal) {
        pendingPaneScroll.current = reveal;
        setExpandedRealm(v.source || 'World');
        setSelected(v.name);
        setPane(nextPane);
        setStatus({ tone: null, text: '' });
        setRows([]);
        setRan(false);
        setArgs(defaultArgs(v));
    }
    function pick(v, nextPane = pane, destination = nextPane === 'run' ? 'open' : nextPane) {
        if (v.name === selected)
            return showPane(nextPane);
        applyView(v, nextPane, destination !== 'open');
        navigate(v.name, destination);
    }
    function revealPaneButton(nextPane) {
        paneNavRef.current?.querySelector(`[data-view-pane="${nextPane}"]`)?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
    function revealPane(nextPane) {
        revealPaneButton(nextPane);
        sectionRefs.current[nextPane]?.scrollIntoView({ block: 'start', inline: 'nearest' });
        requestAnimationFrame(() => { pendingPaneScroll.current = false; });
    }
    function showPane(nextPane, replace = true) {
        if (!view)
            return;
        const alreadyActive = pane === nextPane;
        pendingPaneScroll.current = true;
        setPane(nextPane);
        navigate(view.name, nextPane === 'run' ? 'open' : nextPane, replace);
        if (alreadyActive)
            requestAnimationFrame(() => revealPane(nextPane));
    }
    // URL/nav-driven panes scroll once. Scroll-driven pane changes deliberately do not set this flag,
    // so observing the document cannot snap it back or create a render loop.
    useEffect(() => {
        if (!view || !pendingPaneScroll.current)
            return;
        const frame = requestAnimationFrame(() => revealPane(pane));
        return () => cancelAnimationFrame(frame);
    }, [view?.name, pane]);
    useEffect(() => {
        const operation = operationRef.current;
        if (!view || !operation)
            return;
        let frame = 0;
        let resizeFrame = 0;
        const follow = () => {
            cancelAnimationFrame(frame);
            frame = requestAnimationFrame(() => {
                if (pendingPaneScroll.current)
                    return;
                const marker = (paneNavRef.current?.getBoundingClientRect().bottom ?? 0) + 18;
                let current = 'run';
                const candidates = watchSupported ? ['run', 'results', 'schema', 'watch'] : ['run', 'results', 'schema'];
                for (const candidate of candidates) {
                    const section = sectionRefs.current[candidate];
                    if (section && section.getBoundingClientRect().top <= marker)
                        current = candidate;
                }
                const scroller = /auto|scroll/.test(window.getComputedStyle(operation).overflowY)
                    ? operation : document.scrollingElement ?? document.documentElement;
                // A short final section cannot reach the marker when its scroll owner runs out of room.
                const atBottom = scroller.clientHeight > 0 && scroller.scrollHeight > scroller.clientHeight
                    && scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 1;
                if (atBottom)
                    current = candidates[candidates.length - 1];
                if (current === pane)
                    return;
                setPane(current);
                navigate(view.name, current === 'run' ? 'open' : current, true);
                revealPaneButton(current);
            });
        };
        const resize = () => {
            // A breakpoint can move scrolling between the document and the operation column.
            pendingPaneScroll.current = true;
            cancelAnimationFrame(frame);
            cancelAnimationFrame(resizeFrame);
            resizeFrame = requestAnimationFrame(() => revealPane(pane));
        };
        operation.addEventListener('scroll', follow, { passive: true });
        window.addEventListener('scroll', follow, { passive: true });
        window.addEventListener('resize', resize);
        return () => {
            cancelAnimationFrame(frame);
            cancelAnimationFrame(resizeFrame);
            operation.removeEventListener('scroll', follow);
            window.removeEventListener('scroll', follow);
            window.removeEventListener('resize', resize);
        };
    }, [view?.name, pane, watchSupported]);
    /** A blank field means "use the declared default", NOT "pass an empty string". */
    const supplied = (values = args) => Object.fromEntries(Object.entries(values).filter(([, v]) => v !== '' && v != null));
    async function run(values = args) {
        if (!view)
            return;
        setBusy(true);
        setRows([]);
        setRan(false);
        setStatus({ tone: null, text: 'running…' });
        const outcome = await services.kg.runView(view.name, supplied(values));
        setBusy(false);
        if (!isOk(outcome)) {
            setStatus({ tone: 'error', text: failureMessage(outcome, `run '${view.name}'`) });
            showPane('results', true);
            return;
        }
        const result = outcome.value;
        const got = (result.rows ?? []);
        // `rowCount` is documented as required and is not always sent. The rows are the truth.
        const rowCount = result.rowCount ?? got.length;
        if (result.error) {
            setStatus({ tone: 'error', text: result.error });
            showPane('results', true);
            return;
        }
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
        showPane('results', true);
    }
    /** Expand with these arguments and hand the runnable cypher to the editor next door. */
    async function openInStudio() {
        if (!view)
            return;
        setStatus({ tone: null, text: 'expanding…' });
        const outcome = await services.kg.viewInvocation(view.name, supplied());
        if (!isOk(outcome))
            return setStatus({ tone: 'error', text: failureMessage(outcome, 'prepare this view for Query Studio') });
        if (!outcome.value.cypher)
            return setStatus({ tone: 'error', text: 'The appliance returned no Cypher. Try Open in Query Studio again.' });
        host.onOpenInStudio(outcome.value.cypher);
    }
    async function remove(name) {
        if (!confirm(`Delete the view '${name}'?`))
            return;
        const outcome = await services.kg.deleteView(name);
        if (!isOk(outcome))
            return setStatus({ tone: 'error', text: failureMessage(outcome, 'delete this view') });
        setSelected(null);
        navigate(null, 'open');
        void load();
    }
    async function refresh(name) {
        setStatus({ tone: null, text: 'recomputing the cache…' });
        const outcome = await services.kg.refreshView(name);
        if (!isOk(outcome))
            return setStatus({ tone: 'error', text: failureMessage(outcome, 'refresh this view') });
        setStatus({ tone: 'ok', text: `'${name}' recomputed` });
        void load();
    }
    if (!view)
        return (_jsxs("div", { className: "kit-feature kit-feature-views viewspage viewspage-board", children: [_jsx("div", { className: "viewboard-head", children: _jsxs("div", { children: [_jsx("h2", { children: "Operation Board" }), _jsx("p", { className: "hint", children: "Choose a realm, inspect its operations, and open or run one directly." })] }) }), error ? _jsx(Status, { tone: "error", children: error }) : views == null ? _jsx("p", { className: "hint", children: "loading\u2026" }) : list.length === 0 ? (_jsx(StudioPanel, { title: "Saved views", children: _jsx("p", { className: "hint", children: "No saved views yet. Write a query in Query Studio and save it \u2014 that is where views come from." }) })) : (_jsx("div", { className: "viewrealms", children: groupNames.map((name) => {
                        const realmViews = groups[name];
                        const isExpanded = expandedRealm === name;
                        const materialized = realmViews.filter((candidate) => candidate.materialized).length;
                        const watched = watchedViews == null ? null : realmViews.filter((candidate) => watchedViews.has(candidate.name)).length;
                        return (_jsxs("section", { className: `panel viewrealm${isExpanded ? ' expanded' : ''}`, children: [_jsxs("button", { className: "viewrealm-head", "data-viewgroup": name, "aria-expanded": isExpanded, onClick: () => setExpandedRealm(isExpanded ? null : name), children: [_jsxs("span", { children: [_jsx("strong", { children: name }), _jsxs("small", { children: [realmViews.length, " operations \u00B7 ", materialized, " materialized \u00B7 ", !watchSummaryLoaded ? 'watch state loading' : watched == null ? 'watch state unavailable' : `${watched} watched`] })] }), _jsx("span", { className: "chev", "aria-hidden": "true", children: isExpanded ? '−' : '+' })] }), isExpanded && (_jsx("div", { className: "viewrealm-operations", children: realmViews.map((candidate) => (_jsxs("article", { className: "viewoperation", children: [_jsxs("button", { className: "viewoperation-open", onClick: () => pick(candidate, 'run', 'open'), children: [_jsx("strong", { children: candidate.name }), _jsx("small", { children: candidate.description }), _jsxs("span", { className: "viewnote", children: [Object.keys(candidate.params ?? {}).length, " parameter(s) \u00B7 ", candidate.materialized ? 'Materialized' : candidate.outputLabel ?? 'Tabular'] })] }), _jsx("button", { className: "btn primary", onClick: () => { pendingRun.current = { name: candidate.name, args: defaultArgs(candidate) }; pick(candidate, 'run', 'run'); }, children: "Run" })] }, candidate.name))) }))] }, name));
                    }) }))] }));
    const realm = view.source || 'World';
    const siblings = groups[realm];
    const paneLinks = [
        ['run', 'Run'],
        ['results', ran ? `Results · ${rows.length}` : 'Results'],
        ['schema', 'Schema'],
        ['watch', 'Watch / receipts'],
    ];
    const navigator = () => (_jsxs(_Fragment, { children: [_jsxs("div", { className: "viewnav-head", children: [_jsx("span", { className: "viewnav-label", children: "Realm" }), _jsx("h2", { children: realm }), _jsx("small", { children: "Selected operation" }), _jsx("strong", { children: view.name }), _jsx("button", { className: "btn ghost", onClick: () => { setSelected(null); navigate(null, 'open'); }, children: "\u2190 Operation Board" })] }), _jsxs("nav", { className: "viewnav-section", "aria-label": `Other operations in ${realm}`, children: [_jsxs("span", { className: "viewnav-label", children: ["This realm \u00B7 ", siblings.length] }), siblings.map((candidate) => (_jsxs("button", { className: `viewsibling${candidate.name === view.name ? ' active' : ''}`, "aria-current": candidate.name === view.name ? 'page' : undefined, onClick: () => pick(candidate, pane), children: [_jsx("strong", { children: candidate.name }), _jsxs("small", { children: [Object.keys(candidate.params ?? {}).length, " parameter(s) \u00B7 ", candidate.materialized ? 'Materialized' : candidate.outputLabel ?? 'Tabular'] })] }, candidate.name)))] })] }));
    return (_jsxs("div", { className: "kit-feature kit-feature-views viewspage viewspage-selected", children: [_jsx("aside", { className: "panel viewspage-sidebar", "aria-label": `${realm} operation navigator`, children: navigator() }), _jsxs("details", { className: "panel viewspage-mobile-nav", children: [_jsx("summary", { children: _jsxs("span", { children: [_jsx("strong", { children: "Browse this realm" }), _jsxs("small", { children: [realm, " \u00B7 ", view.name] })] }) }), _jsx("div", { className: "viewspage-mobile-nav-body", children: navigator() })] }), _jsxs("div", { className: "viewspage-operation", ref: operationRef, children: [_jsxs("section", { className: "panel viewoperation-head", children: [_jsxs("div", { children: [_jsxs("span", { className: "viewnav-label", children: [realm, " \u00B7 operation"] }), _jsx("h2", { children: view.name }), _jsxs("span", { className: "viewnote", children: [Object.keys(params).length, " parameter(s) \u00B7 ", view.materialized ? 'Materialized' : view.outputLabel ?? 'Tabular'] })] }), _jsxs("div", { className: "row", children: [view.materialized && _jsx("button", { className: "btn ghost", onClick: () => void refresh(view.name), children: "Refresh cache" }), _jsx("button", { className: "btn", onClick: () => void openInStudio(), children: "Open in Query Studio" }), _jsx("button", { className: "btn ghost", onClick: () => void remove(view.name), children: "Delete" })] }), view.description && _jsx("p", { className: "hint", children: view.description })] }), _jsx("nav", { className: "viewoperation-nav", "aria-label": "Operation sections", ref: paneNavRef, children: paneLinks.map(([name, label]) => (_jsx("button", { "data-view-pane": name, className: `viewoperation-nav-link${pane === name ? ' active' : ''}`, "aria-current": pane === name ? 'page' : undefined, onClick: () => showPane(name), children: label }, name))) }), _jsxs("div", { className: "viewoperation-sections", children: [_jsx("section", { className: "viewoperation-section", "data-view-pane": "run", ref: (node) => { sectionRefs.current.run = node ?? undefined; }, children: _jsxs(StudioPanel, { title: "Run", children: [Object.keys(params).length === 0 ? _jsx("p", { className: "hint", children: "No parameters \u2014 runs as saved." }) : (_jsx("div", { className: "paramform", children: Object.entries(params).map(([key, spec]) => (_jsxs("label", { className: "paramrow", children: [_jsxs("span", { className: "paramname", children: [key, " ", _jsx("em", { children: spec?.type })] }), _jsx("input", { value: args[key] ?? '', placeholder: spec?.default != null ? `default: ${spec.default}` : 'no default', onChange: (event) => setArgs((current) => ({ ...current, [key]: event.target.value })) }), spec?.description && _jsx("small", { children: spec.description })] }, key))) })), _jsx("div", { className: "row", children: _jsx("button", { className: "btn primary", disabled: busy, onClick: () => void run(), children: busy ? 'running…' : 'Run' }) }), view.cypher && (_jsxs("details", { className: "cypherbox", open: true, children: [_jsxs("summary", { children: ["Cypher", view.materialized ? ' · materialized — reads its cache' : ''] }), _jsx("pre", { tabIndex: 0, children: _jsx("code", { children: view.cypher }) })] })), _jsx("div", { className: `status${status.tone ? ` ${status.tone}` : ''}`, children: status.text })] }) }), _jsx("section", { className: "viewoperation-section", "data-view-pane": "results", ref: (node) => { sectionRefs.current.results = node ?? undefined; }, children: _jsxs(StudioPanel, { title: "Results", children: [_jsx("span", { "data-state": "view.ran", hidden: !ran }), !ran ? (busy ? _jsx("p", { className: "hint", children: "Running\u2026 Results will appear here." }) : status.tone === 'error' ? null : _jsx("p", { className: "hint", children: "Nothing run yet." })) : rows.length === 0 ? _jsx("p", { className: "hint", children: "No rows." }) : (_jsx("div", { className: "view-results", children: _jsx(RowTable, { rows: rows, columns: rowColumns(rows) }) })), _jsxs("div", { className: "row results-foot", children: [ran && rows.length > 0 && _jsxs(_Fragment, { children: [_jsx(CopyButton, { label: "Copy as Markdown", text: rowsToMarkdown(rows) }), _jsx(CopyButton, { label: "Copy as CSV", text: rowsToCsv(rows) })] }), _jsx(Status, { tone: status.tone, children: status.text })] })] }) }), _jsx("section", { className: "viewoperation-section", "data-view-pane": "schema", ref: (node) => { sectionRefs.current.schema = node ?? undefined; }, children: _jsx(StudioPanel, { title: "Schema", aside: schema && _jsxs("span", { className: "hint", children: [viewSchemaLabels.length, " labels used"] }), children: schemaError ? _jsx(Status, { tone: "error", children: schemaError }) : schema == null ? _jsx("p", { className: "hint", children: "loading\u2026" }) : viewSchemaLabels.length === 0 ? (_jsx("p", { className: "hint", children: "No declared schema labels were found in this operation's query." })) : (_jsx("div", { className: "viewschema", children: viewSchemaLabels.map((label) => (_jsxs("article", { className: "viewschema-label", children: [_jsxs("div", { className: "row", children: [_jsx("strong", { children: label.label }), _jsx("span", { className: "viewtag", children: label.anchor === false ? 'reach-only' : 'anchor' })] }), label.description && _jsx("p", { children: label.description }), _jsxs("small", { children: [label.realm ?? 'World', " \u00B7 ", label.sampleCount, " sampled"] }), label.properties.length > 0 && _jsx("dl", { children: label.properties.map((property) => _jsxs(React.Fragment, { children: [_jsx("dt", { children: property.name }), _jsx("dd", { children: property.type })] }, property.name)) })] }, label.label))) })) }) }), _jsx("section", { className: "viewoperation-section", "data-view-pane": "watch", ref: (node) => { sectionRefs.current.watch = node ?? undefined; }, children: _jsx(WatchPanel, { viewName: view.name, args: args, onSupportChange: setWatchSupported, onWatchChange: (watching) => setWatchedViews((current) => {
                                        const next = new Set(current ?? []);
                                        watching ? next.add(view.name) : next.delete(view.name);
                                        return next;
                                    }), onWriteAgent: (signalType) => host.onCreateHandler({ signalType, view: view.name }) }, view.name) })] })] })] }));
}
/*
 * WATCHING A VIEW — the shortest path from a saved question to an agent.
 *
 * The appliance's watch subsystem does the work: it re-materializes the subject on a cron, diffs
 * the result with a declarative `DiffSpec`, and keeps every run, snapshot and diff. This panel adds
 * no logic to that; it creates a Watch whose subject is this view and whose delivery channel is
 * `signal`.
 *
 * Change-signal publication is separate from configured delivery. A watch with no delivery
 * notifies no one; that does not mean it publishes no change signal.
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
function WatchPanel({ viewName, args, onWatchChange, onWriteAgent, onSupportChange }) {
    const { services } = useViewsRuntime();
    const [watch, setWatch] = useState(null);
    const [loading, setLoading] = useState(true);
    const [problem, setProblem] = useState('');
    const [schedule, setSchedule] = useState(SCHEDULES[0][0]);
    const [busy, setBusy] = useState(false);
    const [status, setStatus] = useState({ tone: null, text: '' });
    const signalType = `view.${viewName}.changed`;
    const load = useCallback(async () => {
        setLoading(true);
        setProblem('');
        const r = await services.watches.list();
        onSupportChange(r.ok || r.kind !== 'unsupported');
        setLoading(false);
        if (!r.ok)
            return setProblem(failureMessage(r, 'list watches'));
        setWatch(r.value.find((w) => w.lensId === viewName) ?? null);
    }, [viewName, services, onSupportChange]);
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
            return setStatus({ tone: 'error', text: failureMessage(r, 'start watching this view') });
        }
        setStatus({ tone: 'ok', text: 'Watching. The first run takes a baseline; changes after that publish a signal.' });
        onWatchChange(true);
        void load();
    }
    async function stop() {
        if (!watch)
            return;
        setBusy(true);
        const r = await services.watches.delete(watch.id);
        setBusy(false);
        if (!r.ok)
            return setStatus({ tone: 'error', text: failureMessage(r, 'stop this watch') });
        setWatch(null);
        onWatchChange(false);
        setStatus({ tone: null, text: 'Watch stopped.' });
    }
    async function runNow() {
        if (!watch)
            return;
        setBusy(true);
        const r = await services.watches.run(watch.id);
        setBusy(false);
        setStatus(r.ok
            ? { tone: 'ok', text: 'Run requested. Check the run receipts above for its outcome.' }
            : { tone: 'error', text: failureMessage(r, 'run this watch') });
    }
    if (loading)
        return _jsx(StudioPanel, { title: "Watch", children: _jsx(Status, { tone: null, children: "Checking watches\u2026" }) });
    if (problem)
        return (_jsxs(StudioPanel, { title: "Watch", children: [_jsx(Status, { tone: "error", children: problem }), _jsx("button", { className: "btn", onClick: () => void load(), children: "Retry watch listing" })] }));
    return (_jsxs(StudioPanel, { title: "Watch", aside: watch ? _jsx("span", { className: "stage watching", children: "watching" }) : undefined, children: [!watch ? (_jsxs(_Fragment, { children: [_jsxs("p", { className: "hint", children: ["Run this view on a schedule, diff the answer, and publish ", _jsx("code", { children: signalType }), " when it changes. The watch publishes a signal; it does not notify anyone by itself."] }), _jsxs("div", { className: "row skillsource", children: [_jsx("select", { value: schedule, "aria-label": "Watch schedule", onChange: (e) => setSchedule(e.target.value), children: SCHEDULES.map(([cron, says]) => _jsx("option", { value: cron, children: says }, cron)) }), _jsx("input", { value: schedule, onChange: (e) => setSchedule(e.target.value), "aria-label": "cron expression" }), _jsx("button", { className: "btn", disabled: busy, onClick: () => void start(), children: "Watch this" })] }), _jsx("p", { className: "hint", children: "Any arguments above are frozen into the watch \u2014 the same question, asked on a timer." })] })) : (_jsxs(_Fragment, { children: [_jsxs("div", { className: "statline", children: [_jsx("span", { children: "Change signal:\u00A0" }), _jsx("strong", { children: _jsx("code", { children: signalType }) })] }), _jsxs("div", { className: "statline", children: [_jsx("span", { children: "Schedule:\u00A0" }), _jsx("strong", { children: watch.cron ?? 'not scheduled' })] }), _jsxs("div", { className: "statline", children: [_jsx("span", { children: "Delivery:\u00A0" }), _jsx("strong", { children: !watch.delivery?.channel || watch.delivery.channel === 'none' ? 'none — notifies no one' : watch.delivery.channel })] }), _jsxs("div", { className: "row studio-actions", children: [_jsx("button", { className: "btn", disabled: busy, onClick: () => void runNow(), children: "Run it now" }), _jsx("button", { className: "btn", onClick: () => onWriteAgent(signalType), children: "Write an agent for it" }), _jsx("button", { className: "btn ghost", disabled: busy, onClick: () => void stop(), children: "Stop watching" })] }), _jsxs("p", { className: "hint", children: ["This watch reruns on schedule and publishes ", _jsx("code", { children: signalType }), " when rows change. Add a handler only if you want an automated response."] }), _jsx("div", { className: "subhead", children: "Runs" }), _jsx(WatchReceipts, { watchId: watch.id })] })), _jsx(Status, { tone: status.tone, children: status.text })] }));
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
 *   DELIVERIES — outcomes of configured delivery            (/watches/{id}/deliveries)
 *
 * A missing delivery receipt does not establish whether a change signal was published.
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
            return setProblem(failureMessage(r, "list this watch's runs"));
        if (!c.ok)
            return setProblem(failureMessage(c, "list this watch's changes"));
        if (!d.ok)
            return setProblem(failureMessage(d, "list this watch's deliveries"));
        setProblem('');
        // Newest first: a receipt is read from the top, and the run somebody just triggered is the
        // one they are looking for.
        setRuns([...r.value].reverse());
        setDiffs(c.value);
        setDeliveries(d.value);
    }, [watchId, services]);
    useEffect(() => { void load(); }, [load]);
    if (problem)
        return _jsxs(_Fragment, { children: [_jsx(Status, { tone: "error", children: problem }), _jsx("button", { className: "btn ghost tiny", onClick: () => void load(), children: "Refresh receipts" })] });
    if (runs === null)
        return _jsx("p", { className: "hint", children: "Reading this watch's history\u2026" });
    if (runs.length === 0) {
        return _jsxs(_Fragment, { children: [_jsxs("p", { className: "hint", children: ["No runs listed yet. ", _jsx("em", { children: "Run it now" }), " requests a run."] }), _jsx("button", { className: "btn ghost tiny", onClick: () => void load(), children: "Refresh receipts" })] });
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
                return (_jsxs("div", { className: "receipt", children: [_jsxs("div", { className: "receipt-head", children: [_jsx("span", { className: `stage ${run.errorCode ? 'acting' : changes.length ? 'watching' : 'proposed'}`, children: run.errorCode ? 'failed' : changes.length ? 'changed' : 'no recorded changes' }), _jsx("strong", { children: whenShort(run.startedAt) }), _jsx("small", { children: (run.status ?? '').toLowerCase() })] }), run.errorCode && _jsx("p", { className: "receipt-line", children: run.errorCode }), changes.length > 0 && (_jsxs("p", { className: "receipt-line", children: [counts.join(' · '), changes.slice(0, 3).map((c) => c.key).filter(Boolean).length > 0 &&
                                    ` — ${changes.slice(0, 3).map((c) => c.key).filter(Boolean).join(', ')}`, changes.length > 3 ? ` and ${changes.length - 3} more` : ''] })), delivered.length > 0 && (_jsx("p", { className: "receipt-line receipt-delivery", children: delivered.map((d) => `Delivery to ${d.channel ?? 'an unspecified channel'} · ${(d.status ?? 'status unavailable').toLowerCase()}`).join(' · ') })), changes.length > 0 && delivered.length === 0 && (_jsx("p", { className: "receipt-line hint", children: "No delivery receipt is available for this run." }))] }, run.id));
            }), _jsxs("div", { className: "row", children: [_jsx("button", { className: "btn ghost tiny", onClick: () => void load(), children: "Refresh receipts" }), runs.length > 8 && _jsxs("span", { className: "hint", children: ["showing the last 8 of ", runs.length] })] })] }));
}
//# sourceMappingURL=SavedViewsSurface.js.map