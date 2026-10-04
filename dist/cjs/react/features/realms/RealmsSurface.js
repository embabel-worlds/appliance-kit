"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RealmsSurface = RealmsSurface;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const outcome_ts_1 = require("../../../client/outcome.js");
const realmCatalog_ts_1 = require("../../../client/realmCatalog.js");
const chrome_tsx_1 = require("../studio/chrome.js");
function useLoadable(load, action) {
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
                : { data: null, error: (0, chrome_tsx_1.failureMessage)(outcome, action), loading: false });
        });
        return () => { active = false; };
    }, [load, version, action]);
    return (0, react_1.useMemo)(() => ({ ...state, reload: () => reload((value) => value + 1) }), [state]);
}
/** The GitHub account a realm URL lives under — the source worth one word on the row. */
function sourceOf(url, provider) {
    const m = url?.match(/github\.com\/([^/]+)\//);
    return m?.[1] ?? provider ?? null;
}
/** The appliance asking rather than refusing: `needs-confirmation` with the realm's own warning. */
const needsConfirmation = (outcome) => typeof outcome.body === 'object' && outcome.body !== null
    && outcome.body.status === 'needs-confirmation';
function Lamp({ tone }) {
    return (0, jsx_runtime_1.jsx)("span", { className: `lamp lamp-${tone}`, "aria-hidden": "true" });
}
// ── realms ────────────────────────────────────────────────────────────────────
function RealmsSurface({ services, host }) {
    /*
     * EVERY LIST HERE IS A QUERY over `(:Realm)` — see RealmCatalog. Installed and on offer are the
     * same rows with a different WHERE, and each facet below is another clause, so the list a person
     * filters and the answer chat gives to the same question come from one place.
     */
    const catalog = (0, react_1.useMemo)(() => new realmCatalog_ts_1.RealmCatalog((cypher, options) => services.searchRealms(cypher, options)), [services]);
    const installed = useLoadable((0, react_1.useCallback)(() => catalog.realms({ show: 'installed', experimental: true }), [catalog]), 'list installed realms');
    const [dirRefreshing, setDirRefreshing] = (0, react_1.useState)(false);
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
    /*
     * THE FACETS on what is on offer. Words are matched as typed, a moment after the last keystroke;
     * Smart search sets `meaning`, which a model judges per realm. A tag is one chip at a time.
     * Experimental realms are left out until asked for, and the count of what was left out is shown.
     */
    const [words, setWords] = (0, react_1.useState)('');
    (0, react_1.useEffect)(() => {
        const id = setTimeout(() => setWords(query.trim()), 250);
        return () => clearTimeout(id);
    }, [query]);
    const [meaning, setMeaning] = (0, react_1.useState)(null);
    const [tag, setTag] = (0, react_1.useState)('');
    const [showExperimental, setShowExperimental] = (0, react_1.useState)(false);
    const offerFilter = (0, react_1.useMemo)(() => ({
        show: 'available', tag, experimental: showExperimental, ...(meaning ? { meaning } : { words }),
    }), [tag, showExperimental, meaning, words]);
    const [offered, setOffered] = (0, react_1.useState)(null);
    const [offeredError, setOfferedError] = (0, react_1.useState)('');
    const [offeredLoading, setOfferedLoading] = (0, react_1.useState)(true);
    const [searchNote, setSearchNote] = (0, react_1.useState)(null);
    const [offerVersion, reloadOffered] = (0, react_1.useState)(0);
    (0, react_1.useEffect)(() => {
        let active = true;
        setOfferedLoading(true);
        void Promise.all([catalog.realms(offerFilter), catalog.tags(offerFilter), catalog.hiddenExperimental(offerFilter)])
            .then(([realms, tags, hidden]) => {
            if (!active)
                return;
            setOfferedLoading(false);
            if (!realms.ok) {
                if (meaning) {
                    /* Smart search failing is not the directory failing: fall back to the words. A run the
                       engine parked in the background has not failed, so it is not worth retrying. */
                    setSearchNote((0, realmCatalog_ts_1.ranInBackground)(realms)
                        ? { tone: 'caution', text: 'Smart search started a background run; its results are not available here. Showing keyword matches.' }
                        : { tone: 'error', text: 'Smart search did not return results. Showing keyword matches instead; try Smart search again.' });
                    setMeaning(null);
                    return;
                }
                setOfferedError((0, chrome_tsx_1.failureMessage)(realms, 'load the realm directory'));
                return;
            }
            setOfferedError('');
            setOffered({ realms: realms.value, tags: tags.ok ? tags.value : [], hidden: hidden.ok ? hidden.value : 0 });
        });
        return () => { active = false; };
    }, [catalog, offerFilter, meaning, offerVersion]);
    const refreshDirectory = (0, react_1.useCallback)(async () => {
        setDirRefreshing(true);
        await services.refreshDirectory();
        reloadOffered((v) => v + 1);
        installed.reload();
        setDirRefreshing(false);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [services, installed]);
    const searchByMeaning = (0, react_1.useCallback)(() => {
        const q = query.trim();
        if (!q)
            return;
        setSearchNote(null);
        setMeaning(q);
    }, [query]);
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
    const behindCount = (installed.data ?? []).filter((realm) => updates?.[realm.name] === true).length;
    const suggestions = offered?.realms ?? [];
    const installedShown = installed.data ?? [];
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
    async function install(s, confirmed = false) {
        const repo = s.source || s.url;
        if (!repo) {
            setInstallMsg(`Could not install '${s.name}': its directory entry has no repository link. Ask the directory maintainer to add one.`);
            return;
        }
        setBusy(s.name);
        const r = await services.installRealm(repo, confirmed);
        setBusy(null);
        /*
         * An experimental realm is not refused, it is ASKED about: the appliance answers
         * `needs-confirmation` with its author's warning, and a yes retries carrying it.
         */
        if (!r.ok && !confirmed && needsConfirmation(r)) {
            const yes = host.confirmInstall ? await host.confirmInstall(r.message) : confirm(r.message);
            if (yes)
                return install(s, true);
            setInstallMsg(`Not installed: ${s.name} is experimental, and that was declined.`);
            return;
        }
        setInstallMsg(r.ok ? `Installed ${s.name}.` : `Install failed: ${r.message}`);
        installed.reload();
        reloadOffered((v) => v + 1);
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
                installed.error ? (0, jsx_runtime_1.jsxs)(jsx_runtime_1.Fragment, { children: [(0, jsx_runtime_1.jsx)(chrome_tsx_1.Status, { tone: "error", children: installed.error }), (0, jsx_runtime_1.jsx)("button", { className: "btn", onClick: installed.reload, children: "Retry listing realms" })] }) : ((0, jsx_runtime_1.jsxs)(jsx_runtime_1.Fragment, { children: [(0, jsx_runtime_1.jsxs)("div", { className: "subhead subhead-row", children: [(0, jsx_runtime_1.jsxs)("span", { children: ["Installed \u00B7 ", installedShown.length] }), installedShown.length > 0 && (updates === null || behindCount > 0) && ((0, jsx_runtime_1.jsx)("button", { className: "btn ghost tiny", disabled: busy !== null, onClick: () => void refreshAll(), children: busy === '*' ? 'refreshing…'
                                        : behindCount > 0 ? `Update ${behindCount}` : 'Refresh all' }))] }), (0, jsx_runtime_1.jsxs)("div", { className: "realm-list", children: [installedShown.map((r) => ((0, jsx_runtime_1.jsxs)("div", { className: `realm-row ${expanded.has(r.name) ? 'is-open' : ''}`, children: [(0, jsx_runtime_1.jsxs)("button", { className: "realm-row-head", onClick: () => toggle(r.name), "aria-expanded": expanded.has(r.name), children: [(0, jsx_runtime_1.jsx)(Lamp, { tone: busy === r.name || busy === '*' ? 'caution' : 'lit' }), (0, jsx_runtime_1.jsx)("strong", { children: r.name }), " ", (0, jsx_runtime_1.jsxs)("code", { className: "ver", children: ["v", r.version] }), sourceOf(r.url) && (0, jsx_runtime_1.jsx)("small", { className: "realm-source", children: sourceOf(r.url) }), updates?.[r.name] === true && (0, jsx_runtime_1.jsx)("span", { className: "realm-behind", children: "update available" }), r.maturity === 'experimental' && (0, jsx_runtime_1.jsx)("span", { className: "realm-maturity", children: "experimental" }), (0, jsx_runtime_1.jsx)("span", { className: "realm-chevron", "aria-hidden": "true", children: expanded.has(r.name) ? '▾' : '▸' })] }), expanded.has(r.name) && ((0, jsx_runtime_1.jsxs)("div", { className: "realm-row-body", children: [rowMsg[r.name] && (0, jsx_runtime_1.jsx)("p", { className: "realm-problem", children: rowMsg[r.name] }), (0, jsx_runtime_1.jsx)("p", { children: r.description }), (realmTours[r.name] ?? []).map((tour) => ((0, jsx_runtime_1.jsxs)("button", { className: "btn tiny", title: "A guided walk through what this realm added \u2014 it says what it will do before it does any of it", onClick: () => host.openTour(tour.id), children: ["Take the tour: ", tour.name] }, tour.id))), canRefresh(r.name) && ((0, jsx_runtime_1.jsx)("button", { className: `btn tiny ${updates?.[r.name] === true ? '' : 'ghost'}`, disabled: busy !== null, title: updateDetail[r.name] ?? 'Pull the latest and rebuild the world', onClick: () => void refresh(r.name), children: busy === r.name ? 'refreshing…' : updates?.[r.name] === true ? 'Update' : 'Refresh' }))] }))] }, r.name))), (installed.data ?? []).length === 0 && (0, jsx_runtime_1.jsx)("div", { className: "notice", children: "No realms installed yet \u2014 pick one below." })] }), (0, jsx_runtime_1.jsxs)("div", { className: "subhead subhead-row", children: [(0, jsx_runtime_1.jsx)("span", { children: "Suggested" }), (0, jsx_runtime_1.jsx)("button", { className: "btn ghost tiny", disabled: dirRefreshing, onClick: () => void refreshDirectory(), children: dirRefreshing ? 'refreshing…' : offeredError ? 'Retry directory' : 'Refresh directory' })] }), (0, jsx_runtime_1.jsxs)("div", { className: "realmsearch", children: [(0, jsx_runtime_1.jsx)("input", { type: "search", value: query, placeholder: "Search available realms \u2014 Enter for smart search", "aria-label": "search available realms", onChange: (e) => { setQuery(e.target.value); setMeaning(null); }, onKeyDown: (e) => { if (e.key === 'Enter')
                                        searchByMeaning(); } }), query && ((0, jsx_runtime_1.jsx)("button", { className: "btn ghost tiny", disabled: offeredLoading && meaning !== null, onClick: searchByMeaning, title: "Understands what you're looking for, not just the words \u2014 'money owed' finds an accounting realm", children: offeredLoading && meaning !== null ? 'searching…' : 'Smart search' })), query && (0, jsx_runtime_1.jsx)("button", { className: "btn ghost tiny", onClick: () => { setQuery(''); setMeaning(null); }, children: "Clear" })] }), ((offered?.tags.length ?? 0) > 0 || (offered?.hidden ?? 0) > 0 || showExperimental) && ((0, jsx_runtime_1.jsxs)("div", { className: "realm-facets", role: "group", "aria-label": "Filter available realms", children: [tag && ((0, jsx_runtime_1.jsxs)("button", { className: "realm-facet is-on", "aria-pressed": "true", onClick: () => setTag(''), title: "Show every tag", children: [tag, " \u00D7"] })), !tag && (offered?.tags ?? []).map((t) => ((0, jsx_runtime_1.jsxs)("button", { className: "realm-facet", "aria-pressed": "false", onClick: () => setTag(t.tag), children: [t.tag, " ", (0, jsx_runtime_1.jsx)("span", { className: "realm-facet-count", children: t.realms })] }, t.tag))), ((offered?.hidden ?? 0) > 0 || showExperimental) && ((0, jsx_runtime_1.jsx)("button", { className: `realm-facet realm-facet-maturity ${showExperimental ? 'is-on' : ''}`, "aria-pressed": showExperimental, title: "Realms their own authors call experimental \u2014 they may change or break, and installing one asks you to confirm", onClick: () => setShowExperimental((v) => !v), children: showExperimental ? 'Hide experimental' : `Show ${offered?.hidden ?? 0} experimental` }))] })), meaning && !offeredLoading && ((0, jsx_runtime_1.jsxs)("div", { className: "notice", children: ["Smart search for \u201C", meaning, "\u201D \u00B7 ", suggestions.length, " match", suggestions.length === 1 ? '' : 'es', " \u2014 matched on what each realm does, not just its words. Asking in chat works the same way."] })), searchNote && (0, jsx_runtime_1.jsx)(chrome_tsx_1.Status, { tone: searchNote.tone, children: searchNote.text }), offeredError ? ((0, jsx_runtime_1.jsx)(chrome_tsx_1.Status, { tone: "error", children: offeredError })) : offered === null ? ((0, jsx_runtime_1.jsx)(chrome_tsx_1.Status, { tone: null, children: "Loading realm directory\u2026" })) : suggestions.length > 0 ? (
                        /* Suggested realms compress to ONE LINE each, like the installed list above: a
                           directory of dozens read as a wall of cards; a directory reads as an index. The
                           name expands to the description and tags; Install stays on the line. */
                        (0, jsx_runtime_1.jsx)("div", { className: "realm-list", children: suggestions.map((s) => {
                                const id = `s:${s.name}`;
                                const open = expanded.has(id);
                                return ((0, jsx_runtime_1.jsxs)("div", { className: `realm-row suggested-row ${open ? 'is-open' : ''}`, children: [(0, jsx_runtime_1.jsxs)("button", { className: "realm-row-head", onClick: () => toggle(id), "aria-expanded": open, children: [(0, jsx_runtime_1.jsx)(Lamp, { tone: "unlit" }), (0, jsx_runtime_1.jsx)("strong", { children: s.name }), s.version && (0, jsx_runtime_1.jsxs)("code", { className: "ver", children: ["v", s.version] }), sourceOf(s.url || s.source, s.provider) && ((0, jsx_runtime_1.jsx)("small", { className: "realm-source", children: sourceOf(s.url || s.source, s.provider) })), s.maturity === 'experimental' && (0, jsx_runtime_1.jsx)("span", { className: "realm-maturity", children: "experimental" }), (0, jsx_runtime_1.jsx)("span", { className: "realm-chevron", "aria-hidden": "true", children: open ? '▾' : '▸' })] }), (0, jsx_runtime_1.jsx)("button", { className: "btn tiny suggested-install", disabled: busy === s.name, onClick: () => void install(s), children: busy === s.name ? 'installing…' : 'Install' }), open && ((0, jsx_runtime_1.jsxs)("div", { className: "realm-row-body suggested-body", children: [(0, jsx_runtime_1.jsx)("p", { children: s.description }), (0, jsx_runtime_1.jsxs)("div", { className: "realm-meta", children: [(0, jsx_runtime_1.jsx)("span", { children: s.author || s.provider }), s.tags.map((t) => (0, jsx_runtime_1.jsx)("span", { className: "realm-tag", children: t }, t))] })] }))] }, id));
                            }) })) : ((0, jsx_runtime_1.jsx)("div", { className: "notice", children: query ? `No realm matches “${query}”.` : tag ? `No available realm is tagged ${tag}.` : 'Directory returned no further suggestions.' })), installMsg && (0, jsx_runtime_1.jsx)("div", { className: "notice", children: installMsg })] })) }) }));
}
//# sourceMappingURL=RealmsSurface.js.map