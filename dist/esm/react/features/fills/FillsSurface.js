import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
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
import { useCallback, useEffect, useState } from 'react';
import { coveragePercent, coverageWords, fillStatusWords } from "../../../client/fills.js";
import { Status, StudioPanel, failureMessage, isAbsent } from "../studio/chrome.js";
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
    const percent = coveragePercent(coverage);
    const words = coverageWords(coverage);
    return (_jsxs("div", { className: "fill-coverage", children: [percent === null ? (_jsx("span", { className: "fill-coverage-unknown", "aria-valuetext": words, children: words })) : (_jsxs(_Fragment, { children: [_jsx("div", { className: "fill-bar", role: "progressbar", "aria-valuemin": 0, "aria-valuemax": 100, "aria-valuenow": percent, "aria-valuetext": words, children: _jsx("div", { className: "fill-bar-filled", style: { width: `${percent}%` } }) }), _jsx("span", { className: "fill-coverage-words", children: words })] })), _jsxs("span", { className: "fill-asof", children: ["as at ", when(fill.progress.lastTickAt)] })] }));
}
function FillRow({ fill, onCancel, busy }) {
    const status = fillStatusWords(fill);
    const { lastError, state } = fill.progress;
    return (_jsxs("li", { className: "fill-row", children: [_jsxs("div", { className: "fill-head", children: [_jsx("span", { className: "fill-label", children: fill.label || fill.id }), _jsx(Status, { tone: (TONE[status] ?? ''), children: status })] }), _jsx(Coverage, { fill: fill }), fill.warning ? _jsx("p", { className: "fill-warning", children: fill.warning }) : null, lastError ? (_jsxs("p", { className: "fill-error", children: [state === 'RUNNING' ? 'Last failure (retrying): ' : 'Failed: ', lastError] })) : null, _jsxs("details", { className: "fill-details", children: [_jsx("summary", { children: "Technical details" }), _jsxs("dl", { children: [_jsx("dt", { children: "Query" }), _jsx("dd", { children: _jsx("code", { children: fill.cypher }) }), _jsx("dt", { children: "Budget per tick" }), _jsxs("dd", { children: [fill.budgetPerTick.toLocaleString(), " units of paid work"] }), _jsx("dt", { children: "Live calls" }), _jsxs("dd", { children: [fill.progress.liveCallsTotal.toLocaleString(), " in total, ", fill.progress.liveCallsLastTick.toLocaleString(), ' ', "on the last pass"] }), _jsx("dt", { children: "Started" }), _jsx("dd", { children: when(fill.progress.createdAt) })] })] }), state === 'RUNNING' ? (_jsx("button", { type: "button", className: "fill-cancel", disabled: busy, onClick: () => onCancel(fill.id), children: "Stop driving this" })) : null] }));
}
export function FillsSurface({ services, refreshMs = DEFAULT_REFRESH_MS }) {
    const [fills, setFills] = useState(null);
    const [problem, setProblem] = useState(null);
    const [unsupported, setUnsupported] = useState(false);
    const [busy, setBusy] = useState(null);
    const load = useCallback(async () => {
        const outcome = await services.listFills();
        if (outcome.ok) {
            setFills(outcome.value);
            setProblem(null);
            setUnsupported(false);
            return;
        }
        if (isAbsent(outcome)) {
            setUnsupported(true);
            return;
        }
        setProblem(failureMessage(outcome, 'list the sweeps'));
    }, [services]);
    useEffect(() => {
        void load();
        if (refreshMs <= 0)
            return;
        const timer = setInterval(() => void load(), refreshMs);
        return () => clearInterval(timer);
    }, [load, refreshMs]);
    const cancel = useCallback(async (id) => {
        setBusy(id);
        const outcome = await services.cancelFill(id);
        setBusy(null);
        if (!outcome.ok) {
            setProblem(failureMessage(outcome, 'stop that sweep'));
            return;
        }
        await load();
    }, [services, load]);
    if (unsupported) {
        return (_jsx("div", { className: "kit-feature kit-feature-fills", children: _jsx(StudioPanel, { title: "Sweeps", children: _jsx("p", { children: "This appliance does not drive sweeps yet." }) }) }));
    }
    const running = (fills ?? []).filter((f) => f.progress.state === 'RUNNING');
    const settled = (fills ?? []).filter((f) => f.progress.state !== 'RUNNING');
    /* The root carries `kit-feature`, which is what the kit's feature stylesheet is scoped under. */
    return (_jsx("div", { className: "kit-feature kit-feature-fills", children: _jsxs(StudioPanel, { title: "Sweeps", children: [problem ? _jsx(Status, { tone: "error", children: problem }) : null, fills === null ? _jsx("p", { children: "Looking\u2026" }) : null, fills !== null && fills.length === 0 ? (_jsx("p", { children: "No sweeps. One starts where a query is too expensive to answer in a request." })) : null, running.length > 0 ? (_jsx("ul", { className: "fill-list", children: running.map((fill) => (_jsx(FillRow, { fill: fill, onCancel: cancel, busy: busy === fill.id }, fill.id))) })) : null, settled.length > 0 ? (_jsxs(_Fragment, { children: [_jsx("h3", { className: "fill-settled-heading", children: "Finished" }), _jsx("ul", { className: "fill-list", children: settled.map((fill) => (_jsx(FillRow, { fill: fill, onCancel: cancel, busy: false }, fill.id))) })] })) : null] }) }));
}
//# sourceMappingURL=FillsSurface.js.map