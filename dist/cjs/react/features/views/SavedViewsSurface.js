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
exports.SavedViewsSurface = SavedViewsSurface;
const jsx_runtime_1 = require("react/jsx-runtime");
/*
 * VIEWS — the world's saved questions, as a place rather than a panel.
 *
 * A view is the durable thing: someone worked out a question worth asking, named it, and now
 * anyone can ask it again with different arguments. That is not a sub-feature of the editor, so it
 * is not buried in the editor's rail — it is where you go when you want an ANSWER rather than a
 * query.
 *
 * ONE WINDOW, ONE SCROLLER. A selected view is a fixed workspace: the run bar (arguments, the
 * Cypher, Run) stays put above three tabs — Results, Schema, Watch — and only the active tab's body
 * scrolls. The results table scrolls both ways, so it must never sit inside a page that scrolls
 * too; tabs that anchored into one long page produced exactly that double scrollbar.
 *
 * RUNNING. An unedited view runs through the appliance's one-call `runView`. Once its Cypher is
 * edited, Run sends the edited body to `execute` WITH the view's declared params, so it gets the
 * same defaults, coercion and substitution it will get once saved — trying an edit never requires
 * saving it. Query Studio remains the place to write a query from nothing; "Open in Query Studio"
 * is how you cross over.
 *
 * SAVING. Only a view the user saved themselves is saved in place. A realm's view, or one shipped
 * with the world, is saved as a COPY under a new name — the appliance refuses to shadow it, and it
 * would not load if it did.
 */
const react_1 = __importStar(require("react"));
const kg_ts_1 = require("../../../client/kg.js");
const outcome_ts_1 = require("../../../client/outcome.js");
const rows_ts_1 = require("../../../vc/rows.js");
const format_ts_1 = require("../../../studio-kit/format.js");
const chrome_tsx_1 = require("../studio/chrome.js");
const SaveCopyDialog_tsx_1 = require("./SaveCopyDialog.js");
const ViewCypherEditor_tsx_1 = require("./ViewCypherEditor.js");
const PANE_LABELS = { results: 'Results', schema: 'Schema', watch: 'Watch / receipts' };
/** The appliance's `source` for a view the user saved in their own world — the only kind saved in place. */
const USER_SAVED = 'saved';
/*
 * Provenance grouping. `source` is the realm that shipped a view, `saved` marks one the user saved,
 * and null means it came with this world's own config. A flat list is unreadable the moment a few
 * realms are aboard, and the group is also the answer to "where did this come from?".
 */
