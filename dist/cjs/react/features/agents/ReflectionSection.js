"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReflectionSection = ReflectionSection;
const jsx_runtime_1 = require("react/jsx-runtime");
/*
 * REFLECTION, on the agent's card (#1782): "how would you do this better?", answered from its own
 * record, with the evidence for every change it proposes.
 *
 * Adopting writes the proposed version for its sponsor to sign, as any change to an agent is signed;
 * the server refuses one that would let the agent do more than it was signed for. Nothing proves a
 * proposal yet — no battery, no replay of last month — and the section says so beside every one.
 */
const react_1 = require("react");
const chrome_tsx_1 = require("../studio/chrome.js");
function ReflectionSection({ name, services, onAdopted }) {
    const [proposals, setProposals] = (0, react_1.useState)([]);
    const [problem, setProblem] = (0, react_1.useState)('');
    const [busy, setBusy] = (0, react_1.useState)(null);
    const load = (0, react_1.useCallback)(async () => {
        if (!services.listProposals)
            return;
        const result = await services.listProposals(name);
        if (result.ok)
            setProposals(result.value);
        else if (result.kind !== 'unsupported')
            setProblem((0, chrome_tsx_1.failureMessage)(result, 'load its proposals'));
    }, [name, services]);
    (0, react_1.useEffect)(() => {
        void load();
    }, [load]);
    async function reflect() {
        setBusy('reflect');
        const result = await services.reflect(name);
        setBusy(null);
        if (!result.ok) {
            setProblem((0, chrome_tsx_1.failureMessage)(result, 'ask how it would do better'));
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
            setProblem((0, chrome_tsx_1.failureMessage)(result, adopt ? 'adopt it' : 'dismiss it'));
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
    return ((0, jsx_runtime_1.jsxs)("div", { className: "agent-reflection", children: [(0, jsx_runtime_1.jsxs)("div", { className: "row", children: [(0, jsx_runtime_1.jsx)("h3", { className: "caption", children: "Reflection" }), (0, jsx_runtime_1.jsx)("button", { className: "btn ghost tiny", disabled: busy === 'reflect', onClick: () => void reflect(), children: busy === 'reflect' ? 'Reading its record…' : 'How would it do better?' })] }), problem && (0, jsx_runtime_1.jsx)(chrome_tsx_1.Status, { tone: "error", children: problem }), open.length === 0 && proposals.length === 0 && ((0, jsx_runtime_1.jsx)("p", { className: "hint", children: "It proposes changes from its own record: requests people turned down and why, checks that never find anything." })), open.map((p) => ((0, jsx_runtime_1.jsxs)("div", { className: "proposal", children: [(0, jsx_runtime_1.jsx)("p", { children: (0, jsx_runtime_1.jsx)("strong", { children: p.summary || 'Nothing to change.' }) }), p.changes.length === 0 ? (0, jsx_runtime_1.jsx)("p", { className: "hint", children: "The record supports no change." }) : ((0, jsx_runtime_1.jsx)("ul", { className: "proposal-changes", children: p.changes.map((c, i) => ((0, jsx_runtime_1.jsxs)("li", { children: [(0, jsx_runtime_1.jsx)("code", { children: c.target }), ": ", c.from ? (0, jsx_runtime_1.jsxs)(jsx_runtime_1.Fragment, { children: [(0, jsx_runtime_1.jsx)("s", { children: c.from }), " \u2192 "] }) : null, c.duty ? `${c.duty.name}: ${c.duty.text}` : c.to, c.why && (0, jsx_runtime_1.jsxs)("div", { className: "hint", children: [c.why, c.evidence ? ` (${c.evidence})` : ''] })] }, i))) })), (0, jsx_runtime_1.jsxs)("details", { children: [(0, jsx_runtime_1.jsx)("summary", { className: "hint", children: "What it read" }), (0, jsx_runtime_1.jsx)("pre", { className: "run-output", children: p.record })] }), !p.proven && (0, jsx_runtime_1.jsx)("p", { className: "hint", children: "Not yet proven: nothing replays a proposal over last month yet." }), p.refused && (0, jsx_runtime_1.jsx)(chrome_tsx_1.Status, { tone: "caution", children: p.refused }), p.changes.length > 0 && services.adoptProposal && ((0, jsx_runtime_1.jsxs)("div", { className: "row", children: [(0, jsx_runtime_1.jsx)("button", { className: "btn", disabled: busy === p.id, onClick: () => void decide(p, true), children: "Adopt, to sign" }), (0, jsx_runtime_1.jsx)("button", { className: "btn ghost tiny", disabled: busy === p.id, onClick: () => void decide(p, false), children: "Dismiss" })] }))] }, p.id)))] }));
}
//# sourceMappingURL=ReflectionSection.js.map