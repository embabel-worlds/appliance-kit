"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FillsSurface = FillsSurface;
const jsx_runtime_1 = require("react/jsx-runtime");
/*
 * FILLS — the sweeps this appliance is driving, over hours or days (embabel/me#2693–2695).
 *
 * A fill is a standing object, not an event. Everything else that reports background work here is
 * built for "did that just work?" — a row per run, in memory, gone after a window. A three-day
 * sweep ticking every two minutes is ~2,160 of those rows, which is the flood a monitor exists to
 * prevent. So this is a ledger: one row per campaign, durable, saying how far it has got.
 *
 * TWO REFUSALS ARE LOAD-BEARING, and both are the server's, kept rather than undone:
 *
 *  - NO BAR WITHOUT A DENOMINATOR. An open-catalog sweep cannot say how much there is to do, and
 *    `coveragePercent` returns null rather than a number nobody measured. A bar that lies about a
 *    two-day job is worse than a count that admits what it does not know.
 *  - A READING, NOT A RUNNING TOTAL. Each tick REPLACES the figures with what that pass measured,
 *    so coverage can fall as well as rise — after a restart the in-memory tier of the producer
 *    cache is cold, so the first pass does more live work and the budget may cut it shorter. Hence
 *    "as at" the last tick, and no animation implying monotonic progress.
 *
 * `ticks` is deliberately never shown. It is the scheduler's heartbeat, not progress.
 */
const react_1 = require("react");
const fills_ts_1 = require("../../../client/fills.js");
const chrome_tsx_1 = require("../studio/chrome.js");
/** A fill ticks every two minutes; polling faster than this only spends requests. */
const DEFAULT_REFRESH_MS = 30_000;
const TONE = {
    complete: 'ok',
    cancelled: '',
    'polling, not progressing': 'caution',
    converging: 'ok',
    running: '',
};
function when(ms) {
    if (!ms)
        return 'not yet';
    const date = new Date(ms);
    return Number.isNaN(date.getTime()) ? String(ms) : date.toLocaleString();
}
/**
 * The coverage of the last pass: a bar only where there is a denominator to draw one against.
 *
 * `aria-valuetext` carries the words rather than the number, because "4,182 assessed, total
 * unknown" is the whole content of the unknown case and a screen reader given only a percentage
 * would hear nothing at all.
 */
