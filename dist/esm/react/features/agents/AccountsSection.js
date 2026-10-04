import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
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
import { useCallback, useEffect, useState } from 'react';
import { Status, failureMessage } from "../studio/chrome.js";
export function AccountsSection({ agent, services, onRetired }) {
    const [secrets, setSecrets] = useState(null);
    const [secret, setSecret] = useState('');
    const [value, setValue] = useState('');
    const [reason, setReason] = useState('');
    const [confirming, setConfirming] = useState(false);
    const [problem, setProblem] = useState('');
    const [notice, setNotice] = useState('');
    const own = Object.entries(agent.identity ?? {}).filter(([, mode]) => mode === 'own-account').map(([api]) => api);
    const retired = agent.state === 'retired';
    const load = useCallback(async () => {
        if (!services.listAccounts)
            return;
        const result = await services.listAccounts(agent.name);
        if (result.ok)
            setSecrets(result.value.secrets);
        else if (result.kind !== 'unsupported')
            setProblem(failureMessage(result, 'list its accounts'));
    }, [agent.name, services]);
    useEffect(() => {
        void load();
    }, [load]);
    if (!services.listAccounts)
        return null;
    async function keep() {
        const result = await services.setAccount(agent.name, secret.trim(), value);
        if (!result.ok)
            return setProblem(failureMessage(result, 'save that secret'));
        setProblem('');
        setSecret('');
        setValue('');
        setSecrets(result.value.secrets);
    }
    async function forget(name) {
        const result = await services.removeAccount(agent.name, name);
        if (!result.ok)
            return setProblem(failureMessage(result, 'delete that secret'));
        setProblem('');
        setSecrets(result.value.secrets);
    }
    async function retire() {
        const result = await services.retire(agent.name, reason.trim());
        setConfirming(false);
        if (!result.ok)
            return setProblem(failureMessage(result, 'retire it'));
        const r = result.value;
        setProblem('');
        setNotice(`Retired. ${r.keysRevoked} key${r.keysRevoked === 1 ? '' : 's'} revoked, ${r.slotsDeleted} secret${r.slotsDeleted === 1 ? '' : 's'} deleted.`);
        onRetired();
    }
    return (_jsxs("div", { className: "agent-accounts", children: [_jsx("h3", { className: "caption", children: "Accounts" }), problem && _jsx(Status, { tone: "error", children: problem }), notice && _jsx(Status, { tone: "ok", children: notice }), _jsx("p", { className: "hint", children: own.length === 0
                    ? 'It calls every API on its sponsor’s behalf, and signs what it writes as acting for them.'
                    : `Its own account on ${own.join(', ')}; everything else on its sponsor’s behalf. Without its own secret kept here, a call there is refused.` }), secrets && secrets.length > 0 && (_jsx("ul", { className: "agent-secrets", children: secrets.map((s) => (_jsxs("li", { className: "row", children: [_jsx("code", { children: s }), !retired && _jsx("button", { className: "btn ghost tiny", onClick: () => void forget(s), children: "Remove" })] }, s))) })), !retired && own.length > 0 && (_jsxs("div", { className: "row", children: [_jsx("input", { placeholder: "Secret name, e.g. ODOO_API_KEY", value: secret, onChange: (e) => setSecret(e.target.value) }), _jsx("input", { type: "password", placeholder: "Value", value: value, onChange: (e) => setValue(e.target.value) }), _jsx("button", { className: "btn", disabled: !secret.trim() || !value, onClick: () => void keep(), children: "Keep" })] })), services.retire && !retired && (_jsx("div", { className: "row", children: confirming ? (_jsxs(_Fragment, { children: [_jsx("input", { placeholder: "Why (optional)", value: reason, onChange: (e) => setReason(e.target.value) }), _jsxs("button", { className: "btn arm", onClick: () => void retire(), children: ["Retire ", agent.name, " for good"] }), _jsx("button", { className: "btn ghost", onClick: () => setConfirming(false), children: "Keep it" }), _jsx("span", { className: "hint", children: "It goes off duty for good, every key that may talk to it is revoked, and its own secrets are deleted." })] })) : (_jsx("button", { className: "btn ghost", onClick: () => setConfirming(true), children: "Retire\u2026" })) }))] }));
}
//# sourceMappingURL=AccountsSection.js.map