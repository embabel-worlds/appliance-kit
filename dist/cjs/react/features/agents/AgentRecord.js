"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpcomingSection = UpcomingSection;
exports.RunsSection = RunsSection;
const jsx_runtime_1 = require("react/jsx-runtime");
/*
 * WHAT THIS AGENT WILL DO, AND WHAT IT DID (#1781), on its card.
 *
 * Upcoming is the scheduled work with when each piece fires, and the one say a person has over a
 * single firing — skip it, postpone it, run it now — without touching the schedule itself. Runs are
 * the record: each with how it ended, and opened, every decision the Gatekeeper made on its behalf
 * as a receipt, with the business records it named. "Show me what Steward did last week, and what it
 * will do tomorrow" is these two sections, one above the other.
 *
 * QUIET, for an agent that only talks: it has no schedule and its conversations are not runs, so
 * "Nothing scheduled" and "No runs yet" would be true every time and say nothing. Quiet, a section
 * draws only once it has something to show, and a load that fails still says so.
 */
const react_1 = require("react");
const chrome_tsx_1 = require("../studio/chrome.js");
function when(iso) {
    if (!iso)
        return '';
    const date = new Date(iso);
    return Number.isNaN(date.getTime()) ? iso : date.toLocaleString();
}
const OUTCOME_WORDS = {
    RUNNING: 'running', DONE: 'done', FAILED: 'failed', TIMED_OUT: 'timed out', SKIPPED: 'skipped',
};
function UpcomingSection({ name, services, quiet = false }) {
    const [upcoming, setUpcoming] = (0, react_1.useState)(null);
    const [problem, setProblem] = (0, react_1.useState)('');
    const [busy, setBusy] = (0, react_1.useState)(null);
    const load = (0, react_1.useCallback)(async () => {
        if (!services.upcoming)
            return;
        const result = await services.upcoming(name);
        if (!result.ok) {
            if (result.kind !== 'unsupported')
                setProblem((0, chrome_tsx_1.failureMessage)(result, 'load upcoming work'));
            return;
        }
        setProblem('');
        setUpcoming(result.value);
    }, [name, services]);
    (0, react_1.useEffect)(() => {
        void load();
    }, [load]);
    async function act(job, how) {
        setBusy(job);
        const later = how === 'postpone' ? new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString() : undefined;
        const result = how === 'run'
            ? await services.runFiringNow(name, job)
            : await services.skipFiring(name, job, how === 'postpone' ? 'postponed from the card' : 'skipped from the card', later);
        setBusy(null);
        if (!result.ok) {
            setProblem((0, chrome_tsx_1.failureMessage)(result, how === 'run' ? 'run it now' : how === 'skip' ? 'skip it' : 'postpone it'));
            return;
        }
        setProblem('');
        setUpcoming(result.value);
    }
    if (!services.upcoming)
        return null;
    if (quiet && !problem && !(upcoming && somethingUpcoming(upcoming)))
        return null;
    return ((0, jsx_runtime_1.jsxs)("div", { className: "agent-upcoming", children: [(0, jsx_runtime_1.jsx)("h3", { className: "caption", children: "Upcoming" }), problem && (0, jsx_runtime_1.jsx)(chrome_tsx_1.Status, { tone: "error", children: problem }), upcoming && upcoming.firings.length === 0 && upcoming.onSignals.length === 0 && ((0, jsx_runtime_1.jsx)("p", { className: "hint", children: "Nothing scheduled: an agent off duty has no checks or routines waiting to fire." })), upcoming && upcoming.firings.length > 0 && ((0, jsx_runtime_1.jsx)("ul", { className: "upcoming-list", children: upcoming.firings.map((f) => ((0, jsx_runtime_1.jsxs)("li", { className: "row", children: [(0, jsx_runtime_1.jsx)("span", { className: "upcoming-when", title: `${f.cron} (${f.zone})`, children: when(f.nextAt) }), (0, jsx_runtime_1.jsx)("span", { children: f.kind === 'duty' ? `check ${f.work}` : `run ${f.work}` }), f.skipped && (0, jsx_runtime_1.jsx)("span", { className: "agentrow-tag", children: f.postponedTo ? `postponed to ${when(f.postponedTo)}` : 'skipped' }), !f.skipped && services.skipFiring && ((0, jsx_runtime_1.jsxs)(jsx_runtime_1.Fragment, { children: [(0, jsx_runtime_1.jsx)("button", { className: "btn ghost tiny", disabled: busy === f.job, onClick: () => void act(f.job, 'skip'), children: "Skip" }), (0, jsx_runtime_1.jsx)("button", { className: "btn ghost tiny", disabled: busy === f.job, onClick: () => void act(f.job, 'postpone'), children: "Postpone 3h" })] })), services.runFiringNow && ((0, jsx_runtime_1.jsx)("button", { className: "btn ghost tiny", disabled: busy === f.job, onClick: () => void act(f.job, 'run'), children: "Run now" }))] }, f.job))) })), upcoming && upcoming.onSignals.length > 0 && (0, jsx_runtime_1.jsxs)("p", { className: "hint", children: ["Runs when something happens: ", upcoming.onSignals.join(', '), "."] }), upcoming?.expected.map((e) => ((0, jsx_runtime_1.jsxs)("p", { className: "hint", children: ["Its last check of ", e.duty, " found ", e.violations, " to repair; expect as many requests at the next one if nothing changes."] }, e.duty))), upcoming && upcoming.inFlight.length > 0 && ((0, jsx_runtime_1.jsxs)("p", { className: "hint", children: ["In flight: ", upcoming.inFlight.map((r) => `${r.work} (due by ${when(r.deadline)})`).join(', '), "."] })), upcoming && ((0, jsx_runtime_1.jsxs)("p", { className: "hint", children: [upcoming.counts.runsLastHour, " run", upcoming.counts.runsLastHour === 1 ? '' : 's', " in the last hour \u00B7", ' ', upcoming.counts.writesToday, " write", upcoming.counts.writesToday === 1 ? '' : 's', " and", ' ', upcoming.counts.requestsToday, " request", upcoming.counts.requestsToday === 1 ? '' : 's', " today"] }))] }));
}
/* Anything at all on the Upcoming record, counts included: a quiet card never hides real activity. */
function somethingUpcoming(u) {
    return u.firings.length > 0 || u.onSignals.length > 0 || u.expected.length > 0 || u.inFlight.length > 0
        || u.counts.runsLastHour > 0 || u.counts.writesToday > 0 || u.counts.requestsToday > 0;
}
function RunsSection({ name, services, quiet = false }) {
    const [runs, setRuns] = (0, react_1.useState)(null);
    const [problem, setProblem] = (0, react_1.useState)('');
    const [open, setOpen] = (0, react_1.useState)({});
    const load = (0, react_1.useCallback)(async () => {
        if (!services.listRuns)
            return;
        const result = await services.listRuns(name);
        if (!result.ok) {
            if (result.kind !== 'unsupported')
                setProblem((0, chrome_tsx_1.failureMessage)(result, 'load its runs'));
            return;
        }
        setProblem('');
        setRuns(result.value);
    }, [name, services]);
    (0, react_1.useEffect)(() => {
        void load();
    }, [load]);
    async function receipts(run) {
        if (open[run.id] || !services.getRun)
            return;
        const result = await services.getRun(name, run.id);
        if (result.ok)
            setOpen((all) => ({ ...all, [run.id]: result.value.receipts }));
    }
    if (!services.listRuns)
        return null;
    if (quiet && !problem && !(runs && runs.length > 0))
        return null;
    return ((0, jsx_runtime_1.jsxs)("div", { className: "agent-runs", children: [(0, jsx_runtime_1.jsxs)("div", { className: "row", children: [(0, jsx_runtime_1.jsx)("h3", { className: "caption", children: "Runs" }), (0, jsx_runtime_1.jsx)("button", { className: "btn ghost tiny", onClick: () => void load(), children: "Refresh" })] }), problem && (0, jsx_runtime_1.jsx)(chrome_tsx_1.Status, { tone: "error", children: problem }), runs && runs.length === 0 && (0, jsx_runtime_1.jsx)("p", { className: "hint", children: "No runs yet." }), runs && runs.length > 0 && ((0, jsx_runtime_1.jsx)("ol", { className: "run-list", children: runs.map((r) => ((0, jsx_runtime_1.jsx)("li", { children: (0, jsx_runtime_1.jsxs)("details", { onToggle: (e) => { if (e.target.open)
                            void receipts(r); }, children: [(0, jsx_runtime_1.jsxs)("summary", { className: "row", children: [(0, jsx_runtime_1.jsx)("span", { className: `run-outcome is-${r.outcome.toLowerCase()}`, children: OUTCOME_WORDS[r.outcome] }), (0, jsx_runtime_1.jsx)("span", { children: r.work }), (0, jsx_runtime_1.jsxs)("span", { className: "hint", children: [r.trigger, r.observing ? ' · observing' : '', r.agentVersion ? ` · v${r.agentVersion}` : ''] }), (0, jsx_runtime_1.jsx)("span", { className: "hint", children: when(r.startedAt) }), r.violations != null && (0, jsx_runtime_1.jsxs)("span", { className: "hint", children: [r.violations, " found, ", r.repairs ?? 0, " repaired"] }), r.requests.length > 0 && (0, jsx_runtime_1.jsxs)("span", { className: "hint", children: [r.requests.length, " request", r.requests.length === 1 ? '' : 's'] }), !!r.spendCents && (0, jsx_runtime_1.jsx)("span", { className: "hint", title: spendTitle(r), children: cents(r.spendCents) })] }), r.error && (0, jsx_runtime_1.jsx)("p", { className: "hint", children: r.error }), r.output && (0, jsx_runtime_1.jsx)("pre", { className: "run-output", children: r.output }), open[r.id] && (0, jsx_runtime_1.jsx)(Receipts, { receipts: open[r.id] ?? [] })] }) }, r.id))) }))] }));
}
/** Spend is recorded to the hundredth of a cent, because a single cheap call costs less than one. */
function cents(c) {
    return c >= 100 ? `$${(c / 100).toFixed(2)}` : `${c < 1 ? c.toFixed(2) : c.toFixed(1)}¢`;
}
function spendTitle(r) {
    return Object.entries(r.spendByModel ?? {}).map(([model, c]) => `${model}: ${cents(c)}`).join('\n');
}
function Receipts({ receipts }) {
    if (receipts.length === 0)
        return (0, jsx_runtime_1.jsx)("p", { className: "hint", children: "No decisions: it changed nothing." });
    return ((0, jsx_runtime_1.jsx)("ul", { className: "receipt-list", children: receipts.map((rc) => ((0, jsx_runtime_1.jsxs)("li", { title: rc.hash, children: [(0, jsx_runtime_1.jsx)("strong", { children: rc.decision }), " ", rc.verb, " \u2014 ", rc.reason, rc.decidedBy && ` (by ${rc.decidedBy})`, rc.entityKeys.length > 0 && (0, jsx_runtime_1.jsxs)("span", { className: "hint", children: [" \u00B7 ", rc.entityKeys.join(', ')] })] }, rc.id))) }));
}
//# sourceMappingURL=AgentRecord.js.map