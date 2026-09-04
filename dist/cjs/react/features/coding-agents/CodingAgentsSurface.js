"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CodingAgentsSurface = CodingAgentsSurface;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const chrome_tsx_1 = require("../studio/chrome.js");
const MODE_SAYS = {
    ASSISTANT: 'Your data and nothing else — the right default.',
    DEVELOPER: 'Also lets an agent install a realm and ask how to write one, and makes its orientation lead with realms rather than stay silent about them.',
};
const DEFAULT_MODES = ['ASSISTANT', 'DEVELOPER'];
function probeState(outcome) {
    if (!outcome.ok) {
        if (outcome.kind === 'unsupported')
            return 'noprobe';
        if (outcome.kind === 'unreachable')
            return 'down';
        return 'up';
    }
    const status = outcome.value.status;
    if (status == null)
        return 'noprobe';
    if (status === 0)
        return 'down';
    if (status === 401)
        return 'guarded';
    if (status >= 200 && status < 300)
        return 'open';
    return 'up';
}
function CodingAgentsSurface({ services, host, }) {
    const currentCredential = host.currentCredential();
    const [mcp, setMcp] = (0, react_1.useState)('probing');
    const [probeMessage, setProbeMessage] = (0, react_1.useState)('');
    const [mode, setMode] = (0, react_1.useState)('');
    const [modes, setModes] = (0, react_1.useState)([]);
    const [modeStatus, setModeStatus] = (0, react_1.useState)({
        tone: null,
        text: '',
    });
    const [changedMode, setChangedMode] = (0, react_1.useState)(false);
    const [authKind, setAuthKind] = (0, react_1.useState)(() => currentCredential?.kind ?? 'basic');
    const [token, setToken] = (0, react_1.useState)('');
    const [username, setUsername] = (0, react_1.useState)(() => currentCredential?.username ?? '');
    const [password, setPassword] = (0, react_1.useState)('');
    const [reveal, setReveal] = (0, react_1.useState)(false);
    const [baseUrl, setBaseUrl] = (0, react_1.useState)(host.initialBaseUrl ?? '');
    const load = (0, react_1.useCallback)(async () => {
        setMcp('probing');
        const [probe, modeConfig] = await Promise.all([
            services.probeMcp(),
            services.getMcpMode(),
        ]);
        setMcp(probeState(probe));
        setProbeMessage(probe.ok || probe.kind === 'unsupported' ? '' : (0, chrome_tsx_1.failureMessage)(probe, 'MCP status'));
        if (modeConfig.ok) {
            setMode(modeConfig.value.mode ?? '');
            setModes(modeConfig.value.modes ?? DEFAULT_MODES);
            setModeStatus({ tone: null, text: '' });
        }
        else {
            setModeStatus({ tone: 'error', text: (0, chrome_tsx_1.failureMessage)(modeConfig, 'MCP mode settings') });
        }
    }, [services]);
    (0, react_1.useEffect)(() => {
        void load();
    }, [load]);
    async function chooseMode(next) {
        setModeStatus({ tone: null, text: 'switching…' });
        const result = await services.setMcpMode(next);
        if (!result.ok) {
            setModeStatus({ tone: 'error', text: (0, chrome_tsx_1.failureMessage)(result, 'MCP mode settings') });
            return;
        }
        setMode(next);
        setChangedMode(true);
        setModeStatus({
            tone: 'ok',
            text: result.value.message ?? `switched to ${next.toLowerCase()} mode`,
        });
    }
    const url = baseUrl.trim().replace(/\/+$/, '');
    const suppliedCredential = currentCredential?.kind === authKind ? currentCredential : null;
    const typedCredential = authKind === 'bearer'
        ? token.trim() ? { kind: 'bearer', value: token.trim() } : null
        : username.trim() && password
            ? { kind: 'basic', username: username.trim(), value: password }
            : null;
    const credential = suppliedCredential ?? typedCredential;
    const haveCredential = credential !== null;
    const canRender = Boolean(url && credential);
    const renderConnection = (client) => {
        if (!credential || !url)
            return 'Enter an appliance URL and credential to build these instructions.';
        return host.renderConnection({ client, baseUrl: url, credential });
    };
    const mask = (text) => {
        if (reveal || !credential)
            return text;
        const withoutRawSecret = credential.value ? text.replaceAll(credential.value, '••••••••') : text;
        return withoutRawSecret.replace(/\b(Basic|Bearer)\s+[^\s"'`}]+/g, '$1 ••••••••');
    };
    const claudeConnection = renderConnection('claude');
    const codexConnection = renderConnection('codex');
    const endpointLamp = mcp === 'guarded' || mcp === 'open'
        ? 'lit'
        : mcp === 'down'
            ? 'alert'
            : 'unlit';
    return ((0, jsx_runtime_1.jsx)("div", { className: "kit-feature kit-feature-coding-agents agents", children: (0, jsx_runtime_1.jsxs)(chrome_tsx_1.StudioPanel, { title: "Coding agents", aside: (0, jsx_runtime_1.jsx)("button", { className: "btn ghost tiny", onClick: () => void load(), children: "Refresh" }), children: [(0, jsx_runtime_1.jsx)("p", { className: "hint", children: "Connect Claude Code or Codex through MCP so it can work with your documents, graph, and realms." }), (0, jsx_runtime_1.jsxs)("div", { className: "ladder", children: [(0, jsx_runtime_1.jsxs)("div", { className: "rung", children: [(0, jsx_runtime_1.jsx)("span", { className: `lamp lamp-${endpointLamp}` }), (0, jsx_runtime_1.jsxs)("div", { className: "rung-body", children: [(0, jsx_runtime_1.jsx)("strong", { children: "MCP connection" }), (0, jsx_runtime_1.jsx)("p", { className: "hint", children: mcp === 'guarded' ? 'Ready. An agent must authenticate before it can use your world.' :
                                                mcp === 'open' ? (0, jsx_runtime_1.jsxs)(jsx_runtime_1.Fragment, { children: ["Ready, but ", (0, jsx_runtime_1.jsx)("strong", { children: "unguarded" }), " \u2014 anything that can reach the appliance can use your world."] }) :
                                                    mcp === 'down' ? (probeMessage || 'The appliance could not be reached.') :
                                                        mcp === 'noprobe' ? 'Connection status is not available for this appliance.' :
                                                            mcp === 'probing' ? 'checking…' :
                                                                (probeMessage || 'The MCP service is responding.') })] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "rung", children: [(0, jsx_runtime_1.jsx)("span", { className: `lamp lamp-${mode ? 'lit' : 'unlit'}` }), (0, jsx_runtime_1.jsxs)("div", { className: "rung-body", children: [(0, jsx_runtime_1.jsx)("strong", { children: "What an agent may do" }), (0, jsx_runtime_1.jsx)("p", { className: "hint", children: MODE_SAYS[mode] ?? 'Pick what an agent connecting here is allowed to do.' }), (0, jsx_runtime_1.jsxs)("div", { className: "row", children: [(0, jsx_runtime_1.jsxs)("label", { className: "field", children: [(0, jsx_runtime_1.jsx)("span", { children: "Mode" }), (0, jsx_runtime_1.jsxs)("select", { value: mode, onChange: (event) => void chooseMode(event.target.value), children: [mode === '' && (0, jsx_runtime_1.jsx)("option", { value: "", children: "unknown" }), (modes.length ? modes : DEFAULT_MODES).map((availableMode) => ((0, jsx_runtime_1.jsx)("option", { value: availableMode, children: availableMode === 'ASSISTANT'
                                                                        ? 'Assistant — my data'
                                                                        : availableMode === 'DEVELOPER'
                                                                            ? 'Developer — also build realms'
                                                                            : availableMode }, availableMode)))] })] }), (0, jsx_runtime_1.jsx)(chrome_tsx_1.Status, { tone: modeStatus.tone, children: modeStatus.text })] }), changedMode && ((0, jsx_runtime_1.jsx)("p", { className: "hint", children: "This takes effect immediately. An agent that is already connected can try its call again." }))] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "rung", children: [(0, jsx_runtime_1.jsx)("span", { className: `lamp lamp-${canRender ? 'lit' : 'unlit'}` }), (0, jsx_runtime_1.jsxs)("div", { className: "rung-body", children: [(0, jsx_runtime_1.jsx)("strong", { children: "Point an agent at it" }), (0, jsx_runtime_1.jsx)("p", { className: "hint", children: "Build the connection instructions here, then copy them into your coding agent." }), (0, jsx_runtime_1.jsx)("div", { className: "row", children: (0, jsx_runtime_1.jsxs)("label", { className: "field grow", children: [(0, jsx_runtime_1.jsx)("span", { children: "Appliance URL an agent will reach" }), (0, jsx_runtime_1.jsx)("input", { value: baseUrl, placeholder: "https://your-appliance.example", onChange: (event) => setBaseUrl(event.target.value) })] }) }), (0, jsx_runtime_1.jsxs)("div", { className: "row authpick", children: [(0, jsx_runtime_1.jsx)("button", { className: `btn${authKind === 'basic' ? ' primary' : ' ghost'}`, onClick: () => setAuthKind('basic'), children: "Use my sign-in" }), (0, jsx_runtime_1.jsx)("button", { className: `btn${authKind === 'bearer' ? ' primary' : ' ghost'}`, onClick: () => setAuthKind('bearer'), children: "Use a bearer token" })] }), authKind === 'basic' ? ((0, jsx_runtime_1.jsxs)(jsx_runtime_1.Fragment, { children: [(0, jsx_runtime_1.jsxs)("p", { className: "hint", children: ["Use the username and password for the account the coding agent should act as.", suppliedCredential && ' The host has supplied your current credential.'] }), !suppliedCredential && ((0, jsx_runtime_1.jsxs)("div", { className: "row", children: [(0, jsx_runtime_1.jsxs)("label", { className: "field", children: [(0, jsx_runtime_1.jsx)("span", { children: "Username" }), (0, jsx_runtime_1.jsx)("input", { value: username, onChange: (event) => setUsername(event.target.value) })] }), (0, jsx_runtime_1.jsxs)("label", { className: "field", children: [(0, jsx_runtime_1.jsx)("span", { children: "Password" }), (0, jsx_runtime_1.jsx)("input", { type: "password", value: password, onChange: (event) => setPassword(event.target.value) })] })] })), (0, jsx_runtime_1.jsx)("p", { className: "hint", children: "The agent's configuration may contain this credential in a readable form. Anyone who can read that configuration can use the same account." })] })) : ((0, jsx_runtime_1.jsxs)(jsx_runtime_1.Fragment, { children: [suppliedCredential ? ((0, jsx_runtime_1.jsx)("p", { className: "hint", children: "The host has supplied your current bearer credential." })) : ((0, jsx_runtime_1.jsx)("div", { className: "row", children: (0, jsx_runtime_1.jsxs)("label", { className: "field grow", children: [(0, jsx_runtime_1.jsx)("span", { children: "Bearer token" }), (0, jsx_runtime_1.jsx)("input", { type: "password", value: token, placeholder: "Paste a token for this appliance", onChange: (event) => setToken(event.target.value) })] }) })), (0, jsx_runtime_1.jsx)("p", { className: "hint", children: "Use a bearer token created for the appliance when you do not want the agent to carry your sign-in." })] })), (0, jsx_runtime_1.jsxs)("p", { className: "hint", children: ["Credentials entered here stay in this page only long enough to build the instructions.", ' ', haveCredential && ((0, jsx_runtime_1.jsx)("button", { className: "status as-link", onClick: () => setReveal((value) => !value), children: reveal ? 'hide it' : 'show it' }))] }), (0, jsx_runtime_1.jsx)(Snippet, { label: "Claude Code", shown: mask(claudeConnection), copy: claudeConnection, disabled: !canRender }), (0, jsx_runtime_1.jsx)(Snippet, { label: "Codex", shown: mask(codexConnection), copy: codexConnection, disabled: !canRender })] })] })] })] }) }));
}
function Snippet({ label, shown, copy, disabled, }) {
    const [copied, setCopied] = (0, react_1.useState)(false);
    return ((0, jsx_runtime_1.jsxs)("div", { className: "snippet", children: [(0, jsx_runtime_1.jsxs)("div", { className: "snippet-head", children: [(0, jsx_runtime_1.jsx)("strong", { children: label }), (0, jsx_runtime_1.jsx)("button", { className: "btn ghost tiny", disabled: disabled, onClick: () => {
                            void navigator.clipboard?.writeText(copy);
                            setCopied(true);
                            setTimeout(() => setCopied(false), 1500);
                        }, children: copied ? 'Copied' : 'Copy' })] }), (0, jsx_runtime_1.jsx)("pre", { className: "cmd", children: shown })] }));
}
//# sourceMappingURL=CodingAgentsSurface.js.map