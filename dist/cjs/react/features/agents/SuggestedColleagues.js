"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SuggestedColleagues = SuggestedColleagues;
const jsx_runtime_1 = require("react/jsx-runtime");
/*
 * SUGGESTED COLLEAGUES, under the roster (#1778): who the scout-agents skill would hire, best first,
 * each with the evidence it counted.
 *
 * Two kinds of answer, and the difference is the point. Where an installed realm already proposes
 * an agent for the work, the suggestion is to adopt THAT one — "Adopt it" opens its card, where it
 * is sponsored, signed and put on duty like any other — and says what it leaves uncovered. Only
 * work nothing covers is drafted, and a draft arrives unsigned and off duty with what its duties
 * would act on today, which is a look at today and not a replay of the past.
 */
const react_1 = require("react");
const chrome_tsx_1 = require("../studio/chrome.js");
function SuggestedColleagues({ services, onOpen, onDrafted }) {
    const [suggestions, setSuggestions] = (0, react_1.useState)([]);
    const [problem, setProblem] = (0, react_1.useState)('');
    const [busy, setBusy] = (0, react_1.useState)(null);
    const [drafted, setDrafted] = (0, react_1.useState)(null);
    const load = (0, react_1.useCallback)(async () => {
        if (!services.listSuggestions)
            return;
        const result = await services.listSuggestions();
        if (!result.ok) {
            // A server without suggestions says nothing here rather than an error under the roster.
            if (result.kind !== 'unsupported')
                setProblem((0, chrome_tsx_1.failureMessage)(result, 'list suggested colleagues'));
            return;
        }
        setProblem('');
        setSuggestions(result.value);
    }, [services]);
    (0, react_1.useEffect)(() => {
        void load();
    }, [load]);
    async function decide(s, act) {
        const call = act === 'draft' ? services.draftSuggestion : act === 'adopt' ? services.markAdopted : services.dismissSuggestion;
        if (!call)
            return;
        setBusy(s.id);
        const result = await call(s.id);
        setBusy(null);
        if (!result.ok) {
            setProblem((0, chrome_tsx_1.failureMessage)(result, act === 'draft' ? 'create the draft' : act === 'adopt' ? 'start adopting it' : 'dismiss it'));
            return;
        }
        setProblem('');
        if (act === 'draft') {
            setDrafted(result.value);
            onDrafted(result.value.name);
        }
        if (act === 'adopt')
            onOpen(result.value.name);
        await load();
    }
    const open = suggestions.filter((s) => s.status === 'OPEN');
    if (!services.listSuggestions || (open.length === 0 && !problem && !drafted))
        return null;
    return ((0, jsx_runtime_1.jsxs)("section", { className: "suggested", "aria-label": "Suggested colleagues", children: [(0, jsx_runtime_1.jsx)("h3", { className: "suggested-title", children: "Suggested colleagues" }), problem && (0, jsx_runtime_1.jsx)(chrome_tsx_1.Status, { tone: "error", children: problem }), drafted && ((0, jsx_runtime_1.jsxs)(chrome_tsx_1.Status, { tone: "ok", children: ["Drafted ", drafted.name, ", unsigned and off duty. ", drafted.preview.length > 0 ? `Today it would: ${drafted.preview.join(' ')}` : ''] })), (0, jsx_runtime_1.jsx)("ol", { className: "suggestedlist", children: open.map((s) => ((0, jsx_runtime_1.jsxs)("li", { className: "suggestion", children: [(0, jsx_runtime_1.jsxs)("div", { className: "row suggestion-head", children: [(0, jsx_runtime_1.jsx)("strong", { children: s.adopt ? `Adopt ${s.adopt}` : s.name }), s.kind === 'TALKS' && (0, jsx_runtime_1.jsx)("span", { className: "agentrow-tag", children: "to talk to" }), s.adopt && (0, jsx_runtime_1.jsx)("span", { className: "agentrow-tag", children: "already proposed by a realm" })] }), (0, jsx_runtime_1.jsx)("p", { className: "suggestion-job", children: s.job }), (0, jsx_runtime_1.jsx)("ul", { className: "suggestion-evidence", children: s.evidence.map((e, i) => ((0, jsx_runtime_1.jsx)("li", { children: (0, jsx_runtime_1.jsxs)("details", { children: [(0, jsx_runtime_1.jsxs)("summary", { children: [(0, jsx_runtime_1.jsx)("strong", { children: e.count }), " ", e.summary, e.period ? ` (${e.period})` : ''] }), e.query && (0, jsx_runtime_1.jsx)("pre", { className: "suggestion-query", children: e.query })] }) }, i))) }), s.uncovered && (0, jsx_runtime_1.jsxs)("p", { className: "hint", children: ["Not covered: ", s.uncovered] }), s.feasibility && (0, jsx_runtime_1.jsx)("p", { className: "hint", children: s.feasibility }), (0, jsx_runtime_1.jsxs)("div", { className: "row", children: [s.adopt
                                    ? (0, jsx_runtime_1.jsx)("button", { className: "btn", disabled: busy === s.id, onClick: () => void decide(s, 'adopt'), children: "Adopt it" })
                                    : (0, jsx_runtime_1.jsx)("button", { className: "btn", disabled: busy === s.id, onClick: () => void decide(s, 'draft'), children: busy === s.id ? 'Drafting…' : 'Draft it' }), (0, jsx_runtime_1.jsx)("button", { className: "btn ghost tiny", disabled: busy === s.id, onClick: () => void decide(s, 'dismiss'), children: "Dismiss" })] })] }, s.id))) })] }));
}
//# sourceMappingURL=SuggestedColleagues.js.map