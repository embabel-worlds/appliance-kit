"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApiKeysSurface = ApiKeysSurface;
const jsx_runtime_1 = require("react/jsx-runtime");
/*
 * API KEYS — a credential that is not a person's password.
 *
 * The appliance's REST and MCP doors have always taken the account's own sign-in, which is the
 * wrong thing to paste into a service's configuration: it is the whole account, it cannot be
 * revoked without changing the password, and nothing records that it was used. A key is minted
 * for one purpose, named for it, shown ONCE, and revoked on its own.
 *
 * The house rule for secrets applies with more force than usual here, because this is the only
 * screen that ever holds the whole key: masked on screen, whole on the clipboard, gone from
 * state the moment the panel is dismissed. The list below it shows a prefix and nothing more —
 * the appliance keeps a hash, so there is nothing it COULD show, and that is the point.
 */
const react_1 = require("react");
const useFocusTrap_ts_1 = require("../../useFocusTrap.js");
const chrome_tsx_1 = require("../studio/chrome.js");
const NAME_LIMIT = 64;
const MASK = '••••••••••••••••';
/** A date the row can be read at a glance; the ISO text stays on the title for the exact moment. */
function when(iso) {
    if (!iso)
        return 'never';
    const date = new Date(iso);
    return Number.isNaN(date.getTime()) ? iso : date.toLocaleString();
}
function ApiKeysSurface({ services, host }) {
    const [keys, setKeys] = (0, react_1.useState)([]);
    const [loaded, setLoaded] = (0, react_1.useState)(false);
    const [absent, setAbsent] = (0, react_1.useState)(false);
    const [problem, setProblem] = (0, react_1.useState)('');
    const [name, setName] = (0, react_1.useState)('');
    const [minting, setMinting] = (0, react_1.useState)(false);
    const [minted, setMinted] = (0, react_1.useState)(null);
    const [revoking, setRevoking] = (0, react_1.useState)(null);
    const load = (0, react_1.useCallback)(async () => {
        const result = await services.listKeys();
        setLoaded(true);
        if (!result.ok) {
            setAbsent(result.kind === 'unsupported');
            setProblem((0, chrome_tsx_1.failureMessage)(result, 'list API keys'));
            return;
        }
        setAbsent(false);
        setProblem('');
        setKeys(result.value);
    }, [services]);
    (0, react_1.useEffect)(() => {
        void load();
    }, [load]);
    async function mint(event) {
        event.preventDefault();
        const trimmed = name.trim();
        if (!trimmed || minting)
            return;
        setMinting(true);
        const result = await services.mintKey(trimmed);
        setMinting(false);
        if (!result.ok) {
            setProblem((0, chrome_tsx_1.failureMessage)(result, 'create an API key'));
            return;
        }
        setProblem('');
        setName('');
        setMinted(result.value);
        await load();
    }
    async function revoke(key) {
        if (!(await host.confirmRevoke(key)))
            return;
        setRevoking(key.id);
        const result = await services.revokeKey(key.id);
        setRevoking(null);
        if (!result.ok) {
            setProblem((0, chrome_tsx_1.failureMessage)(result, 'revoke an API key'));
            return;
        }
        setProblem('');
        await load();
    }
    const baseUrl = (host.initialBaseUrl ?? '').trim().replace(/\/+$/, '') || 'https://your-appliance.example';
    const example = [
        `export EMBABEL_API_KEY=emb_…`,
        `curl -H "X-Embabel-Api-Key: $EMBABEL_API_KEY" ${baseUrl}/api/v1/watches`,
    ].join('\n');
    return ((0, jsx_runtime_1.jsx)("div", { className: "kit-feature kit-feature-api-keys apikeys", children: (0, jsx_runtime_1.jsxs)(chrome_tsx_1.StudioPanel, { title: "API keys", aside: (0, jsx_runtime_1.jsx)("button", { className: "btn ghost tiny", onClick: () => void load(), children: "Refresh" }), children: [(0, jsx_runtime_1.jsx)("p", { className: "hint", children: "A key lets a script, a service or a coding agent call this appliance as you without carrying your password. Each one is named for what holds it and can be revoked on its own." }), absent ? ((0, jsx_runtime_1.jsx)(chrome_tsx_1.Status, { tone: "caution", children: problem })) : ((0, jsx_runtime_1.jsxs)(jsx_runtime_1.Fragment, { children: [minted && (0, jsx_runtime_1.jsx)(Minted, { minted: minted, onDismiss: () => setMinted(null) }), (0, jsx_runtime_1.jsxs)("form", { className: "row", onSubmit: (event) => void mint(event), children: [(0, jsx_runtime_1.jsxs)("label", { className: "field grow", children: [(0, jsx_runtime_1.jsx)("span", { children: "What will hold this key" }), (0, jsx_runtime_1.jsx)("input", { value: name, maxLength: NAME_LIMIT, placeholder: "deploy pipeline, Slack relay, laptop", onChange: (event) => setName(event.target.value) })] }), (0, jsx_runtime_1.jsx)("button", { className: "btn primary inline-action", type: "submit", disabled: !name.trim() || minting, children: minting ? 'Creating…' : 'Create key' })] }), problem && (0, jsx_runtime_1.jsx)(chrome_tsx_1.Status, { tone: "error", children: problem }), loaded && keys.length === 0 && !problem && ((0, jsx_runtime_1.jsx)("p", { className: "hint", children: "No keys yet. The first one you create is shown once, here." })), keys.length > 0 && ((0, jsx_runtime_1.jsx)("div", { className: "tablewrap", children: (0, jsx_runtime_1.jsxs)("table", { className: "results-table keytable", children: [(0, jsx_runtime_1.jsx)("thead", { children: (0, jsx_runtime_1.jsxs)("tr", { children: [(0, jsx_runtime_1.jsx)("th", { children: "Name" }), (0, jsx_runtime_1.jsx)("th", { children: "Key" }), (0, jsx_runtime_1.jsx)("th", { children: "Created" }), (0, jsx_runtime_1.jsx)("th", { children: "Last used" }), (0, jsx_runtime_1.jsx)("th", { "aria-label": "actions" })] }) }), (0, jsx_runtime_1.jsx)("tbody", { children: keys.map((key) => ((0, jsx_runtime_1.jsxs)("tr", { children: [(0, jsx_runtime_1.jsx)("td", { children: key.name }), (0, jsx_runtime_1.jsx)("td", { children: (0, jsx_runtime_1.jsxs)("code", { children: [key.prefix, "\u2026"] }) }), (0, jsx_runtime_1.jsx)("td", { title: key.createdAt, children: when(key.createdAt) }), (0, jsx_runtime_1.jsx)("td", { title: key.lastUsedAt ?? undefined, children: when(key.lastUsedAt) }), (0, jsx_runtime_1.jsx)("td", { children: (0, jsx_runtime_1.jsx)("button", { className: "btn ghost tiny arm", disabled: revoking === key.id, onClick: () => void revoke(key), children: revoking === key.id ? 'Revoking…' : 'Revoke' }) })] }, key.id))) })] }) })), (0, jsx_runtime_1.jsxs)("div", { className: "snippet", children: [(0, jsx_runtime_1.jsxs)("div", { className: "snippet-head", children: [(0, jsx_runtime_1.jsx)("strong", { children: "Using a key" }), (0, jsx_runtime_1.jsx)(chrome_tsx_1.CopyButton, { label: "Copy", text: example })] }), (0, jsx_runtime_1.jsx)("pre", { className: "cmd", children: example }), (0, jsx_runtime_1.jsxs)("p", { className: "hint", children: ["Send it in the ", (0, jsx_runtime_1.jsx)("code", { children: "X-Embabel-Api-Key" }), " header, or as", ' ', (0, jsx_runtime_1.jsx)("code", { children: "Authorization: Bearer" }), " for a client that can only set that one. Keep it in an environment variable or a secrets store, never in a URL and never in a repository."] })] })] }))] }) }));
}
/*
 * The only rendering of a whole key, anywhere. Focus is trapped so the keyboard cannot wander
 * off before the person has decided what to do with it, and the secret leaves React state with
 * the panel — there is no "show it again", because the appliance could not honour one.
 */
