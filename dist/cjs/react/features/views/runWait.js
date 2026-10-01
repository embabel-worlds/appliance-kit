"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cancelRun = cancelRun;
exports.RunWait = RunWait;
const jsx_runtime_1 = require("react/jsx-runtime");
/*
 * WAITING ON A VIEW, AND CALLING IT OFF.
 *
 * A view run is one POST that answers when the engine is done, and a cold view can take minutes.
 * Until this existed the surface said "running…" for the whole of that and then, at the client's
 * deadline, that the appliance had not answered — with the run still going on the appliance and
 * nothing on screen able to stop it.
 *
 * Cancelling is the engine's own kill: cooperative, checked between steps, and it KEEPS the work
 * already materialized. The POST stays open and answers with the typed KILLED outcome, which is
 * where "Cancelled" comes from — the kill response only says the request was accepted.
 */
const react_1 = require("react");
const outcome_ts_1 = require("../../../client/outcome.js");
const format_ts_1 = require("../../../studio-kit/format.js");
const chrome_tsx_1 = require("../studio/chrome.js");
/** How long a run goes unremarked. Past this, "running…" stops being an answer. */
const QUIET_MS = 5000;
/**
 * THE RUN TO KILL, WHEN THE TRACE NEVER NAMED ONE — no trace given, or its connection landed after
 * `query.started`. `runs` is the appliance's own account of what this user has in flight. An edited
 * query is matched on its text; a saved view is expanded on the appliance, so its text is not ours
 * to match and the only safe answer is the run that is alone. Several candidates cancel nothing:
 * the wrong guess stops somebody's other query.
 */
async function inFlightRunId(kg, draft) {
    if (!kg.runs)
        return null;
    const outcome = await kg.runs();
    if (!(0, outcome_ts_1.isOk)(outcome))
        return null;
    const sameText = draft ? outcome.value.filter((run) => run.cypher.trim() === draft.trim()) : [];
    const candidates = sameText.length ? sameText : outcome.value;
    return candidates.length === 1 ? candidates[0].runId : null;
}
async function cancelRun(kg, boundRunId, draft) {
    if (!kg.kill)
        return { accepted: false, text: 'This host cannot cancel a run.' };
    const runId = boundRunId ?? (await inFlightRunId(kg, draft));
    if (!runId)
        return { accepted: false, text: 'No single running query could be matched to this one, so nothing was cancelled.' };
    const outcome = await kg.kill(runId);
    if (!(0, outcome_ts_1.isOk)(outcome))
        return { accepted: false, text: (0, chrome_tsx_1.failureMessage)(outcome, 'cancel the run') };
    return outcome.value.killed
        ? { accepted: true }
        : { accepted: false, text: 'Cancel was not confirmed — the run may already have finished.' };
}
/** Whole seconds: a clock that ticks once a second has no tenths to show. */
function waited(ms) {
    const seconds = Math.floor(ms / 1000);
    return seconds < 60 ? `${seconds} s` : (0, format_ts_1.formatDuration)(seconds * 1000);
}
/**
 * How long there has been no result, and the last thing the engine reported doing.
 *
 * Its own component so the once-a-second tick re-renders one line rather than the whole surface.
 * NOT a live region: a status that changes every second would be read out every second.
 */
function RunWait({ startedAt, lastStep }) {
    const [now, setNow] = (0, react_1.useState)(() => performance.now());
    (0, react_1.useEffect)(() => {
        const timer = setInterval(() => setNow(performance.now()), 1000);
        return () => clearInterval(timer);
    }, []);
    const elapsed = now - startedAt;
    return ((0, jsx_runtime_1.jsxs)("div", { className: "status viewrun-wait", "aria-live": "off", children: [elapsed < QUIET_MS ? 'Running…' : `No result for ${waited(elapsed)}`, lastStep && (0, jsx_runtime_1.jsxs)("span", { className: "viewrun-step", children: [" \u00B7 last step: ", lastStep] })] }));
}
//# sourceMappingURL=runWait.js.map