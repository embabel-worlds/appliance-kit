"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.QueryExampleCards = QueryExampleCards;
const jsx_runtime_1 = require("react/jsx-runtime");
/*
 * STARTER QUERIES — a few cards over the empty editor, each showing one thing the query language
 * can do, that run when clicked.
 *
 * An empty editor teaches nothing. Somebody new to the studio does not yet know that a WHERE can be
 * written in English, that a sentence can be read into a graph, or that the world's own runs and
 * realms are data like any other — and a placeholder cannot show them. A card can, because clicking
 * it puts the query in the editor AND runs it, so the query and its answer arrive together and the
 * next step is to change something and run it again.
 *
 * WHAT THE CARDS ARE is the world's: default-world ships a set, a world or a realm adds its own,
 * and the appliance says whether this person still needs them offered (`show`). It stops offering
 * them once they dismiss them, save a view of their own, or have written a handful of queries in the
 * studio. Examples, beside Help, brings them back on request either way.
 *
 * Each card says what it demonstrates in one line, and whether it asks a model (`AI`) — which costs
 * model calls — or is plain Cypher over what the world holds.
 */
const react_1 = require("@phosphor-icons/react");
function QueryExampleCards({ examples, requested, onRun, onClose, onDismiss, }) {
    return ((0, jsx_runtime_1.jsxs)("section", { className: "query-examples", "aria-label": "Example queries", children: [(0, jsx_runtime_1.jsxs)("header", { className: "query-examples-head", children: [(0, jsx_runtime_1.jsx)("span", { className: "query-examples-title", children: "Try an example \u2014 click one to run it" }), requested || !onDismiss
                        ? ((0, jsx_runtime_1.jsx)("button", { className: "btn ghost tiny", onClick: onClose, "aria-label": "Close examples", title: "Close examples", children: (0, jsx_runtime_1.jsx)(react_1.X, { size: 14, weight: "bold", "aria-hidden": "true" }) }))
                        : ((0, jsx_runtime_1.jsx)("button", { className: "btn ghost tiny", onClick: onDismiss, title: "Examples stays beside Help, to bring them back", children: "Don't show these again" }))] }), (0, jsx_runtime_1.jsx)("div", { className: "query-examples-grid", children: examples.map((example) => ((0, jsx_runtime_1.jsxs)("button", { className: `query-example is-${example.kind}`, onClick: () => onRun(example), title: example.cypher, children: [(0, jsx_runtime_1.jsxs)("span", { className: "query-example-top", children: [(0, jsx_runtime_1.jsx)("strong", { children: example.title }), (0, jsx_runtime_1.jsxs)("span", { className: `viewtag query-example-kind is-${example.kind}`, children: [example.kind === 'ai' && (0, jsx_runtime_1.jsx)(react_1.Sparkle, { size: 11, weight: "fill", "aria-hidden": "true" }), example.kind === 'ai' ? 'AI' : 'Cypher'] })] }), (0, jsx_runtime_1.jsx)("span", { className: "query-example-line", children: example.description }), example.source && (0, jsx_runtime_1.jsxs)("span", { className: "query-example-source", children: ["from ", example.source] })] }, example.id))) })] }));
}
//# sourceMappingURL=QueryExamples.js.map