function groupOf(v) {
    return v.source === USER_SAVED ? 'Yours' : v.source || 'World';
}
/** Why this view must be saved as a copy, or null when it can be saved in place. */
function copyReason(v) {
    // Saving carries no contract binding, so saving over a contracted view would silently unbind it.
    if (v.source === USER_SAVED)
        return v.dataContract ? { kind: 'contract' } : null;
    return v.source ? { kind: 'realm', realm: v.source } : { kind: 'world' };
}
const GROUP_ORDER = ['Yours', 'World'];
function compareGroups(a, b) {
    const rank = (name) => { const i = GROUP_ORDER.indexOf(name); return i < 0 ? GROUP_ORDER.length : i; };
    return rank(a) - rank(b) || a.localeCompare(b);
}
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
    const [expandedRealm, setExpandedRealm] = (0, react_1.useState)(null);
    const [watchedViews, setWatchedViews] = (0, react_1.useState)(null);
    const [watchSummaryLoaded, setWatchSummaryLoaded] = (0, react_1.useState)(false);
    const [pane, setPane] = (0, react_1.useState)('results');
    const [schema, setSchema] = (0, react_1.useState)(null);
    const [schemaError, setSchemaError] = (0, react_1.useState)('');
    const [status, setStatus] = (0, react_1.useState)({ tone: null, text: '' });
    const [rows, setRows] = (0, react_1.useState)([]);
    const [ran, setRan] = (0, react_1.useState)(false);
    const [busy, setBusy] = (0, react_1.useState)(false);
    const [editorSize, setEditorSize] = (0, react_1.useState)('closed');
    const [edited, setEdited] = (0, react_1.useState)(false);
    const [saveNote, setSaveNote] = (0, react_1.useState)(null);
    const [copying, setCopying] = (0, react_1.useState)(false);
    const editorRef = (0, react_1.useRef)(null);
    const load = (0, react_1.useCallback)(async () => {
        const outcome = await services.kg.views();
        if (!(0, outcome_ts_1.isOk)(outcome))
            return setError((0, chrome_tsx_1.failureMessage)(outcome, 'list saved views'));
        setError('');
        setViews(outcome.value);
    }, [services]);
    (0, react_1.useEffect)(() => { void load(); }, [load]);
    (0, react_1.useEffect)(() => {
        void services.watches.list().then((outcome) => {
            setWatchSummaryLoaded(true);
            if ((0, outcome_ts_1.isOk)(outcome))
                return setWatchedViews(new Set(outcome.value.map((watch) => watch.lensId)));
        });
        if (services.kg.schema) {
            void services.kg.schema().then((outcome) => {
                if ((0, outcome_ts_1.isOk)(outcome)) {
                    setSchema(outcome.value);
                    setSchemaError('');
                }
                else {
                    setSchemaError((0, chrome_tsx_1.failureMessage)(outcome, 'load the graph schema'));
                }
            });
        }
        else {
            setSchemaError('This host does not provide the graph schema.');
        }
    }, [services]);
    /*
     * DRIVABLE FROM THE URL: `#views/<name>` selects a view, `#views/<name>/run` selects and runs it,
     * and `/results`, `/schema`, `/watch` open that tab.
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
    /** Keep the requested values explicit; React may not have committed the form update yet. */
    const pendingRun = (0, react_1.useRef)(null);
    (0, react_1.useEffect)(() => {
        if (!views)
            return;
        const rest = hashRest;
        if (rest === drivenBy.current)
            return;
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
        const nextPane = destination === 'schema' || destination === 'watch' ? destination : 'results';
        if (selected === wanted.name)
            setPane(nextPane);
        else
            applyView(wanted, nextPane);
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
    (0, react_1.useEffect)(() => {
        const pending = pendingRun.current;
        if (!pending || view?.name !== pending.name)
            return;
        pendingRun.current = null;
        void run(pending.args);
    }, [view, args, hashRest]);
    // A different view puts its own saved body in the editor. The editor is mounted with the
    // operation layout, and a child's effects run before this one, so it exists by now.
    (0, react_1.useEffect)(() => {
        editorRef.current?.setText(view?.cypher ?? '');
        setEdited(false);
    }, [view?.name]);
    const params = (view?.params ?? {});
    const referencedLabels = new Set();
    for (const match of view?.cypher?.matchAll(/:\s*`?([A-Za-z_][A-Za-z0-9_]*)`?/g) ?? []) {
        if (match[1])
            referencedLabels.add(match[1]);
    }
    if (view?.outputLabel)
        referencedLabels.add(view.outputLabel);
    const viewSchemaLabels = (schema?.labels ?? []).filter((label) => referencedLabels.has(label.label));
    const groups = {};
    for (const v of list)
        (groups[groupOf(v)] ??= []).push(v);
    const groupNames = Object.keys(groups).sort(compareGroups);
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
    function applyView(v, nextPane) {
        setExpandedRealm(groupOf(v));
        setSelected(v.name);
        setPane(nextPane);
        setStatus({ tone: null, text: '' });
        setRows([]);
        setRan(false);
        setArgs(defaultArgs(v));
        setEditorSize('closed');
        setSaveNote(null);
        setCopying(false);
    }
    function pick(v, nextPane = pane, destination = nextPane === 'results' ? 'open' : nextPane) {
        if (v.name === selected)
            return showPane(nextPane);
        applyView(v, nextPane);
        navigate(v.name, destination);
    }
    function showPane(nextPane, replace = true) {
        if (!view)
            return;
        setPane(nextPane);
        navigate(view.name, nextPane === 'results' ? 'open' : nextPane, replace);
    }
    /** A blank field means "use the declared default", NOT "pass an empty string". */
    const supplied = (values = args) => Object.fromEntries(Object.entries(values).filter(([, v]) => v !== '' && v != null));
    async function run(values = args) {
        if (!view)
            return;
        // Running is for looking at rows, so the editor gets out of the way at either size.
        setEditorSize('closed');
        setBusy(true);
        setRows([]);
        setRan(false);
        setStatus({ tone: null, text: 'running…' });
        const draft = edited ? editorRef.current?.getText() : undefined;
        const outcome = draft === undefined
            ? await services.kg.runView(view.name, supplied(values))
            : await services.kg.execute(draft, { params, args: supplied(values) });
        setBusy(false);
        if (!(0, outcome_ts_1.isOk)(outcome)) {
            setStatus({ tone: 'error', text: (0, chrome_tsx_1.failureMessage)(outcome, `run '${view.name}'`) });
            showPane('results', true);
            return;
        }
        const result = outcome.value;
        if ((0, kg_ts_1.isBackgroundHandle)(result)) {
            setStatus({ tone: 'error', text: 'The appliance answered with a background run instead of rows. Run again.' });
            showPane('results', true);
            return;
        }
        const got = (result.rows ?? []);
        // `rowCount` is documented as required and is not always sent. The rows are the truth.
        const rowCount = result.rowCount ?? got.length;
        if (result.error) {
            setStatus({ tone: 'error', text: result.error });
            showPane('results', true);
            return;
        }
        const parts = [`${rowCount} row(s)`];
        if (draft !== undefined)
            parts.push('edited query, not saved');
        if (result.durationMs != null)
            parts.push((0, format_ts_1.formatDuration)(result.durationMs));
        for (const warning of result.warnings ?? [])
            parts.push(warning);
        if (!rowCount && result.hint)
            parts.push(result.hint);
        setStatus({ tone: (result.warnings ?? []).length ? 'caution' : 'ok', text: parts.join(' · ') });
        setRows(got);
        setRan(true);
        showPane('results', true);
    }
    /*
     * SAVING the editor's text as `name`. Everything but the body is carried over from the view being
     * edited — except `outputLabel`, which the appliance infers from the body, so an edit that changes
     * what the view returns is labelled by what it now returns. Resolves to a refusal, or null.
     */
    async function persist(name, cypher) {
        if (!view)
            return 'Choose a view first.';
        const outcome = await services.kg.saveView({
            name, cypher, description: view.description, params: view.params, materialized: view.materialized, ttl: view.ttl,
        });
        if (!(0, outcome_ts_1.isOk)(outcome))
            return (0, chrome_tsx_1.failureMessage)(outcome, `save '${name}'`);
        if (!outcome.value.ok)
            return outcome.value.note ?? `The appliance did not save '${name}'.`;
        // Promotion can inline captured scopes, so the stored body is the one to show.
        if (outcome.value.savedCypher)
            editorRef.current?.setText(outcome.value.savedCypher);
        setEdited(false);
        await load();
        return null;
    }
    async function save() {
        if (!view || !edited)
            return;
        if (copyReason(view))
            return setCopying(true);
        const previous = view.cypher;
        setSaveNote({ tone: null, text: 'saving…' });
        const refused = await persist(view.name, editorRef.current?.getText() ?? '');
        setSaveNote(refused ? { tone: 'error', text: refused } : { tone: 'ok', text: 'Saved', undo: previous });
    }
    /** Put the body that was there before the last save back. There is no history beyond this one. */
    async function undoSave(previous) {
        if (!view)
            return;
        editorRef.current?.setText(previous);
        setSaveNote({ tone: null, text: 'restoring…' });
        const refused = await persist(view.name, previous);
        setSaveNote(refused ? { tone: 'error', text: refused } : { tone: 'ok', text: 'Restored the previous query' });
    }
    async function saveCopy(name) {
        const refused = await persist(name, editorRef.current?.getText() ?? '');
        if (refused)
            return refused;
        // The copy IS the query on screen, so the selection moves to it and the rows stay.
        setCopying(false);
        setSelected(name);
        setExpandedRealm('Yours');
        setSaveNote({ tone: 'ok', text: `Saved as ${name}` });
        navigate(name, pane === 'results' ? 'open' : pane);
        return null;
    }
    function onEdit(text) {
        setEdited(text !== (view?.cypher ?? ''));
        if (saveNote)
            setSaveNote(null);
    }
    function revert() {
        editorRef.current?.setText(view?.cypher ?? '');
        setEdited(false);
        setSaveNote(null);
    }
    /** Expand with these arguments and hand the runnable cypher to the editor next door. */
    async function openInStudio() {
        if (!view)
            return;
        setStatus({ tone: null, text: 'expanding…' });
        const outcome = await services.kg.viewInvocation(view.name, supplied());
        if (!(0, outcome_ts_1.isOk)(outcome))
            return setStatus({ tone: 'error', text: (0, chrome_tsx_1.failureMessage)(outcome, 'prepare this view for Query Studio') });
        if (!outcome.value.cypher)
            return setStatus({ tone: 'error', text: 'The appliance returned no Cypher. Try Open in Query Studio again.' });
        host.onOpenInStudio(outcome.value.cypher);
    }
    async function remove(name) {
        if (!confirm(`Delete the view '${name}'?`))
            return;
        const outcome = await services.kg.deleteView(name);
        if (!(0, outcome_ts_1.isOk)(outcome))
            return setStatus({ tone: 'error', text: (0, chrome_tsx_1.failureMessage)(outcome, 'delete this view') });
        setSelected(null);
        navigate(null, 'open');
        void load();
    }
    async function refresh(name) {
        setStatus({ tone: null, text: 'recomputing the cache…' });
        const outcome = await services.kg.refreshView(name);
        if (!(0, outcome_ts_1.isOk)(outcome))
            return setStatus({ tone: 'error', text: (0, chrome_tsx_1.failureMessage)(outcome, 'refresh this view') });
        setStatus({ tone: 'ok', text: `'${name}' recomputed` });
        void load();
    }
    if (!view)
        return ((0, jsx_runtime_1.jsxs)("div", { className: "kit-feature kit-feature-views viewspage viewspage-board", children: [(0, jsx_runtime_1.jsx)("div", { className: "viewboard-head", children: (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("h2", { children: "Operation Board" }), (0, jsx_runtime_1.jsx)("p", { className: "hint", children: "Choose a realm, inspect its operations, and open or run one directly." })] }) }), error ? (0, jsx_runtime_1.jsx)(chrome_tsx_1.Status, { tone: "error", children: error }) : views == null ? (0, jsx_runtime_1.jsx)("p", { className: "hint", children: "loading\u2026" }) : list.length === 0 ? ((0, jsx_runtime_1.jsx)(chrome_tsx_1.StudioPanel, { title: "Saved views", children: (0, jsx_runtime_1.jsx)("p", { className: "hint", children: "No saved views yet. Write a query in Query Studio and save it \u2014 that is where views come from." }) })) : ((0, jsx_runtime_1.jsx)("div", { className: "viewrealms", children: groupNames.map((name) => {
                        const realmViews = groups[name];
                        const isExpanded = expandedRealm === name;
                        const materialized = realmViews.filter((candidate) => candidate.materialized).length;
                        const watched = watchedViews == null ? null : realmViews.filter((candidate) => watchedViews.has(candidate.name)).length;
                        return ((0, jsx_runtime_1.jsxs)("section", { className: `panel viewrealm${isExpanded ? ' expanded' : ''}`, children: [(0, jsx_runtime_1.jsxs)("button", { className: "viewrealm-head", "data-viewgroup": name, "aria-expanded": isExpanded, onClick: () => setExpandedRealm(isExpanded ? null : name), children: [(0, jsx_runtime_1.jsxs)("span", { children: [(0, jsx_runtime_1.jsx)("strong", { children: name }), (0, jsx_runtime_1.jsxs)("small", { children: [realmViews.length, " operations \u00B7 ", materialized, " materialized \u00B7 ", !watchSummaryLoaded ? 'watch state loading' : watched == null ? 'watch state unavailable' : `${watched} watched`] })] }), (0, jsx_runtime_1.jsx)("span", { className: "chev", "aria-hidden": "true", children: isExpanded ? '−' : '+' })] }), isExpanded && ((0, jsx_runtime_1.jsx)("div", { className: "viewrealm-operations", children: realmViews.map((candidate) => ((0, jsx_runtime_1.jsxs)("article", { className: "viewoperation", children: [(0, jsx_runtime_1.jsxs)("button", { className: "viewoperation-open", onClick: () => pick(candidate, 'results', 'open'), children: [(0, jsx_runtime_1.jsx)("strong", { children: candidate.name }), (0, jsx_runtime_1.jsx)("small", { children: candidate.description }), (0, jsx_runtime_1.jsxs)("span", { className: "viewnote", children: [Object.keys(candidate.params ?? {}).length, " parameter(s) \u00B7 ", candidate.materialized ? 'Materialized' : candidate.outputLabel ?? 'Tabular'] })] }), (0, jsx_runtime_1.jsx)("button", { className: "btn primary", onClick: () => { pendingRun.current = { name: candidate.name, args: defaultArgs(candidate) }; pick(candidate, 'results', 'run'); }, children: "Run" })] }, candidate.name))) }))] }, name));
                    }) }))] }));
    const group = groupOf(view);
    const siblings = groups[group] ?? [view];
    const reason = copyReason(view);
    const ownView = view.source === USER_SAVED;
    const paneLabel = (name) => name === 'results' && ran ? `Results · ${rows.length}` : PANE_LABELS[name];
    const navigator = () => ((0, jsx_runtime_1.jsxs)(jsx_runtime_1.Fragment, { children: [(0, jsx_runtime_1.jsxs)("div", { className: "viewnav-head", children: [(0, jsx_runtime_1.jsx)("span", { className: "viewnav-label", children: group === 'Yours' || group === 'World' ? 'Group' : 'Realm' }), (0, jsx_runtime_1.jsx)("h2", { children: group }), (0, jsx_runtime_1.jsx)("small", { children: "Selected operation" }), (0, jsx_runtime_1.jsx)("strong", { children: view.name }), (0, jsx_runtime_1.jsx)("button", { className: "btn ghost", onClick: () => { setSelected(null); navigate(null, 'open'); }, children: "\u2190 Operation Board" })] }), (0, jsx_runtime_1.jsxs)("nav", { className: "viewnav-section", "aria-label": `Other operations in ${group}`, children: [(0, jsx_runtime_1.jsxs)("span", { className: "viewnav-label", children: ["In ", group, " \u00B7 ", siblings.length] }), siblings.map((candidate) => ((0, jsx_runtime_1.jsxs)("button", { className: `viewsibling${candidate.name === view.name ? ' active' : ''}`, "aria-current": candidate.name === view.name ? 'page' : undefined, onClick: () => pick(candidate, pane), children: [(0, jsx_runtime_1.jsx)("strong", { children: candidate.name }), (0, jsx_runtime_1.jsxs)("small", { children: [Object.keys(candidate.params ?? {}).length, " parameter(s) \u00B7 ", candidate.materialized ? 'Materialized' : candidate.outputLabel ?? 'Tabular'] })] }, candidate.name)))] })] }));
    const saveControls = ((0, jsx_runtime_1.jsxs)(jsx_runtime_1.Fragment, { children: [saveNote && ((0, jsx_runtime_1.jsxs)("span", { className: `viewcypher-note${saveNote.tone ? ` ${saveNote.tone}` : ''}`, role: "status", children: [saveNote.text, saveNote.undo !== undefined && (0, jsx_runtime_1.jsxs)(jsx_runtime_1.Fragment, { children: [" \u00B7 ", (0, jsx_runtime_1.jsx)("button", { className: "viewlink", onClick: () => void undoSave(saveNote.undo ?? ''), children: "Undo" })] })] })), (0, jsx_runtime_1.jsx)("button", { className: `btn tiny${edited && !reason ? ' primary' : ''}`, disabled: !edited, title: reason ? 'This view is not yours to change, so your edits save as a new view' : undefined, onClick: () => void save(), children: reason ? 'Save as copy…' : 'Save' })] }));
    return ((0, jsx_runtime_1.jsxs)("div", { className: "kit-feature kit-feature-views viewspage viewspage-selected", children: [(0, jsx_runtime_1.jsx)("aside", { className: "panel viewspage-sidebar", "aria-label": `${group} operation navigator`, children: navigator() }), (0, jsx_runtime_1.jsxs)("details", { className: "panel viewspage-mobile-nav", children: [(0, jsx_runtime_1.jsx)("summary", { children: (0, jsx_runtime_1.jsxs)("span", { children: [(0, jsx_runtime_1.jsxs)("strong", { children: ["Browse ", group] }), (0, jsx_runtime_1.jsxs)("small", { children: [group, " \u00B7 ", view.name] })] }) }), (0, jsx_runtime_1.jsx)("div", { className: "viewspage-mobile-nav-body", children: navigator() })] }), (0, jsx_runtime_1.jsxs)("div", { className: "viewspage-operation", children: [(0, jsx_runtime_1.jsxs)("section", { className: "panel viewoperation-head", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsxs)("span", { className: "viewnav-label", children: [group, " \u00B7 operation"] }), (0, jsx_runtime_1.jsxs)("div", { className: "viewoperation-title", children: [(0, jsx_runtime_1.jsx)("h2", { children: view.name }), (0, jsx_runtime_1.jsx)(OriginChip, { view: view })] }), (0, jsx_runtime_1.jsxs)("span", { className: "viewnote", children: [Object.keys(params).length, " parameter(s) \u00B7 ", view.materialized ? 'Materialized — Run reads its cache' : view.outputLabel ?? 'Tabular'] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "row", children: [view.materialized && (0, jsx_runtime_1.jsx)("button", { className: "btn ghost", onClick: () => void refresh(view.name), children: "Refresh cache" }), (0, jsx_runtime_1.jsx)("button", { className: "btn", onClick: () => void openInStudio(), children: "Open in Query Studio" }), ownView && (0, jsx_runtime_1.jsx)("button", { className: "btn ghost", onClick: () => void remove(view.name), children: "Delete" })] }), view.description && (0, jsx_runtime_1.jsx)("p", { className: "hint", children: view.description })] }), (0, jsx_runtime_1.jsxs)("div", { className: "viewrunbar", children: [Object.keys(params).length === 0 ? (0, jsx_runtime_1.jsx)("span", { className: "hint", children: "No parameters." }) : Object.entries(params).map(([key, spec]) => ((0, jsx_runtime_1.jsxs)("label", { className: "paramrow", title: spec?.description, children: [(0, jsx_runtime_1.jsxs)("span", { className: "paramname", children: [key, " ", (0, jsx_runtime_1.jsx)("em", { children: spec?.type })] }), (0, jsx_runtime_1.jsx)("input", { value: args[key] ?? '', placeholder: spec?.default != null ? `default: ${spec.default}` : 'required', onChange: (event) => setArgs((current) => ({ ...current, [key]: event.target.value })), onKeyDown: (event) => { if (event.key === 'Enter')
                                            void run(); } })] }, key))), (0, jsx_runtime_1.jsxs)("div", { className: "row viewrunbar-actions", children: [(0, jsx_runtime_1.jsxs)("button", { className: "btn ghost viewcypher-toggle", "aria-expanded": editorSize !== 'closed', title: editorSize === 'closed' ? 'Show and edit the Cypher' : 'Close the Cypher editor', onClick: () => setEditorSize(editorSize === 'closed' ? 'mini' : 'closed'), children: ['{ }', " Cypher", edited ? ' •' : ''] }), (0, jsx_runtime_1.jsx)("button", { className: "btn primary", disabled: busy, onClick: () => void run(), children: busy ? 'running…' : 'Run' })] })] }), (0, jsx_runtime_1.jsxs)("div", { className: `viewoperation-body${editorSize === 'full' ? ' covered' : ''}`, children: [(0, jsx_runtime_1.jsx)("nav", { className: "viewoperation-nav", role: "tablist", "aria-label": "Operation sections", children: Object.keys(PANE_LABELS).map((name) => ((0, jsx_runtime_1.jsx)("button", { role: "tab", id: `viewtab-${name}`, "aria-controls": `viewpane-${name}`, "aria-selected": pane === name, "data-view-pane": name, className: `viewoperation-nav-link${pane === name ? ' active' : ''}`, onClick: () => showPane(name), children: paneLabel(name) }, name))) }), (0, jsx_runtime_1.jsxs)("section", { className: "viewpane viewpane-results", role: "tabpanel", id: "viewpane-results", "data-view-pane": "results", "aria-labelledby": "viewtab-results", hidden: pane !== 'results', children: [(0, jsx_runtime_1.jsx)("span", { "data-state": "view.ran", hidden: !ran }), (0, jsx_runtime_1.jsx)("div", { className: "viewpane-scroll view-results", tabIndex: 0, children: !ran ? (busy ? (0, jsx_runtime_1.jsx)("p", { className: "hint", children: "Running\u2026 Results will appear here." }) : status.tone === 'error' ? null : (0, jsx_runtime_1.jsx)("p", { className: "hint", children: "Nothing run yet." })) : rows.length === 0 ? (0, jsx_runtime_1.jsx)("p", { className: "hint", children: "No rows." }) : ((0, jsx_runtime_1.jsx)(chrome_tsx_1.RowTable, { rows: rows, columns: (0, rows_ts_1.rowColumns)(rows) })) }), (0, jsx_runtime_1.jsxs)("div", { className: "row results-foot", children: [ran && rows.length > 0 && (0, jsx_runtime_1.jsxs)(jsx_runtime_1.Fragment, { children: [(0, jsx_runtime_1.jsx)(chrome_tsx_1.CopyButton, { label: "Copy as Markdown", text: (0, rows_ts_1.rowsToMarkdown)(rows) }), (0, jsx_runtime_1.jsx)(chrome_tsx_1.CopyButton, { label: "Copy as CSV", text: (0, rows_ts_1.rowsToCsv)(rows) })] }), (0, jsx_runtime_1.jsx)(chrome_tsx_1.Status, { tone: status.tone, children: status.text })] })] }), (0, jsx_runtime_1.jsx)("section", { className: "viewpane", role: "tabpanel", id: "viewpane-schema", "data-view-pane": "schema", "aria-labelledby": "viewtab-schema", hidden: pane !== 'schema', children: (0, jsx_runtime_1.jsxs)("div", { className: "viewpane-scroll", children: [schema && (0, jsx_runtime_1.jsxs)("p", { className: "hint", children: [viewSchemaLabels.length, " labels used"] }), schemaError ? (0, jsx_runtime_1.jsx)(chrome_tsx_1.Status, { tone: "error", children: schemaError }) : schema == null ? (0, jsx_runtime_1.jsx)("p", { className: "hint", children: "loading\u2026" }) : viewSchemaLabels.length === 0 ? ((0, jsx_runtime_1.jsx)("p", { className: "hint", children: "No declared schema labels were found in this operation's query." })) : ((0, jsx_runtime_1.jsx)("div", { className: "viewschema", children: viewSchemaLabels.map((label) => ((0, jsx_runtime_1.jsxs)("article", { className: "viewschema-label", children: [(0, jsx_runtime_1.jsxs)("div", { className: "row", children: [(0, jsx_runtime_1.jsx)("strong", { children: label.label }), (0, jsx_runtime_1.jsx)("span", { className: "viewtag", children: label.anchor === false ? 'reach-only' : 'anchor' })] }), label.description && (0, jsx_runtime_1.jsx)("p", { children: label.description }), (0, jsx_runtime_1.jsxs)("small", { children: [label.realm ?? 'World', " \u00B7 ", label.sampleCount, " sampled"] }), label.properties.length > 0 && (0, jsx_runtime_1.jsx)("dl", { children: label.properties.map((property) => (0, jsx_runtime_1.jsxs)(react_1.default.Fragment, { children: [(0, jsx_runtime_1.jsx)("dt", { children: property.name }), (0, jsx_runtime_1.jsx)("dd", { children: property.type })] }, property.name)) })] }, label.label))) }))] }) }), (0, jsx_runtime_1.jsx)("section", { className: "viewpane", role: "tabpanel", id: "viewpane-watch", "data-view-pane": "watch", "aria-labelledby": "viewtab-watch", hidden: pane !== 'watch', children: (0, jsx_runtime_1.jsx)("div", { className: "viewpane-scroll", children: (0, jsx_runtime_1.jsx)(WatchPanel, { viewName: view.name, args: args, onWatchChange: (watching) => setWatchedViews((current) => {
                                            const next = new Set(current ?? []);
                                            watching ? next.add(view.name) : next.delete(view.name);
                                            return next;
                                        }), onWriteAgent: (signalType) => host.onCreateHandler({ signalType, view: view.name }) }, view.name) }) }), (0, jsx_runtime_1.jsx)(ViewCypherEditor_tsx_1.ViewCypherEditor, { ref: editorRef, size: editorSize, onSize: setEditorSize, onRun: () => void run(), onEdit: onEdit, edited: edited, saveControls: saveControls, onRevert: revert, underneath: paneLabel(pane) })] }), copying && reason && ((0, jsx_runtime_1.jsx)(SaveCopyDialog_tsx_1.SaveCopyDialog, { viewName: view.name, reason: reason, taken: new Set(list.map((candidate) => candidate.name)), onSave: saveCopy, onCancel: () => setCopying(false) }))] })] }));
}
/** Where this view comes from, which decides whether saving replaces it or makes a copy. */
function OriginChip({ view }) {
    if (view.source === USER_SAVED) {
        return (0, jsx_runtime_1.jsx)("span", { className: "viewtag viewtag-origin mine", title: "Saved in your world. Saving replaces it.", children: "Yours" });
    }
    if (view.source) {
        return ((0, jsx_runtime_1.jsxs)("span", { className: "viewtag viewtag-origin realm", title: `Ships with the ${view.source} realm. Your edits save as a copy in your world.`, children: [view.source, " realm"] }));
    }
    return (0, jsx_runtime_1.jsx)("span", { className: "viewtag viewtag-origin", title: "Ships with this world. Your edits save as a copy.", children: "World" });
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
function WatchPanel({ viewName, args, onWatchChange, onWriteAgent }) {
    const { services } = useViewsRuntime();
    const [watch, setWatch] = (0, react_1.useState)(null);
    const [loading, setLoading] = (0, react_1.useState)(true);
    const [problem, setProblem] = (0, react_1.useState)('');
    const [schedule, setSchedule] = (0, react_1.useState)(SCHEDULES[0][0]);
    const [busy, setBusy] = (0, react_1.useState)(false);
    const [status, setStatus] = (0, react_1.useState)({ tone: null, text: '' });
    const signalType = `view.${viewName}.changed`;
    const load = (0, react_1.useCallback)(async () => {
        setLoading(true);
        setProblem('');
        const r = await services.watches.list();
        setLoading(false);
        if (!r.ok)
            return setProblem((0, chrome_tsx_1.failureMessage)(r, 'list watches'));
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
            return setStatus({ tone: 'error', text: (0, chrome_tsx_1.failureMessage)(r, 'start watching this view') });
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
            return setStatus({ tone: 'error', text: (0, chrome_tsx_1.failureMessage)(r, 'stop this watch') });
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
            : { tone: 'error', text: (0, chrome_tsx_1.failureMessage)(r, 'run this watch') });
    }
    if (loading)
        return (0, jsx_runtime_1.jsx)(chrome_tsx_1.StudioPanel, { title: "Watch", children: (0, jsx_runtime_1.jsx)(chrome_tsx_1.Status, { tone: null, children: "Checking watches\u2026" }) });
    if (problem)
        return ((0, jsx_runtime_1.jsxs)(chrome_tsx_1.StudioPanel, { title: "Watch", children: [(0, jsx_runtime_1.jsx)(chrome_tsx_1.Status, { tone: "error", children: problem }), (0, jsx_runtime_1.jsx)("button", { className: "btn", onClick: () => void load(), children: "Retry watch listing" })] }));
    return ((0, jsx_runtime_1.jsxs)(chrome_tsx_1.StudioPanel, { title: "Watch", aside: watch ? (0, jsx_runtime_1.jsx)("span", { className: "stage watching", children: "watching" }) : undefined, children: [!watch ? ((0, jsx_runtime_1.jsxs)(jsx_runtime_1.Fragment, { children: [(0, jsx_runtime_1.jsxs)("p", { className: "hint", children: ["Run this view on a schedule, diff the answer, and publish ", (0, jsx_runtime_1.jsx)("code", { children: signalType }), " when it changes. The watch publishes a signal; it does not notify anyone by itself."] }), (0, jsx_runtime_1.jsxs)("div", { className: "row skillsource", children: [(0, jsx_runtime_1.jsx)("select", { value: schedule, "aria-label": "Watch schedule", onChange: (e) => setSchedule(e.target.value), children: SCHEDULES.map(([cron, says]) => (0, jsx_runtime_1.jsx)("option", { value: cron, children: says }, cron)) }), (0, jsx_runtime_1.jsx)("input", { value: schedule, onChange: (e) => setSchedule(e.target.value), "aria-label": "cron expression" }), (0, jsx_runtime_1.jsx)("button", { className: "btn", disabled: busy, onClick: () => void start(), children: "Watch this" })] }), (0, jsx_runtime_1.jsx)("p", { className: "hint", children: "Any arguments above are frozen into the watch \u2014 the same question, asked on a timer." })] })) : ((0, jsx_runtime_1.jsxs)(jsx_runtime_1.Fragment, { children: [(0, jsx_runtime_1.jsxs)("div", { className: "statline", children: [(0, jsx_runtime_1.jsx)("span", { children: "Change signal:\u00A0" }), (0, jsx_runtime_1.jsx)("strong", { children: (0, jsx_runtime_1.jsx)("code", { children: signalType }) })] }), (0, jsx_runtime_1.jsxs)("div", { className: "statline", children: [(0, jsx_runtime_1.jsx)("span", { children: "Schedule:\u00A0" }), (0, jsx_runtime_1.jsx)("strong", { children: watch.cron ?? 'not scheduled' })] }), (0, jsx_runtime_1.jsxs)("div", { className: "statline", children: [(0, jsx_runtime_1.jsx)("span", { children: "Delivery:\u00A0" }), (0, jsx_runtime_1.jsx)("strong", { children: !watch.delivery?.channel || watch.delivery.channel === 'none' ? 'none — notifies no one' : watch.delivery.channel })] }), (0, jsx_runtime_1.jsxs)("div", { className: "row studio-actions", children: [(0, jsx_runtime_1.jsx)("button", { className: "btn", disabled: busy, onClick: () => void runNow(), children: "Run it now" }), (0, jsx_runtime_1.jsx)("button", { className: "btn", onClick: () => onWriteAgent(signalType), children: "Write an agent for it" }), (0, jsx_runtime_1.jsx)("button", { className: "btn ghost", disabled: busy, onClick: () => void stop(), children: "Stop watching" })] }), (0, jsx_runtime_1.jsxs)("p", { className: "hint", children: ["This watch reruns on schedule and publishes ", (0, jsx_runtime_1.jsx)("code", { children: signalType }), " when rows change. Add a handler only if you want an automated response."] }), (0, jsx_runtime_1.jsx)("div", { className: "subhead", children: "Runs" }), (0, jsx_runtime_1.jsx)(WatchReceipts, { watchId: watch.id })] })), (0, jsx_runtime_1.jsx)(chrome_tsx_1.Status, { tone: status.tone, children: status.text })] }));
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
            return setProblem((0, chrome_tsx_1.failureMessage)(r, "list this watch's runs"));
        if (!c.ok)
            return setProblem((0, chrome_tsx_1.failureMessage)(c, "list this watch's changes"));
        if (!d.ok)
            return setProblem((0, chrome_tsx_1.failureMessage)(d, "list this watch's deliveries"));
        setProblem('');
        // Newest first: a receipt is read from the top, and the run somebody just triggered is the
        // one they are looking for.
        setRuns([...r.value].reverse());
        setDiffs(c.value);
        setDeliveries(d.value);
    }, [watchId, services]);
    (0, react_1.useEffect)(() => { void load(); }, [load]);
    if (problem)
        return (0, jsx_runtime_1.jsxs)(jsx_runtime_1.Fragment, { children: [(0, jsx_runtime_1.jsx)(chrome_tsx_1.Status, { tone: "error", children: problem }), (0, jsx_runtime_1.jsx)("button", { className: "btn ghost tiny", onClick: () => void load(), children: "Refresh receipts" })] });
    if (runs === null)
        return (0, jsx_runtime_1.jsx)("p", { className: "hint", children: "Reading this watch's history\u2026" });
    if (runs.length === 0) {
        return (0, jsx_runtime_1.jsxs)(jsx_runtime_1.Fragment, { children: [(0, jsx_runtime_1.jsxs)("p", { className: "hint", children: ["No runs listed yet. ", (0, jsx_runtime_1.jsx)("em", { children: "Run it now" }), " requests a run."] }), (0, jsx_runtime_1.jsx)("button", { className: "btn ghost tiny", onClick: () => void load(), children: "Refresh receipts" })] });
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
                return ((0, jsx_runtime_1.jsxs)("div", { className: "receipt", children: [(0, jsx_runtime_1.jsxs)("div", { className: "receipt-head", children: [(0, jsx_runtime_1.jsx)("span", { className: `stage ${run.errorCode ? 'acting' : changes.length ? 'watching' : 'proposed'}`, children: run.errorCode ? 'failed' : changes.length ? 'changed' : 'no recorded changes' }), (0, jsx_runtime_1.jsx)("strong", { children: whenShort(run.startedAt) }), (0, jsx_runtime_1.jsx)("small", { children: (run.status ?? '').toLowerCase() })] }), run.errorCode && (0, jsx_runtime_1.jsx)("p", { className: "receipt-line", children: run.errorCode }), changes.length > 0 && ((0, jsx_runtime_1.jsxs)("p", { className: "receipt-line", children: [counts.join(' · '), changes.slice(0, 3).map((c) => c.key).filter(Boolean).length > 0 &&
                                    ` — ${changes.slice(0, 3).map((c) => c.key).filter(Boolean).join(', ')}`, changes.length > 3 ? ` and ${changes.length - 3} more` : ''] })), delivered.length > 0 && ((0, jsx_runtime_1.jsx)("p", { className: "receipt-line receipt-delivery", children: delivered.map((d) => `Delivery to ${d.channel ?? 'an unspecified channel'} · ${(d.status ?? 'status unavailable').toLowerCase()}`).join(' · ') })), changes.length > 0 && delivered.length === 0 && ((0, jsx_runtime_1.jsx)("p", { className: "receipt-line hint", children: "No delivery receipt is available for this run." }))] }, run.id));
            }), (0, jsx_runtime_1.jsxs)("div", { className: "row", children: [(0, jsx_runtime_1.jsx)("button", { className: "btn ghost tiny", onClick: () => void load(), children: "Refresh receipts" }), runs.length > 8 && (0, jsx_runtime_1.jsxs)("span", { className: "hint", children: ["showing the last 8 of ", runs.length] })] })] }));
}
//# sourceMappingURL=SavedViewsSurface.js.map