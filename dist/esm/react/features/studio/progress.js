/*
 * THE LIVE TRACE OF A RUNNING QUERY.
 *
 * The host owns the authenticated transport and calls the subscriber with parsed events. Keeping
 * transport outside this hook lets each consumer use its own credential and connection policy.
 *
 * THE STREAM IS PER-USER, NOT PER-QUERY. Two windows open on the same appliance see each other's
 * runs. So the hook binds to the FIRST `query.started` it sees after the caller says a run began,
 * and ignores every event carrying a different `queryId` from then on. That is not perfect — two
 * windows starting a query in the same instant can still cross — but the server offers an
 * `operationId` for clients that supply one, and until `/execute` accepts it this is the honest
 * best available. It is a progress indicator; the cost of a wrong line is a confusing line, not a
 * wrong answer.
 *
 * The connection is opened when a run starts and closed when it ends, rather than held for the
 * life of the page: an idle SSE connection per open console is a real cost on the appliance, and
 * nothing is being narrated between runs.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { describeVcEvent, isTerminal } from "../../../vc/events.js";
/** How many lines to keep. A wide fan-out can emit hundreds; the recent ones are the interesting ones. */
const MAX_LINES = 200;
export function useRunProgress(subscribe) {
    const [lines, setLines] = useState([]);
    const [live, setLive] = useState(false);
    const [runId, setRunId] = useState(null);
    const abort = useRef(null);
    const boundQueryId = useRef(null);
    const close = useCallback(() => {
        abort.current?.abort();
        abort.current = null;
        boundQueryId.current = null;
        // The id goes with the stream. Keeping it past the run would arm a Stop button pointed at a
        // run that has already settled — a button that does nothing is worse than no button.
        setRunId(null);
    }, []);
    // A component unmounting mid-run must not leave the stream open.
    useEffect(() => close, [close]);
    const begin = useCallback((operationId) => {
        close();
        setLines([]);
        setLive(true);
        boundQueryId.current = null;
        const controller = new AbortController();
        abort.current = controller;
        const consume = (event) => {
            if (!event?.type)
                return;
            /*
             * TWO WAYS TO KNOW AN EVENT IS OURS, and the first one is better.
             *
             * With an operation id we asked for, the appliance stamps it on every event of that
             * operation: an exact match, and two windows asking at the same instant cannot cross.
             * Without one — `/kg/execute` takes no such header — the only available handle is the first
             * run to start after we began listening, which is a guess that a simultaneous run in another
             * window can beat. It is a progress panel; the cost of losing that race is a confusing line,
             * not a wrong answer.
             */
            if (operationId) {
                if (event.operationId !== operationId)
                    return;
            }
            else {
                // Bind to the first run that starts after we began listening, then ignore the rest.
                if (boundQueryId.current === null && event.queryId) {
                    boundQueryId.current = event.queryId;
                    setRunId(event.queryId);
                }
                if (event.queryId && event.queryId !== boundQueryId.current)
                    return;
            }
            setLines((current) => {
                const line = {
                    key: event.seq ?? current.length,
                    text: describeVcEvent(event),
                    failed: event.type === 'producer.error' || event.type === 'query.rejected',
                };
                const next = [...current, line];
                return next.length > MAX_LINES ? next.slice(-MAX_LINES) : next;
            });
            if (isTerminal(event)) {
                setLive(false);
                close();
            }
        };
        subscribe(consume, controller.signal);
    }, [close, subscribe]);
    const end = useCallback(() => {
        setLive(false);
        close();
    }, [close]);
    return { lines, live, runId, begin, end };
}
//# sourceMappingURL=progress.js.map