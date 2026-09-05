import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
import { useCallback, useEffect, useState } from 'react';
import { Status, StudioPanel, failureMessage } from "../studio/chrome.js";
const MODE_SAYS = {
    ASSISTANT: 'Access this account’s data.',
    DEVELOPER: 'Access data, install realms, and get guidance for building realms.',
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
export function CodingAgentsSurface({ services, host, }) {
    const currentCredential = host.currentCredential();
    const [mcp, setMcp] = useState('probing');
    const [probeMessage, setProbeMessage] = useState('');
    const [mode, setMode] = useState('');
    const [modes, setModes] = useState([]);
    const [modeStatus, setModeStatus] = useState({
        tone: null,
        text: '',
    });
    const [changedMode, setChangedMode] = useState(false);
    const [authKind, setAuthKind] = useState(() => currentCredential?.kind ?? 'basic');
    const [token, setToken] = useState('');
    const [username, setUsername] = useState(() => currentCredential?.username ?? '');
    const [password, setPassword] = useState('');
    const [reveal, setReveal] = useState(false);
    const [baseUrl, setBaseUrl] = useState(host.initialBaseUrl ?? '');
    const load = useCallback(async () => {
        setMcp('probing');
        const [probe, modeConfig] = await Promise.all([
            services.probeMcp(),
            services.getMcpMode(),
        ]);
        setMcp(probeState(probe));
        setProbeMessage(probe.ok || probe.kind === 'unsupported' ? '' : failureMessage(probe, 'MCP status'));
        if (modeConfig.ok) {
            setMode(modeConfig.value.mode ?? '');
            setModes(modeConfig.value.modes ?? DEFAULT_MODES);
            setModeStatus({ tone: null, text: '' });
        }
        else {
            setModeStatus({ tone: 'error', text: failureMessage(modeConfig, 'MCP mode settings') });
        }
    }, [services]);
    useEffect(() => {
        void load();
    }, [load]);
    async function chooseMode(next) {
        setModeStatus({ tone: null, text: 'switching…' });
        const result = await services.setMcpMode(next);
        if (!result.ok) {
            setModeStatus({ tone: 'error', text: failureMessage(result, 'MCP mode settings') });
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
    return (_jsx("div", { className: "kit-feature kit-feature-coding-agents agents", children: _jsxs(StudioPanel, { title: "Coding agents", aside: _jsx("button", { className: "btn ghost tiny", onClick: () => void load(), children: "Refresh" }), children: [_jsx("p", { className: "hint", children: "Connect Claude Code or Codex through MCP so it can work with your documents, graph, and realms." }), _jsxs("div", { className: "ladder", children: [_jsxs("div", { className: "rung", children: [_jsx("span", { className: `lamp lamp-${endpointLamp}` }), _jsxs("div", { className: "rung-body", children: [_jsx("strong", { children: "MCP connection" }), _jsx("p", { className: "hint", children: mcp === 'guarded' ? 'Ready. An agent must authenticate before it can use your world.' :
                                                mcp === 'open' ? _jsxs(_Fragment, { children: ["Ready, but ", _jsx("strong", { children: "unguarded" }), " \u2014 anything that can reach the appliance can use your world."] }) :
                                                    mcp === 'down' ? (probeMessage || 'The appliance could not be reached.') :
                                                        mcp === 'noprobe' ? 'Connection status is not available for this appliance.' :
                                                            mcp === 'probing' ? 'checking…' :
                                                                (probeMessage || 'The MCP service is responding.') })] })] }), _jsxs("div", { className: "rung", children: [_jsx("span", { className: `lamp lamp-${mode ? 'lit' : 'unlit'}` }), _jsxs("div", { className: "rung-body", children: [_jsx("strong", { children: "What an agent may do" }), _jsx("p", { className: "hint", children: MODE_SAYS[mode] ?? 'Pick what an agent connecting here is allowed to do.' }), _jsxs("div", { className: "row", children: [_jsxs("label", { className: "field", children: [_jsx("span", { children: "Mode" }), _jsxs("select", { value: mode, onChange: (event) => void chooseMode(event.target.value), children: [mode === '' && _jsx("option", { value: "", children: "unknown" }), (modes.length ? modes : DEFAULT_MODES).map((availableMode) => (_jsx("option", { value: availableMode, children: availableMode === 'ASSISTANT'
                                                                        ? 'Assistant — my data'
                                                                        : availableMode === 'DEVELOPER'
                                                                            ? 'Developer — also build realms'
                                                                            : availableMode }, availableMode)))] })] }), _jsx(Status, { tone: modeStatus.tone, children: modeStatus.text })] }), changedMode && (_jsx("p", { className: "hint", children: "This takes effect immediately. An agent that is already connected can try its call again." }))] })] }), _jsxs("div", { className: "rung", children: [_jsx("span", { className: `lamp lamp-${canRender ? 'lit' : 'unlit'}` }), _jsxs("div", { className: "rung-body", children: [_jsx("strong", { children: "Connection instructions" }), _jsx("p", { className: "hint", children: "Choose credentials, then copy the generated setup into Claude Code or Codex." }), _jsx("div", { className: "row", children: _jsxs("label", { className: "field grow", children: [_jsx("span", { children: "Appliance URL" }), _jsx("input", { value: baseUrl, placeholder: "https://your-appliance.example", onChange: (event) => setBaseUrl(event.target.value) })] }) }), _jsxs("div", { className: "row authpick", children: [_jsx("button", { className: `btn${authKind === 'basic' ? ' primary' : ' ghost'}`, onClick: () => setAuthKind('basic'), children: "Use my sign-in" }), _jsx("button", { className: `btn${authKind === 'bearer' ? ' primary' : ' ghost'}`, onClick: () => setAuthKind('bearer'), children: "Use a bearer token" })] }), authKind === 'basic' ? (_jsxs(_Fragment, { children: [_jsxs("p", { className: "hint", children: ["Use the username and password for the account the coding agent should act as.", suppliedCredential && ' The host has supplied your current credential.'] }), !suppliedCredential && (_jsxs("div", { className: "row", children: [_jsxs("label", { className: "field", children: [_jsx("span", { children: "Username" }), _jsx("input", { value: username, onChange: (event) => setUsername(event.target.value) })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Password" }), _jsx("input", { type: "password", value: password, onChange: (event) => setPassword(event.target.value) })] })] })), _jsx("p", { className: "hint", children: "The agent's configuration may contain this credential in a readable form. Anyone who can read that configuration can use the same account." })] })) : (_jsxs(_Fragment, { children: [suppliedCredential ? (_jsx("p", { className: "hint", children: "The host has supplied your current bearer credential." })) : (_jsx("div", { className: "row", children: _jsxs("label", { className: "field grow", children: [_jsx("span", { children: "Bearer token" }), _jsx("input", { type: "password", value: token, placeholder: "Paste a token for this appliance", onChange: (event) => setToken(event.target.value) })] }) })), _jsx("p", { className: "hint", children: "Use a bearer token created for the appliance when you do not want the agent to carry your sign-in." })] })), _jsxs("p", { className: "hint", children: ["Credentials entered here stay in this page only long enough to build the instructions.", ' ', haveCredential && (_jsx("button", { className: "status as-link", onClick: () => setReveal((value) => !value), children: reveal ? 'hide it' : 'show it' }))] }), _jsx(Snippet, { label: "Claude Code", shown: mask(claudeConnection), copy: claudeConnection, disabled: !canRender }), _jsx(Snippet, { label: "Codex", shown: mask(codexConnection), copy: codexConnection, disabled: !canRender })] })] })] })] }) }));
}
function Snippet({ label, shown, copy, disabled, }) {
    const [copied, setCopied] = useState(false);
    return (_jsxs("div", { className: "snippet", children: [_jsxs("div", { className: "snippet-head", children: [_jsx("strong", { children: label }), _jsx("button", { className: "btn ghost tiny", disabled: disabled, onClick: () => {
                            void navigator.clipboard?.writeText(copy);
                            setCopied(true);
                            setTimeout(() => setCopied(false), 1500);
                        }, children: copied ? 'Copied' : 'Copy' })] }), _jsx("pre", { className: "cmd", children: shown })] }));
}
//# sourceMappingURL=CodingAgentsSurface.js.map