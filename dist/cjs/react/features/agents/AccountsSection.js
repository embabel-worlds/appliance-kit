"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AccountsSection = AccountsSection;
const jsx_runtime_1 = require("react/jsx-runtime");
/*
 * WHOSE ACCOUNT, AND RETIRING, on the agent's card (#1783).
 *
 * An agent calls an API with its sponsor's credentials unless its identity there is its own account;
 * then it sends the secret kept here, and with none kept it is refused rather than quietly borrowing
 * the sponsor's. Values go in and never come back: the list is of names.
 *
 * Retiring is final and is offered as such: a second press, with the consequences in words, rather
 * than a dialog the host may not be able to show.
 */
const react_1 = require("react");
const chrome_tsx_1 = require("../studio/chrome.js");
function AccountsSection({ agent, services, onRetired }) {
    const [secrets, setSecrets] = (0, react_1.useState)(null);
    const [secret, setSecret] = (0, react_1.useState)('');
    const [value, setValue] = (0, react_1.useState)('');
    const [reason, setReason] = (0, react_1.useState)('');
    const [confirming, setConfirming] = (0, react_1.useState)(false);
    const [problem, setProblem] = (0, react_1.useState)('');
    const [notice, setNotice] = (0, react_1.useState)('');
    const own = Object.entries(agent.identity ?? {}).filter(([, mode]) => mode === 'own-account').map(([api]) => api);
    const retired = agent.state === 'retired';
    const load = (0, react_1.useCallback)(async () => {
        if (!services.listAccounts)
            return;
        const result = await services.listAccounts(agent.name);
        if (result.ok)
            setSecrets(result.value.secrets);
        else if (result.kind !== 'unsupported')
            setProblem((0, chrome_tsx_1.failureMessage)(result, 'list its accounts'));
    }, [agent.name, services]);
    (0, react_1.useEffect)(() => {
        void load();
    }, [load]);
    if (!services.listAccounts)
        return null;
    async function keep() {
        const result = await services.setAccount(agent.name, secret.trim(), value);
        if (!result.ok)
            return setProblem((0, chrome_tsx_1.failureMessage)(result, 'save that secret'));
        setProblem('');
        setSecret('');
        setValue('');
        setSecrets(result.value.secrets);
    }
    async function forget(name) {
        const result = await services.removeAccount(agent.name, name);
        if (!result.ok)
            return setProblem((0, chrome_tsx_1.failureMessage)(result, 'delete that secret'));
        setProblem('');
        setSecrets(result.value.secrets);
    }
    async function retire() {
        const result = await services.retire(agent.name, reason.trim());
        setConfirming(false);
        if (!result.ok)
            return setProblem((0, chrome_tsx_1.failureMessage)(result, 'retire it'));
        const r = result.value;
        setProblem('');
        setNotice(`Retired. ${r.keysRevoked} key${r.keysRevoked === 1 ? '' : 's'} revoked, ${r.slotsDeleted} secret${r.slotsDeleted === 1 ? '' : 's'} deleted.`);
        onRetired();
    }
    return ((0, jsx_runtime_1.jsxs)("div", { className: "agent-accounts", children: [(0, jsx_runtime_1.jsx)("h3", { className: "caption", children: "Accounts" }), problem && (0, jsx_runtime_1.jsx)(chrome_tsx_1.Status, { tone: "error", children: problem }), notice && (0, jsx_runtime_1.jsx)(chrome_tsx_1.Status, { tone: "ok", children: notice }), (0, jsx_runtime_1.jsx)("p", { className: "hint", children: own.length === 0
                    ? 'It calls every API on its sponsor’s behalf, and signs what it writes as acting for them.'
                    : `Its own account on ${own.join(', ')}; everything else on its sponsor’s behalf. Without its own secret kept here, a call there is refused.` }), secrets && secrets.length > 0 && ((0, jsx_runtime_1.jsx)("ul", { className: "agent-secrets", children: secrets.map((s) => ((0, jsx_runtime_1.jsxs)("li", { className: "row", children: [(0, jsx_runtime_1.jsx)("code", { children: s }), !retired && (0, jsx_runtime_1.jsx)("button", { className: "btn ghost tiny", onClick: () => void forget(s), children: "Remove" })] }, s))) })), !retired && own.length > 0 && ((0, jsx_runtime_1.jsxs)("div", { className: "row", children: [(0, jsx_runtime_1.jsx)("input", { placeholder: "Secret name, e.g. ODOO_API_KEY", value: secret, onChange: (e) => setSecret(e.target.value) }), (0, jsx_runtime_1.jsx)("input", { type: "password", placeholder: "Value", value: value, onChange: (e) => setValue(e.target.value) }), (0, jsx_runtime_1.jsx)("button", { className: "btn", disabled: !secret.trim() || !value, onClick: () => void keep(), children: "Keep" })] })), services.retire && !retired && ((0, jsx_runtime_1.jsx)("div", { className: "row", children: confirming ? ((0, jsx_runtime_1.jsxs)(jsx_runtime_1.Fragment, { children: [(0, jsx_runtime_1.jsx)("input", { placeholder: "Why (optional)", value: reason, onChange: (e) => setReason(e.target.value) }), (0, jsx_runtime_1.jsxs)("button", { className: "btn arm", onClick: () => void retire(), children: ["Retire ", agent.name, " for good"] }), (0, jsx_runtime_1.jsx)("button", { className: "btn ghost", onClick: () => setConfirming(false), children: "Keep it" }), (0, jsx_runtime_1.jsx)("span", { className: "hint", children: "It goes off duty for good, every key that may talk to it is revoked, and its own secrets are deleted." })] })) : ((0, jsx_runtime_1.jsx)("button", { className: "btn ghost", onClick: () => setConfirming(true), children: "Retire\u2026" })) }))] }));
}
//# sourceMappingURL=AccountsSection.js.map