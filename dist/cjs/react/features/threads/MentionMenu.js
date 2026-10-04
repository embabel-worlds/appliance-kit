"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MentionMenu = MentionMenu;
exports.useMentionCursor = useMentionCursor;
const jsx_runtime_1 = require("react/jsx-runtime");
/*
 * WHO YOU CAN BRING INTO A THREAD, offered where you need it.
 *
 * `@mention` was the only way to reach an agent in a thread, and nothing in the thread said who
 * there was. The names live in the Agents window, so a person either knew them or left to find out
 * — and `/talk`, which lists them, is a CHAT command: typed into a thread it posts the literal text
 * "/talk". The place you most need the names was the one place that could not give them.
 *
 * IT INFORMS, IT NEVER GATES. An agent that is off or unsigned is listed, with a note, and can be
 * mentioned anyway, because the appliance already answers in the thread saying why it would not
 * take part. Deciding here instead would put that rule in two places, and the second copy is how
 * this surface broke the last time.
 */
const react_1 = require("react");
const mentions_ts_1 = require("./mentions.js");
function MentionMenu({ agents, query, active, onPick, id }) {
    const shown = (0, mentions_ts_1.matching)(agents, query);
    if (shown.length === 0)
        return null;
    return ((0, jsx_runtime_1.jsx)("ul", { className: "threadmentions", role: "listbox", id: id, "aria-label": "Agents you can mention", children: shown.map((agent, index) => ((0, jsx_runtime_1.jsx)("li", { children: (0, jsx_runtime_1.jsxs)("button", { type: "button", role: "option", id: `${id}-${index}`, "aria-selected": index === active, className: index === active ? 'is-active' : undefined, 
                /* The textarea must keep the caret: a click that moved focus first would replace a
                   mention the browser had already collapsed. */
                onMouseDown: (event) => event.preventDefault(), onClick: () => onPick(agent.name), children: [(0, jsx_runtime_1.jsxs)("strong", { children: ["@", agent.name] }), agent.job && (0, jsx_runtime_1.jsx)("span", { className: "hint", children: agent.job }), agent.hint && (0, jsx_runtime_1.jsx)("span", { className: "pill", children: agent.hint })] }) }, agent.name))) }));
}
/**
 * The menu's keyboard state for one composer: which row is highlighted, kept in range as the query
 * narrows the list.
 */
function useMentionCursor(count) {
    const [active, setActive] = (0, react_1.useState)(0);
    /* A list that shrinks under the cursor would otherwise leave it pointing past the end, and Enter
     * would pick nothing while looking like it would pick something. */
    (0, react_1.useEffect)(() => {
        setActive((current) => (current >= count ? 0 : current));
    }, [count]);
    const move = (delta) => setActive((current) => (count === 0 ? 0 : (current + delta + count) % count));
    return { active, move, reset: () => setActive(0) };
}
//# sourceMappingURL=MentionMenu.js.map