function Minted({ minted, onDismiss }) {
    const [reveal, setReveal] = (0, react_1.useState)(false);
    const trap = (0, useFocusTrap_ts_1.useFocusTrap)(true);
    return ((0, jsx_runtime_1.jsxs)("div", { className: "keyreveal", role: "dialog", "aria-label": `API key ${minted.name}`, ref: trap, children: [(0, jsx_runtime_1.jsxs)("strong", { children: ["Your new key, \u201C", minted.name, "\u201D"] }), (0, jsx_runtime_1.jsx)("p", { className: "hint", children: "Copy it now. It will not be shown again \u2014 the appliance keeps only a hash \u2014 so put it straight into the environment variable or secrets store of whatever will use it." }), (0, jsx_runtime_1.jsx)("pre", { className: "cmd keyvalue", "aria-live": "polite", children: reveal ? minted.key : `${minted.prefix}${MASK}` }), (0, jsx_runtime_1.jsxs)("div", { className: "row", children: [(0, jsx_runtime_1.jsx)(chrome_tsx_1.CopyButton, { label: "Copy key", text: minted.key }), (0, jsx_runtime_1.jsx)("button", { className: "btn ghost", onClick: () => setReveal((value) => !value), children: reveal ? 'Hide it' : 'Show it' }), (0, jsx_runtime_1.jsx)("button", { className: "btn ghost", onClick: onDismiss, children: "Done, I have copied it" })] })] }));
}
//# sourceMappingURL=ApiKeysSurface.js.map