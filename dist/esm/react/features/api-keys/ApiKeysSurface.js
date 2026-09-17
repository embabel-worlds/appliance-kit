import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
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
import { useCallback, useEffect, useState } from 'react';
import { useFocusTrap } from "../../useFocusTrap.js";
import { CopyButton, Status, StudioPanel, failureMessage } from "../studio/chrome.js";
const NAME_LIMIT = 64;
const MASK = '••••••••••••••••';
/** A date the row can be read at a glance; the ISO text stays on the title for the exact moment. */
function when(iso) {
    if (!iso)
        return 'never';
    const date = new Date(iso);
    return Number.isNaN(date.getTime()) ? iso : date.toLocaleString();
}
export function ApiKeysSurface({ services, host }) {
    const [keys, setKeys] = useState([]);
    const [loaded, setLoaded] = useState(false);
    const [absent, setAbsent] = useState(false);
    const [problem, setProblem] = useState('');
    const [name, setName] = useState('');
    const [minting, setMinting] = useState(false);
    const [minted, setMinted] = useState(null);
    const [revoking, setRevoking] = useState(null);
    const load = useCallback(async () => {
        const result = await services.listKeys();
        setLoaded(true);
        if (!result.ok) {
            setAbsent(result.kind === 'unsupported');
            setProblem(failureMessage(result, 'list API keys'));
            return;
        }
        setAbsent(false);
        setProblem('');
        setKeys(result.value);
    }, [services]);
    useEffect(() => {
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
            setProblem(failureMessage(result, 'create an API key'));
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
            setProblem(failureMessage(result, 'revoke an API key'));
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
    return (_jsx("div", { className: "kit-feature kit-feature-api-keys apikeys", children: _jsxs(StudioPanel, { title: "API keys", aside: _jsx("button", { className: "btn ghost tiny", onClick: () => void load(), children: "Refresh" }), children: [_jsx("p", { className: "hint", children: "A key lets a script, a service or a coding agent call this appliance as you without carrying your password. Each one is named for what holds it and can be revoked on its own." }), absent ? (_jsx(Status, { tone: "caution", children: problem })) : (_jsxs(_Fragment, { children: [minted && _jsx(Minted, { minted: minted, onDismiss: () => setMinted(null) }), _jsxs("form", { className: "row", onSubmit: (event) => void mint(event), children: [_jsxs("label", { className: "field grow", children: [_jsx("span", { children: "What will hold this key" }), _jsx("input", { value: name, maxLength: NAME_LIMIT, placeholder: "deploy pipeline, Slack relay, laptop", onChange: (event) => setName(event.target.value) })] }), _jsx("button", { className: "btn primary inline-action", type: "submit", disabled: !name.trim() || minting, children: minting ? 'Creating…' : 'Create key' })] }), problem && _jsx(Status, { tone: "error", children: problem }), loaded && keys.length === 0 && !problem && (_jsx("p", { className: "hint", children: "No keys yet. The first one you create is shown once, here." })), keys.length > 0 && (_jsx("div", { className: "tablewrap", children: _jsxs("table", { className: "results-table keytable", children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { children: "Name" }), _jsx("th", { children: "Key" }), _jsx("th", { children: "Created" }), _jsx("th", { children: "Last used" }), _jsx("th", { "aria-label": "actions" })] }) }), _jsx("tbody", { children: keys.map((key) => (_jsxs("tr", { children: [_jsx("td", { children: key.name }), _jsx("td", { children: _jsxs("code", { children: [key.prefix, "\u2026"] }) }), _jsx("td", { title: key.createdAt, children: when(key.createdAt) }), _jsx("td", { title: key.lastUsedAt ?? undefined, children: when(key.lastUsedAt) }), _jsx("td", { children: _jsx("button", { className: "btn ghost tiny arm", disabled: revoking === key.id, onClick: () => void revoke(key), children: revoking === key.id ? 'Revoking…' : 'Revoke' }) })] }, key.id))) })] }) })), _jsxs("div", { className: "snippet", children: [_jsxs("div", { className: "snippet-head", children: [_jsx("strong", { children: "Using a key" }), _jsx(CopyButton, { label: "Copy", text: example })] }), _jsx("pre", { className: "cmd", children: example }), _jsxs("p", { className: "hint", children: ["Send it in the ", _jsx("code", { children: "X-Embabel-Api-Key" }), " header, or as", ' ', _jsx("code", { children: "Authorization: Bearer" }), " for a client that can only set that one. Keep it in an environment variable or a secrets store, never in a URL and never in a repository."] })] })] }))] }) }));
}
/*
 * The only rendering of a whole key, anywhere. Focus is trapped so the keyboard cannot wander
 * off before the person has decided what to do with it, and the secret leaves React state with
 * the panel — there is no "show it again", because the appliance could not honour one.
 */
function Minted({ minted, onDismiss }) {
    const [reveal, setReveal] = useState(false);
    const trap = useFocusTrap(true);
    return (_jsxs("div", { className: "keyreveal", role: "dialog", "aria-label": `API key ${minted.name}`, ref: trap, children: [_jsxs("strong", { children: ["Your new key, \u201C", minted.name, "\u201D"] }), _jsx("p", { className: "hint", children: "Copy it now. It will not be shown again \u2014 the appliance keeps only a hash \u2014 so put it straight into the environment variable or secrets store of whatever will use it." }), _jsx("pre", { className: "cmd keyvalue", "aria-live": "polite", children: reveal ? minted.key : `${minted.prefix}${MASK}` }), _jsxs("div", { className: "row", children: [_jsx(CopyButton, { label: "Copy key", text: minted.key }), _jsx("button", { className: "btn ghost", onClick: () => setReveal((value) => !value), children: reveal ? 'Hide it' : 'Show it' }), _jsx("button", { className: "btn ghost", onClick: onDismiss, children: "Done, I have copied it" })] })] }));
}
//# sourceMappingURL=ApiKeysSurface.js.map