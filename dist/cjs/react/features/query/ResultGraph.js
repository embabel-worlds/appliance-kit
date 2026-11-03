"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.ResultGraph = ResultGraph;
const jsx_runtime_1 = require("react/jsx-runtime");
/*
 * THE GRAPH VIEW — a result's nodes and relationships, drawn.
 *
 * The table flattens a node to a JSON cell, which hides the one thing a graph answer has that a
 * table does not: what is joined to what. `ai.fromText` reads a sentence into a small graph, and
 * showing it as three columns of JSON makes the point of it invisible.
 *
 * LAYOUT IS d3-force's, run to rest before anything is painted rather than animated in. A settled
 * picture is the answer; watching it settle is a screensaver, and a layout computed once is the same
 * picture every time the same rows come back. The drawing is plain SVG, because React already owns
 * this DOM and a second renderer fighting it for the same nodes is how a chart ends up blank.
 *
 * What the drawing reads comes from `rowGraph` in vc — every cell walked, each entity once, ends the
 * rows never returned added as marked placeholders — so the view and any test agree on what a
 * result holds.
 */
const d3_force_1 = require("d3-force");
const react_1 = __importStar(require("react"));
/* Past this the picture is a hairball, and laying it out starts to cost a visible pause. The table
 * still holds every row; the view says what it left out. */
const MAX_NODES = 300;
const RADIUS = 14;
const TICKS = 300;
const PADDING = 48;
/* The smallest area a drawing is fitted into. Without it two nodes fill the panel, and their labels —
 * sized in the drawing's own units — grow to headline size and run into each other. */
const MIN_WIDTH = 640;
const MIN_HEIGHT = 380;
/* Long enough that a relationship's type fits between the two captions it joins. */
const LINK_DISTANCE = 170;
const LABEL_OFFSET = 9;
/** Same label, same colour, across runs: a hash of the label picks one of the theme's six inks. */
function kind(node) {
    const label = node.labels[0] ?? '';
    let hash = 0;
    for (const ch of label)
        hash = (hash * 31 + ch.charCodeAt(0)) | 0;
    return Math.abs(hash) % 6;
}
/*
 * Two relationships between the same pair would be drawn on top of each other and read as one, so
 * each gets its own bend, fanned either side of the straight line.
 */
