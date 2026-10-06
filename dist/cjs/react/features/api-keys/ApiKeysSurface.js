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
/** What a key can do, in the words the form used when it was created. */
function access(key) {
    if (!key.agents)
        return 'Full access';
    return key.agents.includes('*') ? 'All agents' : `Agents: ${key.agents.join(', ')}`;
}
/** The kit's own frame: a titled panel with the actions beside the title. */
function StudioFrame({ title, actions, children }) {
    return (0, jsx_runtime_1.jsx)(chrome_tsx_1.StudioPanel, { title: title, aside: actions, children: children });
}
function ApiKeysSurface({ services, host, frame = StudioFrame }) {
    const [keys, setKeys] = (0, react_1.useState)([]);
    const [loaded, setLoaded] = (0, react_1.useState)(false);
    const [absent, setAbsent] = (0, react_1.useState)(false);
    const [problem, setProblem] = (0, react_1.useState)('');
    const [name, setName] = (0, react_1.useState)('');
    const [minting, setMinting] = (0, react_1.useState)(false);
    const [minted, setMinted] = (0, react_1.useState)(null);
    const [revoking, setRevoking] = (0, react_1.useState)(null);
    // What the key is for: everything its owner can do, or only talking to agents.
    const [forAgents, setForAgents] = (0, react_1.useState)(false);
    const [agents, setAgents] = (0, react_1.useState)('*');
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
        const named = agents.split(',').map((a) => a.trim()).filter(Boolean);
        if (forAgents && named.length === 0)
            return;
        setMinting(true);
        const result = await services.mintKey(trimmed, forAgents ? named : undefined);
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
    // An agent key goes into a chat client, which wants a base URL and a key and names the agent as the model.
    const agentExample = [
        `Base URL: ${baseUrl}/api/v1/openai/v1`,
        `API key:  emb_…`,
        `Model:    the agent's name, e.g. jonathon`,
    ].join('\n');
    return ((0, jsx_runtime_1.jsx)("div", { className: "kit-feature kit-feature-api-keys apikeys", children: frame({
            title: 'API keys',
            actions: (0, jsx_runtime_1.jsx)("button", { className: "btn ghost tiny", onClick: () => void load(), children: "Refresh" }),
            refresh: () => void load(),
            children: (0, jsx_runtime_1.jsxs)(jsx_runtime_1.Fragment, { children: [(0, jsx_runtime_1.jsx)("p", { className: "hint", children: "An API key lets a program sign in to this appliance as you, without your password. Create one key for each program, so you can switch one off without affecting the others." }), (0, jsx_runtime_1.jsxs)("ol", { className: "hint keysteps", children: [(0, jsx_runtime_1.jsx)("li", { children: "Name the key after the program that will use it." }), (0, jsx_runtime_1.jsx)("li", { children: "Choose its access: full access does everything you can, agents only can just chat with agents." }), (0, jsx_runtime_1.jsx)("li", { children: "Create the key and copy it straight away. It is shown once." }), (0, jsx_runtime_1.jsx)("li", { children: "Paste it into the program. The examples at the bottom show where." })] }), absent ? ((0, jsx_runtime_1.jsx)(chrome_tsx_1.Status, { tone: "caution", children: problem })) : ((0, jsx_runtime_1.jsxs)(jsx_runtime_1.Fragment, { children: [minted && (0, jsx_runtime_1.jsx)(Minted, { minted: minted, onDismiss: () => setMinted(null) }), (0, jsx_runtime_1.jsxs)("form", { className: "row", onSubmit: (event) => void mint(event), children: [(0, jsx_runtime_1.jsxs)("label", { className: "field grow", children: [(0, jsx_runtime_1.jsx)("span", { children: "Name" }), (0, jsx_runtime_1.jsx)("input", { value: name, maxLength: NAME_LIMIT, placeholder: "e.g. Open WebUI, deploy script", onChange: (event) => setName(event.target.value) })] }), (0, jsx_runtime_1.jsxs)("label", { className: "field", children: [(0, jsx_runtime_1.jsx)("span", { children: "Access" }), (0, jsx_runtime_1.jsxs)("select", { value: forAgents ? 'agents' : 'all', onChange: (event) => setForAgents(event.target.value === 'agents'), children: [(0, jsx_runtime_1.jsx)("option", { value: "all", children: "Full access" }), (0, jsx_runtime_1.jsx)("option", { value: "agents", children: "Agents only" })] })] }), forAgents && ((0, jsx_runtime_1.jsxs)("label", { className: "field", children: [(0, jsx_runtime_1.jsx)("span", { children: "Which agents" }), (0, jsx_runtime_1.jsx)("input", { value: agents, placeholder: "names separated by commas, or * for all", onChange: (event) => setAgents(event.target.value) })] })), (0, jsx_runtime_1.jsx)("button", { className: "btn primary inline-action", type: "submit", disabled: !name.trim() || minting, children: minting ? 'Creating…' : 'Create key' })] }), problem && (0, jsx_runtime_1.jsx)(chrome_tsx_1.Status, { tone: "error", children: problem }), loaded && keys.length === 0 && !problem && ((0, jsx_runtime_1.jsx)("p", { className: "hint", children: "No keys yet." })), keys.length > 0 && ((0, jsx_runtime_1.jsx)("div", { className: "tablewrap", children: (0, jsx_runtime_1.jsxs)("table", { className: "results-table keytable", children: [(0, jsx_runtime_1.jsx)("thead", { children: (0, jsx_runtime_1.jsxs)("tr", { children: [(0, jsx_runtime_1.jsx)("th", { children: "Name" }), (0, jsx_runtime_1.jsx)("th", { children: "Key" }), (0, jsx_runtime_1.jsx)("th", { children: "Access" }), (0, jsx_runtime_1.jsx)("th", { children: "Created" }), (0, jsx_runtime_1.jsx)("th", { children: "Last used" }), (0, jsx_runtime_1.jsx)("th", { "aria-label": "actions" })] }) }), (0, jsx_runtime_1.jsx)("tbody", { children: keys.map((key) => ((0, jsx_runtime_1.jsxs)("tr", { children: [(0, jsx_runtime_1.jsx)("td", { children: key.name }), (0, jsx_runtime_1.jsx)("td", { children: (0, jsx_runtime_1.jsxs)("code", { children: [key.prefix, "\u2026"] }) }), (0, jsx_runtime_1.jsx)("td", { children: access(key) }), (0, jsx_runtime_1.jsx)("td", { title: key.createdAt, children: when(key.createdAt) }), (0, jsx_runtime_1.jsx)("td", { title: key.lastUsedAt ?? undefined, children: when(key.lastUsedAt) }), (0, jsx_runtime_1.jsx)("td", { children: (0, jsx_runtime_1.jsx)("button", { className: "btn ghost tiny arm", disabled: revoking === key.id, onClick: () => void revoke(key), children: revoking === key.id ? 'Revoking…' : 'Revoke' }) })] }, key.id))) })] }) })), (0, jsx_runtime_1.jsxs)("div", { className: "snippet", children: [(0, jsx_runtime_1.jsxs)("div", { className: "snippet-head", children: [(0, jsx_runtime_1.jsx)("strong", { children: "Full access key: scripts and services" }), (0, jsx_runtime_1.jsx)(chrome_tsx_1.CopyButton, { label: "Copy", text: example })] }), (0, jsx_runtime_1.jsx)("pre", { className: "cmd", children: example }), (0, jsx_runtime_1.jsxs)("p", { className: "hint", children: ["Send the key in the ", (0, jsx_runtime_1.jsx)("code", { children: "X-Embabel-Api-Key" }), " header. If a program can only set ", (0, jsx_runtime_1.jsx)("code", { children: "Authorization" }), ", use ", (0, jsx_runtime_1.jsx)("code", { children: "Authorization: Bearer" }), " followed by the key."] }), (0, jsx_runtime_1.jsxs)("div", { className: "snippet-head", children: [(0, jsx_runtime_1.jsx)("strong", { children: "Agents-only key: chat clients such as Open WebUI or LibreChat" }), (0, jsx_runtime_1.jsx)(chrome_tsx_1.CopyButton, { label: "Copy", text: agentExample })] }), (0, jsx_runtime_1.jsx)("pre", { className: "cmd", children: agentExample }), (0, jsx_runtime_1.jsx)("p", { className: "hint", children: "Enter these in the chat client's connection settings. The model is the name of the agent you want to talk to." }), (0, jsx_runtime_1.jsx)("p", { className: "hint", children: "Keep a key in an environment variable or a secrets store, never in a URL or a repository. If a key leaks, revoke it here and create a new one." })] })] }))] }),
        }) }));
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