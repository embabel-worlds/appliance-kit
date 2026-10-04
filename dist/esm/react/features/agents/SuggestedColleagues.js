import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
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
import { useCallback, useEffect, useState } from 'react';
import { Status, failureMessage } from "../studio/chrome.js";
export function SuggestedColleagues({ services, onOpen, onDrafted }) {
    const [suggestions, setSuggestions] = useState([]);
    const [problem, setProblem] = useState('');
    const [busy, setBusy] = useState(null);
    const [drafted, setDrafted] = useState(null);
    const load = useCallback(async () => {
        if (!services.listSuggestions)
            return;
        const result = await services.listSuggestions();
        if (!result.ok) {
            // A server without suggestions says nothing here rather than an error under the roster.
            if (result.kind !== 'unsupported')
                setProblem(failureMessage(result, 'list suggested colleagues'));
            return;
        }
        setProblem('');
        setSuggestions(result.value);
    }, [services]);
    useEffect(() => {
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
            setProblem(failureMessage(result, act === 'draft' ? 'create the draft' : act === 'adopt' ? 'start adopting it' : 'dismiss it'));
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
    return (_jsxs("section", { className: "suggested", "aria-label": "Suggested colleagues", children: [_jsx("h3", { className: "suggested-title", children: "Suggested colleagues" }), problem && _jsx(Status, { tone: "error", children: problem }), drafted && (_jsxs(Status, { tone: "ok", children: ["Drafted ", drafted.name, ", unsigned and off duty. ", drafted.preview.length > 0 ? `Today it would: ${drafted.preview.join(' ')}` : ''] })), _jsx("ol", { className: "suggestedlist", children: open.map((s) => (_jsxs("li", { className: "suggestion", children: [_jsxs("div", { className: "row suggestion-head", children: [_jsx("strong", { children: s.adopt ? `Adopt ${s.adopt}` : s.name }), s.kind === 'TALKS' && _jsx("span", { className: "agentrow-tag", children: "to talk to" }), s.adopt && _jsx("span", { className: "agentrow-tag", children: "already proposed by a realm" })] }), _jsx("p", { className: "suggestion-job", children: s.job }), _jsx("ul", { className: "suggestion-evidence", children: s.evidence.map((e, i) => (_jsx("li", { children: _jsxs("details", { children: [_jsxs("summary", { children: [_jsx("strong", { children: e.count }), " ", e.summary, e.period ? ` (${e.period})` : ''] }), e.query && _jsx("pre", { className: "suggestion-query", children: e.query })] }) }, i))) }), s.uncovered && _jsxs("p", { className: "hint", children: ["Not covered: ", s.uncovered] }), s.feasibility && _jsx("p", { className: "hint", children: s.feasibility }), _jsxs("div", { className: "row", children: [s.adopt
                                    ? _jsx("button", { className: "btn", disabled: busy === s.id, onClick: () => void decide(s, 'adopt'), children: "Adopt it" })
                                    : _jsx("button", { className: "btn", disabled: busy === s.id, onClick: () => void decide(s, 'draft'), children: busy === s.id ? 'Drafting…' : 'Draft it' }), _jsx("button", { className: "btn ghost tiny", disabled: busy === s.id, onClick: () => void decide(s, 'dismiss'), children: "Dismiss" })] })] }, s.id))) })] }));
}
//# sourceMappingURL=SuggestedColleagues.js.map