function bends(edges) {
    const pairOf = (e) => [e.source, e.target].sort().join('\u0000');
    const counts = new Map();
    edges.forEach((e) => counts.set(pairOf(e), (counts.get(pairOf(e)) ?? 0) + 1));
    const seen = new Map();
    return edges.map((e) => {
        const pair = pairOf(e);
        const index = seen.get(pair) ?? 0;
        seen.set(pair, index + 1);
        const total = counts.get(pair) ?? 1;
        return { ...e, bend: (index - (total - 1) / 2) * 34 };
    });
}
function layout(graph) {
    const nodes = graph.nodes.slice(0, MAX_NODES);
    const kept = new Set(nodes.map((n) => n.id));
    const edges = graph.edges.filter((e) => kept.has(e.source) && kept.has(e.target));
    const placed = nodes.map((node) => ({ node }));
    const simulation = (0, d3_force_1.forceSimulation)(placed)
        .force('link', (0, d3_force_1.forceLink)(edges.map((e) => ({ source: e.source, target: e.target })))
        .id((d) => d.node.id).distance(LINK_DISTANCE))
        .force('charge', (0, d3_force_1.forceManyBody)().strength(-320))
        .force('center', (0, d3_force_1.forceCenter)(0, 0))
        .force('collide', (0, d3_force_1.forceCollide)(RADIUS * 2.6))
        .stop();
    for (let i = 0; i < TICKS; i++)
        simulation.tick();
    const xs = placed.map((p) => p.x);
    const ys = placed.map((p) => p.y);
    const [left, right, top, bottom] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
    const width = Math.max(right - left + 2 * PADDING, MIN_WIDTH);
    const height = Math.max(bottom - top + 2 * PADDING, MIN_HEIGHT);
    return {
        placed: new Map(placed.map((p) => [p.node.id, p])),
        edges: bends(edges),
        // Centred on the drawing, so a small graph sits in the middle of the panel at its own size.
        box: { x: (left + right - width) / 2, y: (top + bottom - height) / 2, width, height },
    };
}
/** The edge's path, its label's position, and an end pulled back to the target's rim for the arrow. */
function edgeGeometry(from, to, bend) {
    if (from === to) {
        const r = RADIUS;
        return {
            d: `M ${from.x - r / 2} ${from.y - r} C ${from.x - r * 3} ${from.y - r * 4}, ${from.x + r * 3} ${from.y - r * 4}, ${from.x + r / 2} ${from.y - r}`,
            lx: from.x,
            ly: from.y - r * 3.4,
        };
    }
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const length = Math.hypot(dx, dy) || 1;
    const cx = (from.x + to.x) / 2 - (dy / length) * bend;
    const cy = (from.y + to.y) / 2 + (dx / length) * bend;
    const tx = to.x - cx;
    const ty = to.y - cy;
    const tl = Math.hypot(tx, ty) || 1;
    const ex = to.x - (tx / tl) * (RADIUS + 3);
    const ey = to.y - (ty / tl) * (RADIUS + 3);
    // The label sits just off the line, on the side it bends to, so it never strikes through the edge.
    const side = bend < 0 ? -1 : 1;
    const lx = (from.x + 2 * cx + to.x) / 4 - (dy / length) * LABEL_OFFSET * side;
    const ly = (from.y + 2 * cy + to.y) / 4 + (dx / length) * LABEL_OFFSET * side;
    return { d: `M ${from.x} ${from.y} Q ${cx} ${cy} ${ex} ${ey}`, lx, ly };
}
const show = (value) => value == null ? '' : typeof value === 'object' ? JSON.stringify(value) : String(value);
function ResultGraph({ graph }) {
    const drawn = (0, react_1.useMemo)(() => layout(graph), [graph]);
    const [selected, setSelected] = (0, react_1.useState)(null);
    const picked = selected ? graph.nodes.find((n) => n.id === selected) ?? null : null;
    const omitted = graph.nodes.length - drawn.placed.size;
    const { box } = drawn;
    return ((0, jsx_runtime_1.jsxs)("div", { className: "resultgraph", children: [(0, jsx_runtime_1.jsxs)("svg", { className: "resultgraph-canvas", viewBox: `${box.x} ${box.y} ${box.width} ${box.height}`, role: "img", "aria-label": `${graph.nodes.length} node(s) and ${graph.edges.length} relationship(s)`, onClick: () => setSelected(null), children: [(0, jsx_runtime_1.jsx)("defs", { children: (0, jsx_runtime_1.jsx)("marker", { id: "resultgraph-arrow", viewBox: "0 0 10 10", refX: "9", refY: "5", markerWidth: "7", markerHeight: "7", orient: "auto-start-reverse", children: (0, jsx_runtime_1.jsx)("path", { d: "M 0 0 L 10 5 L 0 10 z", className: "resultgraph-arrowhead" }) }) }), drawn.edges.map((edge) => {
                        const from = drawn.placed.get(edge.source);
                        const to = drawn.placed.get(edge.target);
                        if (!from || !to)
                            return null;
                        const { d, lx, ly } = edgeGeometry(from, to, edge.bend);
                        return ((0, jsx_runtime_1.jsxs)("g", { className: "resultgraph-edge", children: [(0, jsx_runtime_1.jsx)("title", { children: edge.type }), (0, jsx_runtime_1.jsx)("path", { d: d, markerEnd: "url(#resultgraph-arrow)" }), edge.type && (0, jsx_runtime_1.jsx)("text", { x: lx, y: ly, textAnchor: "middle", children: edge.type })] }, edge.id));
                    }), [...drawn.placed.values()].map(({ node, x, y }) => ((0, jsx_runtime_1.jsxs)("g", { className: `resultgraph-node k${kind(node)}${node.placeholder ? ' is-placeholder' : ''}${selected === node.id ? ' is-selected' : ''}`, transform: `translate(${x} ${y})`, onClick: (e) => { e.stopPropagation(); setSelected(node.id); }, children: [(0, jsx_runtime_1.jsx)("title", { children: node.placeholder
                                    ? 'Named by a relationship in the rows; the query did not return this node itself'
                                    : `${node.labels.join(':')}${node.caption && node.caption !== node.labels[0] ? ` — ${node.caption}` : ''}` }), (0, jsx_runtime_1.jsx)("circle", { r: RADIUS }), !node.placeholder && (0, jsx_runtime_1.jsx)("text", { y: RADIUS + 13, textAnchor: "middle", children: node.caption.length > 28 ? `${node.caption.slice(0, 27)}…` : node.caption })] }, node.id)))] }), (0, jsx_runtime_1.jsx)("div", { className: "resultgraph-foot", children: picked ? ((0, jsx_runtime_1.jsxs)("div", { className: "resultgraph-detail", children: [(0, jsx_runtime_1.jsx)("strong", { children: picked.placeholder ? 'Not returned' : picked.labels.map((l) => `:${l}`).join('') }), picked.placeholder
                            ? (0, jsx_runtime_1.jsx)("span", { className: "hint", children: " \u2014 a relationship in the rows ends here, but the query did not return the node. Return it to see its properties." })
                            : ((0, jsx_runtime_1.jsx)("div", { className: "resultgraph-props", children: Object.entries(picked.properties).map(([key, value]) => ((0, jsx_runtime_1.jsxs)(react_1.default.Fragment, { children: [(0, jsx_runtime_1.jsx)("span", { className: "resultgraph-prop", children: key }), (0, jsx_runtime_1.jsx)("span", { className: "resultgraph-value", children: show(value) })] }, key))) }))] })) : ((0, jsx_runtime_1.jsxs)("span", { className: "hint", children: [graph.nodes.length, " node(s), ", graph.edges.length, " relationship(s). Click a node for its properties.", omitted > 0 && ` Showing the first ${MAX_NODES}; the table has every row.`] })) })] }));
}
//# sourceMappingURL=ResultGraph.js.map