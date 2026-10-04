import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
/*
 * WHAT THIS AGENT WILL DO, AND WHAT IT DID (#1781), on its card.
 *
 * Upcoming is the scheduled work with when each piece fires, and the one say a person has over a
 * single firing — skip it, postpone it, run it now — without touching the schedule itself. Runs are
 * the record: each with how it ended, and opened, every decision the Gatekeeper made on its behalf
 * as a receipt, with the business records it named. "Show me what Steward did last week, and what it
 * will do tomorrow" is these two sections, one above the other.
 */
import { useCallback, useEffect, useState } from 'react';
import { Status, failureMessage } from "../studio/chrome.js";
function when(iso) {
    if (!iso)
        return '';
    const date = new Date(iso);
    return Number.isNaN(date.getTime()) ? iso : date.toLocaleString();
}
const OUTCOME_WORDS = {
    RUNNING: 'running', DONE: 'done', FAILED: 'failed', TIMED_OUT: 'timed out', SKIPPED: 'skipped',
};
export function UpcomingSection({ name, services }) {
    const [upcoming, setUpcoming] = useState(null);
    const [problem, setProblem] = useState('');
    const [busy, setBusy] = useState(null);
    const load = useCallback(async () => {
        if (!services.upcoming)
            return;
        const result = await services.upcoming(name);
        if (!result.ok) {
            if (result.kind !== 'unsupported')
                setProblem(failureMessage(result, 'load upcoming work'));
            return;
        }
        setProblem('');
        setUpcoming(result.value);
    }, [name, services]);
    useEffect(() => {
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
            setProblem(failureMessage(result, how === 'run' ? 'run it now' : how === 'skip' ? 'skip it' : 'postpone it'));
            return;
        }
        setProblem('');
        setUpcoming(result.value);
    }
    if (!services.upcoming)
        return null;
    return (_jsxs("div", { className: "agent-upcoming", children: [_jsx("h3", { className: "caption", children: "Upcoming" }), problem && _jsx(Status, { tone: "error", children: problem }), upcoming && upcoming.firings.length === 0 && upcoming.onSignals.length === 0 && (_jsx("p", { className: "hint", children: "Nothing scheduled: an agent off duty has no checks or routines waiting to fire." })), upcoming && upcoming.firings.length > 0 && (_jsx("ul", { className: "upcoming-list", children: upcoming.firings.map((f) => (_jsxs("li", { className: "row", children: [_jsx("span", { className: "upcoming-when", title: `${f.cron} (${f.zone})`, children: when(f.nextAt) }), _jsx("span", { children: f.kind === 'duty' ? `check ${f.work}` : `run ${f.work}` }), f.skipped && _jsx("span", { className: "agentrow-tag", children: f.postponedTo ? `postponed to ${when(f.postponedTo)}` : 'skipped' }), !f.skipped && services.skipFiring && (_jsxs(_Fragment, { children: [_jsx("button", { className: "btn ghost tiny", disabled: busy === f.job, onClick: () => void act(f.job, 'skip'), children: "Skip" }), _jsx("button", { className: "btn ghost tiny", disabled: busy === f.job, onClick: () => void act(f.job, 'postpone'), children: "Postpone 3h" })] })), services.runFiringNow && (_jsx("button", { className: "btn ghost tiny", disabled: busy === f.job, onClick: () => void act(f.job, 'run'), children: "Run now" }))] }, f.job))) })), upcoming && upcoming.onSignals.length > 0 && _jsxs("p", { className: "hint", children: ["Runs when something happens: ", upcoming.onSignals.join(', '), "."] }), upcoming?.expected.map((e) => (_jsxs("p", { className: "hint", children: ["Its last check of ", e.duty, " found ", e.violations, " to repair; expect as many requests at the next one if nothing changes."] }, e.duty))), upcoming && upcoming.inFlight.length > 0 && (_jsxs("p", { className: "hint", children: ["In flight: ", upcoming.inFlight.map((r) => `${r.work} (due by ${when(r.deadline)})`).join(', '), "."] })), upcoming && (_jsxs("p", { className: "hint", children: [upcoming.counts.runsLastHour, " run", upcoming.counts.runsLastHour === 1 ? '' : 's', " in the last hour \u00B7", ' ', upcoming.counts.writesToday, " write", upcoming.counts.writesToday === 1 ? '' : 's', " and", ' ', upcoming.counts.requestsToday, " request", upcoming.counts.requestsToday === 1 ? '' : 's', " today"] }))] }));
}
export function RunsSection({ name, services }) {
    const [runs, setRuns] = useState(null);
    const [problem, setProblem] = useState('');
    const [open, setOpen] = useState({});
    const load = useCallback(async () => {
        if (!services.listRuns)
            return;
        const result = await services.listRuns(name);
        if (!result.ok) {
            if (result.kind !== 'unsupported')
                setProblem(failureMessage(result, 'load its runs'));
            return;
        }
        setProblem('');
        setRuns(result.value);
    }, [name, services]);
    useEffect(() => {
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
    return (_jsxs("div", { className: "agent-runs", children: [_jsxs("div", { className: "row", children: [_jsx("h3", { className: "caption", children: "Runs" }), _jsx("button", { className: "btn ghost tiny", onClick: () => void load(), children: "Refresh" })] }), problem && _jsx(Status, { tone: "error", children: problem }), runs && runs.length === 0 && _jsx("p", { className: "hint", children: "No runs yet." }), runs && runs.length > 0 && (_jsx("ol", { className: "run-list", children: runs.map((r) => (_jsx("li", { children: _jsxs("details", { onToggle: (e) => { if (e.target.open)
                            void receipts(r); }, children: [_jsxs("summary", { className: "row", children: [_jsx("span", { className: `run-outcome is-${r.outcome.toLowerCase()}`, children: OUTCOME_WORDS[r.outcome] }), _jsx("span", { children: r.work }), _jsxs("span", { className: "hint", children: [r.trigger, r.observing ? ' · observing' : '', r.agentVersion ? ` · v${r.agentVersion}` : ''] }), _jsx("span", { className: "hint", children: when(r.startedAt) }), r.violations != null && _jsxs("span", { className: "hint", children: [r.violations, " found, ", r.repairs ?? 0, " repaired"] }), r.requests.length > 0 && _jsxs("span", { className: "hint", children: [r.requests.length, " request", r.requests.length === 1 ? '' : 's'] }), !!r.spendCents && _jsx("span", { className: "hint", title: spendTitle(r), children: cents(r.spendCents) })] }), r.error && _jsx("p", { className: "hint", children: r.error }), r.output && _jsx("pre", { className: "run-output", children: r.output }), open[r.id] && _jsx(Receipts, { receipts: open[r.id] ?? [] })] }) }, r.id))) }))] }));
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
        return _jsx("p", { className: "hint", children: "No decisions: it changed nothing." });
    return (_jsx("ul", { className: "receipt-list", children: receipts.map((rc) => (_jsxs("li", { title: rc.hash, children: [_jsx("strong", { children: rc.decision }), " ", rc.verb, " \u2014 ", rc.reason, rc.decidedBy && ` (by ${rc.decidedBy})`, rc.entityKeys.length > 0 && _jsxs("span", { className: "hint", children: [" \u00B7 ", rc.entityKeys.join(', ')] })] }, rc.id))) }));
}
//# sourceMappingURL=AgentRecord.js.map