function Coverage({ fill }) {
    const { coverage } = fill.progress;
    const percent = (0, fills_ts_1.coveragePercent)(coverage);
    const words = (0, fills_ts_1.coverageWords)(coverage);
    return ((0, jsx_runtime_1.jsxs)("div", { className: "fill-coverage", children: [percent === null ? ((0, jsx_runtime_1.jsx)("span", { className: "fill-coverage-unknown", "aria-valuetext": words, children: words })) : ((0, jsx_runtime_1.jsxs)(jsx_runtime_1.Fragment, { children: [(0, jsx_runtime_1.jsx)("div", { className: "fill-bar", role: "progressbar", "aria-valuemin": 0, "aria-valuemax": 100, "aria-valuenow": percent, "aria-valuetext": words, children: (0, jsx_runtime_1.jsx)("div", { className: "fill-bar-filled", style: { width: `${percent}%` } }) }), (0, jsx_runtime_1.jsx)("span", { className: "fill-coverage-words", children: words })] })), (0, jsx_runtime_1.jsxs)("span", { className: "fill-asof", children: ["as at ", when(fill.progress.lastTickAt)] })] }));
}
function FillRow({ fill, onCancel, busy }) {
    const status = (0, fills_ts_1.fillStatusWords)(fill);
    const { lastError, state } = fill.progress;
    return ((0, jsx_runtime_1.jsxs)("li", { className: "fill-row", children: [(0, jsx_runtime_1.jsxs)("div", { className: "fill-head", children: [(0, jsx_runtime_1.jsx)("span", { className: "fill-label", children: fill.label || fill.id }), (0, jsx_runtime_1.jsx)(chrome_tsx_1.Status, { tone: (TONE[status] ?? ''), children: status })] }), (0, jsx_runtime_1.jsx)(Coverage, { fill: fill }), fill.warning ? (0, jsx_runtime_1.jsx)("p", { className: "fill-warning", children: fill.warning }) : null, lastError ? ((0, jsx_runtime_1.jsxs)("p", { className: "fill-error", children: [state === 'RUNNING' ? 'Last failure (retrying): ' : 'Failed: ', lastError] })) : null, (0, jsx_runtime_1.jsxs)("details", { className: "fill-details", children: [(0, jsx_runtime_1.jsx)("summary", { children: "Technical details" }), (0, jsx_runtime_1.jsxs)("dl", { children: [(0, jsx_runtime_1.jsx)("dt", { children: "Query" }), (0, jsx_runtime_1.jsx)("dd", { children: (0, jsx_runtime_1.jsx)("code", { children: fill.cypher }) }), (0, jsx_runtime_1.jsx)("dt", { children: "Budget per tick" }), (0, jsx_runtime_1.jsxs)("dd", { children: [fill.budgetPerTick.toLocaleString(), " units of paid work"] }), (0, jsx_runtime_1.jsx)("dt", { children: "Live calls" }), (0, jsx_runtime_1.jsxs)("dd", { children: [fill.progress.liveCallsTotal.toLocaleString(), " in total, ", fill.progress.liveCallsLastTick.toLocaleString(), ' ', "on the last pass"] }), (0, jsx_runtime_1.jsx)("dt", { children: "Started" }), (0, jsx_runtime_1.jsx)("dd", { children: when(fill.progress.createdAt) })] })] }), state === 'RUNNING' ? ((0, jsx_runtime_1.jsx)("button", { type: "button", className: "fill-cancel", disabled: busy, onClick: () => onCancel(fill.id), children: "Stop driving this" })) : null] }));
}
function FillsSurface({ services, refreshMs = DEFAULT_REFRESH_MS }) {
    const [fills, setFills] = (0, react_1.useState)(null);
    const [problem, setProblem] = (0, react_1.useState)(null);
    const [unsupported, setUnsupported] = (0, react_1.useState)(false);
    const [busy, setBusy] = (0, react_1.useState)(null);
    const load = (0, react_1.useCallback)(async () => {
        const outcome = await services.listFills();
        if (outcome.ok) {
            setFills(outcome.value);
            setProblem(null);
            setUnsupported(false);
            return;
        }
        if ((0, chrome_tsx_1.isAbsent)(outcome)) {
            setUnsupported(true);
            return;
        }
        setProblem((0, chrome_tsx_1.failureMessage)(outcome, 'list the sweeps'));
    }, [services]);
    (0, react_1.useEffect)(() => {
        void load();
        if (refreshMs <= 0)
            return;
        const timer = setInterval(() => void load(), refreshMs);
        return () => clearInterval(timer);
    }, [load, refreshMs]);
    const cancel = (0, react_1.useCallback)(async (id) => {
        setBusy(id);
        const outcome = await services.cancelFill(id);
        setBusy(null);
        if (!outcome.ok) {
            setProblem((0, chrome_tsx_1.failureMessage)(outcome, 'stop that sweep'));
            return;
        }
        await load();
    }, [services, load]);
    if (unsupported) {
        return ((0, jsx_runtime_1.jsx)("div", { className: "kit-feature kit-feature-fills", children: (0, jsx_runtime_1.jsx)(chrome_tsx_1.StudioPanel, { title: "Sweeps", children: (0, jsx_runtime_1.jsx)("p", { children: "This appliance does not drive sweeps yet." }) }) }));
    }
    const running = (fills ?? []).filter((f) => f.progress.state === 'RUNNING');
    const settled = (fills ?? []).filter((f) => f.progress.state !== 'RUNNING');
    /* The root carries `kit-feature`, which is what the kit's feature stylesheet is scoped under. */
    return ((0, jsx_runtime_1.jsx)("div", { className: "kit-feature kit-feature-fills", children: (0, jsx_runtime_1.jsxs)(chrome_tsx_1.StudioPanel, { title: "Sweeps", children: [problem ? (0, jsx_runtime_1.jsx)(chrome_tsx_1.Status, { tone: "error", children: problem }) : null, fills === null ? (0, jsx_runtime_1.jsx)("p", { children: "Looking\u2026" }) : null, fills !== null && fills.length === 0 ? ((0, jsx_runtime_1.jsx)("p", { children: "No sweeps. One starts where a query is too expensive to answer in a request." })) : null, running.length > 0 ? ((0, jsx_runtime_1.jsx)("ul", { className: "fill-list", children: running.map((fill) => ((0, jsx_runtime_1.jsx)(FillRow, { fill: fill, onCancel: cancel, busy: busy === fill.id }, fill.id))) })) : null, settled.length > 0 ? ((0, jsx_runtime_1.jsxs)(jsx_runtime_1.Fragment, { children: [(0, jsx_runtime_1.jsx)("h3", { className: "fill-settled-heading", children: "Finished" }), (0, jsx_runtime_1.jsx)("ul", { className: "fill-list", children: settled.map((fill) => ((0, jsx_runtime_1.jsx)(FillRow, { fill: fill, onCancel: cancel, busy: false }, fill.id))) })] })) : null] }) }));
}
//# sourceMappingURL=FillsSurface.js.map