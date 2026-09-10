"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RealmsSurface = RealmsSurface;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const kg_ts_1 = require("../../../client/kg.js");
const outcome_ts_1 = require("../../../client/outcome.js");
const chrome_tsx_1 = require("../studio/chrome.js");
function useLoadable(load) {
    const [version, reload] = (0, react_1.useState)(0);
    const [state, setState] = (0, react_1.useState)({ data: null, error: '', loading: true });
    (0, react_1.useEffect)(() => {
        let active = true;
        setState((current) => ({ ...current, loading: true }));
        void load().then((outcome) => {
            if (!active)
                return;
            setState(outcome.ok
                ? { data: outcome.value, error: '', loading: false }
                : { data: null, error: outcome.message, loading: false });
        });
        return () => { active = false; };
    }, [load, version]);
    return (0, react_1.useMemo)(() => ({ ...state, reload: () => reload((value) => value + 1) }), [state]);
}
/** The GitHub account a realm URL lives under — the source worth one word on the row. */
function sourceOf(url, provider) {
    const m = url?.match(/github\.com\/([^/]+)\//);
    return m?.[1] ?? provider ?? null;
}
function Lamp({ tone }) {
    return (0, jsx_runtime_1.jsx)("span", { className: `lamp ${tone}`, "aria-hidden": "true" });
}
// ── realms ────────────────────────────────────────────────────────────────────
function RealmsSurface({ services, host }) {
    const installed = useLoadable((0, react_1.useCallback)(() => services.listInstalled(), [services]));
    const suggested = useLoadable((0, react_1.useCallback)(() => services.listDirectory(), [services]));
    const [dirRefreshing, setDirRefreshing] = (0, react_1.useState)(false);
    const refreshDirectory = (0, react_1.useCallback)(async () => {
        setDirRefreshing(true);
        await services.refreshDirectory();
        suggested.reload();
        setDirRefreshing(false);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [services, suggested]);
    const [busy, setBusy] = (0, react_1.useState)(null);
    const [installMsg, setInstallMsg] = (0, react_1.useState)(null);
    const [query, setQuery] = (0, react_1.useState)('');
    /* Installed realms render compressed — a known quantity earns one line; click expands. */
    const [expanded, setExpanded] = (0, react_1.useState)(new Set());
    const toggle = (name) => setExpanded((prev) => {
        const next = new Set(prev);
        if (next.has(name))
            next.delete(name);
        else
            next.add(name);
        return next;
    });
    /* Search-by-meaning: one Virtual Cypher run over the AvailableRealm door, the engine's
     * per-row judge deciding fit — the same query a user could type in Query Studio or ask in
     * chat. null = keyword mode; rows = the judged matches for `q`. */
    const [meaning, setMeaning] = (0, react_1.useState)(null);
    const [judging, setJudging] = (0, react_1.useState)(false);
    const searchByMeaning = (0, react_1.useCallback)(async () => {
        const q = query.trim();
        if (!q)
            return;
        setJudging(true);
        /* Bare alias, not r.description: the judge reads the whole row — name included — so a
         * realm with a thin manifest can still be found by what its name implies. */
        const cypher = "MATCH (d:RealmDirectory {scope:'all'})-[:OFFERS]->(r:AvailableRealm) " +
            `WHERE ai.relevant(r, '${q.replace(/'/g, "\\'")}') ` +
            'RETURN r.name AS name';
        const outcome = await services.searchRealms(cypher);
        setJudging(false);
        if (!(0, outcome_ts_1.isOk)(outcome) || (0, kg_ts_1.isBackgroundHandle)(outcome.value)) {
            setMeaning({ q, names: new Set() });
            return;
        }
        const names = new Set((outcome.value.rows ?? []).map((row) => String(row['name'] ?? '')));
        setMeaning({ q, names });
    }, [query, services]);
    /*
     * WHICH REALMS HAVE SOMETHING TO PULL. `GET /realms/updates` reads each realm's remote refs
     * (ls-remote — refs only, no objects) and says behind / current / unknown.
     *
     * Separate from the listing on purpose: it costs a network round trip per realm, so the panel
     * paints immediately and this fills in. `undefined` while it is in flight, `null` for a realm the
     * appliance could not determine — which keeps its Refresh, because hiding the only way to fix
     * something you cannot diagnose is the wrong side to err on.
     */
    const [updates, setUpdates] = (0, react_1.useState)(null);
    const [updateDetail, setUpdateDetail] = (0, react_1.useState)({});
    const checkUpdates = (0, react_1.useCallback)(async () => {
        const r = await services.listUpdates();
        // A 404 is an appliance older than the endpoint: leave `updates` null, which shows Refresh on
        // everything exactly as before rather than hiding it on an appliance that cannot answer.
        if (!r.ok)
            return;
        const behind = {};
        const detail = {};
        for (const x of r.value.results ?? []) {
            if (!x.name)
                continue;
            behind[x.name] = x.behind ?? null;
            if (x.detail)
                detail[x.name] = x.detail;
        }
        setUpdates(behind);
        setUpdateDetail(detail);
    }, [services]);
    (0, react_1.useEffect)(() => { void checkUpdates(); }, [checkUpdates]);
    /** Offer Refresh when the realm HAS moved, or when nobody can say. Never when it is current. */
    const canRefresh = (name) => updates === null || updates[name] !== false;
    const behindCount = updates ? Object.values(updates).filter((b) => b === true).length : 0;
    const installedNames = new Set((Array.isArray(installed.data) ? installed.data : []).map((r) => r.name));
    // Real shape (verified): { providers: [{ provider, realms: [{ name, description, source, url, installed }] }] }
    const rawSuggestions = (suggested.data?.providers ?? []).flatMap((p) => (p.realms ?? []).map((r) => ({ ...r, provider: p.provider })));
    const uninstalled = rawSuggestions.filter((s) => !s.installed && !installedNames.has(s.name ?? ''));
    /*
     * SEARCH, over the list already in hand.
     *
     * The directory endpoint returns every realm from every configured source in one call — thirty-odd
     * today — so filtering here answers on the keystroke rather than the round trip, and works while
     * the appliance is thinking about something else. `GET /directory/browse/realms` takes no query
     * parameter anyway; the Directory's own `search()` is reached only by the chat command.
     *
     * Name AND description, because "government" finds gov-au and gov-uk while "au" alone does not.
     * Every word must match somewhere, so a second word narrows instead of widening — the opposite of
     * the server's own any-word rule, and the one people expect from a filter box.
     */
    const words = query.toLowerCase().split(/\s+/).filter(Boolean);
    const tagsOf = (r) => Array.isArray(r.metadata?.tags) ? r.metadata.tags.map(String) : [];
    /* Name, description, tags, provider and author all count — "accounting" should find a realm
     * tagged accounting whose description never says the word. */
    const hits = (r) => words.every((w) => `${r.name ?? ''} ${r.description ?? ''} ${tagsOf(r).join(' ')} ${r.provider ?? ''} ${r.metadata?.author ?? ''}`
        .toLowerCase().includes(w));
    /* The search is for SHOPPING — it scopes to the uninstalled directory only. What is
     * already installed is a short known list, browsed, not searched. */
    /* Alphabetical, both lists: like the schema rail, a directory is a lookup, and lookups sort. */
    const byName = (a, b) => (a.name ?? '').localeCompare(b.name ?? '');
    const suggestions = (meaning
        ? uninstalled.filter((s) => meaning.names.has(s.name ?? ''))
        : uninstalled.filter(hits)).slice().sort(byName);
    const installedShown = (installed.data ?? []).slice().sort(byName);
    // Which realms ship a tour. One call, read for a label and a link — the Tours tab owns running
    // them, so nothing here knows what a step is.
    const [realmTours, setRealmTours] = (0, react_1.useState)({});
    /** Per-realm failure text, shown on the row that produced it. */
    const [rowMsg, setRowMsg] = (0, react_1.useState)({});
    (0, react_1.useEffect)(() => {
        void (async () => {
            const outcome = await services.listTours();
            if (!(0, outcome_ts_1.isOk)(outcome))
                return;
            const byRealm = {};
            for (const t of outcome.value) {
                const source = t.source;
                if (!source)
                    continue;
                const name = (t.presentation ?? {})['name'];
                byRealm[source] = [...(byRealm[source] ?? []), { id: t.id, name: typeof name === 'string' ? name : t.declaredId }];
            }
            setRealmTours(byRealm);
        })();
    }, [installed.data, services]);
    async function install(s) {
        const repo = s.source ?? s.repo ?? s.url ?? s.repository;
        if (!repo) {
            setInstallMsg(`No repo URL on suggestion '${s.name}' — shape mismatch worth fixing.`);
            return;
        }
        setBusy(s.name ?? repo);
        const r = await services.installRealm(repo);
        setBusy(null);
        setInstallMsg(r.ok ? `Installed ${s.name}.` : `Install failed: ${r.message}`);
        installed.reload();
    }
    /*
     * REFRESH — `git pull` on the checkout behind a realm, then a world rebuild.
     *
     * The appliance has done this all along (`POST /realms/{name}/update`, and `/update-all`); the Me
     * app has called it for a while and this console never did, which made a realm look frozen at
     * whatever it was when it was installed. It is not a cosmetic gap: the shared realm cache is keyed
     * `name@ref`, so a branch that has moved upstream is still a CACHE HIT — reinstalling does not
     * refresh it and neither does restarting the appliance. Pulling is the only way forward.
     *
     * The server's own summary is reported verbatim ("merge: Fast-forward, updates: 1"), because
     * "updated" alone cannot tell "brought forward two commits" from "already current" — and those
     * are the two things someone pressing this wants distinguished.
     */
    async function refresh(name) {
        setBusy(name);
        setInstallMsg(`Refreshing ${name}…`);
        setRowMsg((m) => ({ ...m, [name]: '' }));
        const r = await services.updateRealm(name);
        setBusy(null);
        const failure = r.ok ? '' : r.message;
        setInstallMsg(r.ok
            ? `${name}: ${r.value.summary ?? 'updated'}`
            : `Refresh failed: ${r.message}`);
        // AND ON THE ROW ITSELF. The page-level line is far below the realm list — on a world with a
        // few realms it is off the bottom of the screen entirely — so a failed update looked like
        // nothing happening at all: the row still says UPDATE AVAILABLE and the reason is somewhere
        // the user never scrolled to. A failure belongs where the button that caused it is.
        setRowMsg((m) => ({ ...m, [name]: failure }));
        installed.reload();
        void checkUpdates();
    }
    /* Real shape (read off RealmController.updateAllRealms): a LIST of
       `{name, status, summary}` — or `{name, status: 'error', message}`. Not a name→summary map,
       which is what it looks like from the outside and would have rendered every realm as blank. */
    async function refreshAll() {
        if (!(await host.confirmUpdateAll()))
            return;
        setBusy('*');
        setInstallMsg('Refreshing every realm…');
        const r = await services.updateAll();
        setBusy(null);
        if (!r.ok)
            return setInstallMsg(`Refresh failed: ${r.message}`);
        const results = r.value.results ?? [];
        const failed = results.filter((x) => x.status === 'error');
        // The failures first and in full: one realm that could not pull is the thing to act on, and a
        // list of thirty "Fast-forward" lines is where it would otherwise be lost.
        setInstallMsg(results.length === 0 ? 'No realms to refresh.'
            : failed.length ? `${failed.length} of ${results.length} failed — ${failed.map((x) => `${x.name}: ${x.message}`).join(' · ')}`
                : `${results.length} realm(s): ${results.map((x) => `${x.name} ${x.summary}`).join(' · ')}`);
        installed.reload();
        // What was behind may not be any more — ask again rather than leave a stale Update badge.
        void checkUpdates();
    }
    return ((0, jsx_runtime_1.jsx)("div", { className: "kit-feature kit-feature-realms", children: (0, jsx_runtime_1.jsx)(chrome_tsx_1.StudioPanel, { title: "Realms", aside: host.observability, children: installed.loading ? (0, jsx_runtime_1.jsx)("div", { className: "notice", children: "loading\u2026" }) :
                installed.error ? (0, jsx_runtime_1.jsx)(chrome_tsx_1.Status, { tone: "error", children: installed.error }) : ((0, jsx_runtime_1.jsxs)(jsx_runtime_1.Fragment, { children: [(0, jsx_runtime_1.jsxs)("div", { className: "subhead subhead-row", children: [(0, jsx_runtime_1.jsxs)("span", { children: ["Installed \u00B7 ", installedShown.length] }), (updates === null || behindCount > 0) && ((0, jsx_runtime_1.jsx)("button", { className: "btn ghost tiny", disabled: busy !== null, onClick: () => void refreshAll(), children: busy === '*' ? 'refreshing…'
                                        : behindCount > 0 ? `Update ${behindCount}` : 'Refresh all' }))] }), (0, jsx_runtime_1.jsxs)("div", { className: "realm-list", children: [installedShown.map((r) => ((0, jsx_runtime_1.jsxs)("div", { className: `realm-row ${expanded.has(r.name) ? 'is-open' : ''}`, children: [(0, jsx_runtime_1.jsxs)("button", { className: "realm-row-head", onClick: () => toggle(r.name), "aria-expanded": expanded.has(r.name), children: [(0, jsx_runtime_1.jsx)(Lamp, { tone: busy === r.name || busy === '*' ? 'caution' : 'lit' }), (0, jsx_runtime_1.jsx)("strong", { children: r.name }), " ", (0, jsx_runtime_1.jsxs)("code", { className: "ver", children: ["v", r.version] }), sourceOf(r.url) && (0, jsx_runtime_1.jsx)("small", { className: "realm-source", children: sourceOf(r.url) }), updates?.[r.name] === true && (0, jsx_runtime_1.jsx)("span", { className: "realm-behind", children: "update available" }), (0, jsx_runtime_1.jsx)("span", { className: "realm-chevron", "aria-hidden": "true", children: expanded.has(r.name) ? '▾' : '▸' })] }), expanded.has(r.name) && ((0, jsx_runtime_1.jsxs)("div", { className: "realm-row-body", children: [rowMsg[r.name] && (0, jsx_runtime_1.jsx)("p", { className: "realm-problem", children: rowMsg[r.name] }), (0, jsx_runtime_1.jsx)("p", { children: r.description }), (realmTours[r.name] ?? []).map((tour) => ((0, jsx_runtime_1.jsxs)("button", { className: "btn tiny", title: "A guided walk through what this realm added \u2014 it says what it will do before it does any of it", onClick: () => host.openTour(tour.id), children: ["Take the tour: ", tour.name] }, tour.id))), canRefresh(r.name) && ((0, jsx_runtime_1.jsx)("button", { className: `btn tiny ${updates?.[r.name] === true ? '' : 'ghost'}`, disabled: busy !== null, title: updateDetail[r.name] ?? 'Pull the latest and rebuild the world', onClick: () => void refresh(r.name), children: busy === r.name ? 'refreshing…' : updates?.[r.name] === true ? 'Update' : 'Refresh' }))] }))] }, r.name))), (installed.data ?? []).length === 0 && (0, jsx_runtime_1.jsx)("div", { className: "notice", children: "No realms installed yet \u2014 pick one below." })] }), (0, jsx_runtime_1.jsxs)("div", { className: "subhead subhead-row", children: [(0, jsx_runtime_1.jsx)("span", { children: "Suggested" }), (0, jsx_runtime_1.jsx)("button", { className: "btn ghost tiny", disabled: dirRefreshing, onClick: () => void refreshDirectory(), children: dirRefreshing ? 'refreshing…' : 'Refresh directory' })] }), (0, jsx_runtime_1.jsxs)("div", { className: "realmsearch", children: [(0, jsx_runtime_1.jsx)("input", { type: "search", value: query, placeholder: `Search ${uninstalled.length || ''} available realms — Enter for smart search`.replace('  ', ' '), "aria-label": "search available realms", onChange: (e) => { setQuery(e.target.value); setMeaning(null); }, onKeyDown: (e) => { if (e.key === 'Enter')
                                        void searchByMeaning(); } }), query && ((0, jsx_runtime_1.jsx)("button", { className: "btn ghost tiny", disabled: judging, onClick: () => void searchByMeaning(), title: "Understands what you're looking for, not just the words \u2014 'money owed' finds an accounting realm", children: judging ? 'searching…' : 'Smart search' })), query && (0, jsx_runtime_1.jsx)("button", { className: "btn ghost tiny", onClick: () => { setQuery(''); setMeaning(null); }, children: "Clear" })] }), meaning && ((0, jsx_runtime_1.jsxs)("div", { className: "notice", children: ["Smart search for \u201C", meaning.q, "\u201D \u00B7 ", meaning.names.size, " match", meaning.names.size === 1 ? '' : 'es', " \u2014 matched on what each realm does, not just its words. Asking in chat works the same way."] })), !suggested.loading && !suggested.error && suggestions.length > 0 ? (
                        /* Suggested realms compress to ONE LINE each, like the installed list above: a
                           directory of dozens read as a wall of cards; a directory reads as an index. The
                           name expands to the description and tags; Install stays on the line. */
                        (0, jsx_runtime_1.jsx)("div", { className: "realm-list", children: suggestions.map((s) => {
                                const id = `s:${s.name ?? s.repo ?? ''}`;
                                const open = expanded.has(id);
                                return ((0, jsx_runtime_1.jsxs)("div", { className: `realm-row suggested-row ${open ? 'is-open' : ''}`, children: [(0, jsx_runtime_1.jsxs)("button", { className: "realm-row-head", onClick: () => toggle(id), "aria-expanded": open, children: [(0, jsx_runtime_1.jsx)(Lamp, { tone: "unlit" }), (0, jsx_runtime_1.jsx)("strong", { children: s.name ?? s.repo }), s.metadata?.version && (0, jsx_runtime_1.jsxs)("code", { className: "ver", children: ["v", s.metadata.version] }), sourceOf(s.url ?? s.repository, s.provider) && ((0, jsx_runtime_1.jsx)("small", { className: "realm-source", children: sourceOf(s.url ?? s.repository, s.provider) })), (0, jsx_runtime_1.jsx)("span", { className: "realm-chevron", "aria-hidden": "true", children: open ? '▾' : '▸' })] }), (0, jsx_runtime_1.jsx)("button", { className: "btn tiny suggested-install", disabled: busy === s.name, onClick: () => install(s), children: busy === s.name ? 'installing…' : 'Install' }), open && ((0, jsx_runtime_1.jsxs)("div", { className: "realm-row-body suggested-body", children: [(0, jsx_runtime_1.jsx)("p", { children: s.description ?? s.repo ?? '' }), (0, jsx_runtime_1.jsxs)("div", { className: "realm-meta", children: [(0, jsx_runtime_1.jsx)("span", { children: s.metadata?.author || s.provider }), tagsOf(s).map((t) => (0, jsx_runtime_1.jsx)("span", { className: "realm-tag", children: t }, t))] })] }))] }, id));
                            }) })) : !suggested.loading && !suggested.error ? ((0, jsx_runtime_1.jsx)("div", { className: "notice", children: query ? `No realm matches “${query}”.` : 'Directory returned no further suggestions.' })) : ((0, jsx_runtime_1.jsxs)("div", { className: "notice", children: ["directory: ", suggested.loading ? 'loading…' : suggested.error] })), installMsg && (0, jsx_runtime_1.jsx)("div", { className: "notice", children: installMsg })] })) }) }));
}
//# sourceMappingURL=RealmsSurface.js.map