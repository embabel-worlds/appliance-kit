import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
/*
 * REFLECTION, on the agent's card (#1782): "how would you do this better?", answered from its own
 * record, with the evidence for every change it proposes.
 *
 * Adopting writes the proposed version for its sponsor to sign, as any change to an agent is signed;
 * the server refuses one that would let the agent do more than it was signed for. Nothing proves a
 * proposal yet — no battery, no replay of last month — and the section says so beside every one.
 */
import { useCallback, useEffect, useState } from 'react';
import { Status, failureMessage } from "../studio/chrome.js";
export function ReflectionSection({ name, services, onAdopted }) {
    const [proposals, setProposals] = useState([]);
    const [problem, setProblem] = useState('');
    const [busy, setBusy] = useState(null);
    const load = useCallback(async () => {
        if (!services.listProposals)
            return;
        const result = await services.listProposals(name);
        if (result.ok)
            setProposals(result.value);
        else if (result.kind !== 'unsupported')
            setProblem(failureMessage(result, 'load its proposals'));
    }, [name, services]);
    useEffect(() => {
        void load();
    }, [load]);
    async function reflect() {
        setBusy('reflect');
        const result = await services.reflect(name);
        setBusy(null);
        if (!result.ok) {
            setProblem(failureMessage(result, 'ask how it would do better'));
            return;
        }
        setProblem('');
        await load();
    }
    async function decide(p, adopt) {
        setBusy(p.id);
        const result = adopt ? await services.adoptProposal(name, p.id) : await services.dismissProposal(name, p.id);
        setBusy(null);
        if (!result.ok) {
            setProblem(failureMessage(result, adopt ? 'adopt it' : 'dismiss it'));
            return;
        }
        setProblem('');
        if (adopt)
            onAdopted();
        await load();
    }
    if (!services.reflect || !services.listProposals)
        return null;
    const open = proposals.filter((p) => p.status === 'OPEN');
    return (_jsxs("div", { className: "agent-reflection", children: [_jsxs("div", { className: "row", children: [_jsx("h3", { className: "caption", children: "Reflection" }), _jsx("button", { className: "btn ghost tiny", disabled: busy === 'reflect', onClick: () => void reflect(), children: busy === 'reflect' ? 'Reading its record…' : 'How would it do better?' })] }), problem && _jsx(Status, { tone: "error", children: problem }), open.length === 0 && proposals.length === 0 && (_jsx("p", { className: "hint", children: "It proposes changes from its own record: requests people turned down and why, checks that never find anything." })), open.map((p) => (_jsxs("div", { className: "proposal", children: [_jsx("p", { children: _jsx("strong", { children: p.summary || 'Nothing to change.' }) }), p.changes.length === 0 ? _jsx("p", { className: "hint", children: "The record supports no change." }) : (_jsx("ul", { className: "proposal-changes", children: p.changes.map((c, i) => (_jsxs("li", { children: [_jsx("code", { children: c.target }), ": ", c.from ? _jsxs(_Fragment, { children: [_jsx("s", { children: c.from }), " \u2192 "] }) : null, c.duty ? `${c.duty.name}: ${c.duty.text}` : c.to, c.why && _jsxs("div", { className: "hint", children: [c.why, c.evidence ? ` (${c.evidence})` : ''] })] }, i))) })), _jsxs("details", { children: [_jsx("summary", { className: "hint", children: "What it read" }), _jsx("pre", { className: "run-output", children: p.record })] }), !p.proven && _jsx("p", { className: "hint", children: "Not yet proven: nothing replays a proposal over last month yet." }), p.refused && _jsx(Status, { tone: "caution", children: p.refused }), p.changes.length > 0 && services.adoptProposal && (_jsxs("div", { className: "row", children: [_jsx("button", { className: "btn", disabled: busy === p.id, onClick: () => void decide(p, true), children: "Adopt, to sign" }), _jsx("button", { className: "btn ghost tiny", disabled: busy === p.id, onClick: () => void decide(p, false), children: "Dismiss" })] }))] }, p.id)))] }));
}
//# sourceMappingURL=ReflectionSection.js.map