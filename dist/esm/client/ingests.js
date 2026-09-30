export const DEFAULT_INGEST_POLL_MS = 2_000;
/** Ten minutes: longer than any single stage a large book has been measured to sit in without a tick. */
export const DEFAULT_INGEST_STALLED_AFTER_MS = 600_000;
/** The ceiling on backoff while the appliance is unreachable: a restart takes about thirty seconds. */
const MAX_BACKOFF_MS = 30_000;
/** Resolves after `ms`, or at once when `signal` aborts — never leaves a timer behind. */
function pause(ms, signal) {
    return new Promise((resolve) => {
        if (signal?.aborted)
            return resolve();
        const done = () => {
            clearTimeout(timer);
            signal?.removeEventListener('abort', done);
            resolve();
        };
        const timer = setTimeout(done, ms);
        signal?.addEventListener('abort', done, { once: true });
    });
}
/** The fields that say a job moved. `updatedAt` alone would do, if every appliance stamped it. */
const movement = (job) => `${job.state}|${job.updatedAt}|${job.progress?.done ?? ''}/${job.progress?.total ?? ''}|${job.resumes ?? 0}`;
/**
 * A poll's failure that means the appliance does not know this job. A documented 404 is `refused`;
 * a route the appliance no longer has is `unsupported` — the job cannot be followed there either.
 */
const jobIsGone = (failure) => failure.kind === 'unsupported' || (failure.kind === 'refused' && failure.status === 404);
/** Follow job `id` through `read` until it ends. See the file comment for what ends it. */
export async function followIngest(id, read, options = {}) {
    const pollMs = options.pollMs ?? DEFAULT_INGEST_POLL_MS;
    const stalledAfterMs = options.stalledAfterMs ?? DEFAULT_INGEST_STALLED_AFTER_MS;
    const { signal, onUpdate } = options;
    let last = null;
    let seen = '';
    let movedAt = Date.now();
    let misses = 0;
    // The restarts the job had already survived when following began; more than that is a resume seen here.
    let resumesAtStart = null;
    let resumed = false;
    while (!signal?.aborted) {
        const outcome = await read(id);
        if (signal?.aborted)
            break;
        if (outcome.ok) {
            misses = 0;
            const job = outcome.value;
            last = job;
            resumesAtStart ??= job.resumes ?? 0;
            if ((job.resumes ?? 0) > resumesAtStart)
                resumed = true;
            const now = movement(job);
            if (now !== seen) {
                seen = now;
                movedAt = Date.now();
            }
            if (job.state === 'succeeded' || job.state === 'failed') {
                onUpdate?.({ job, unreachable: null, stalled: false, resumed });
                return { outcome: job.state, job };
            }
            onUpdate?.({ job, unreachable: null, stalled: Date.now() - movedAt >= stalledAfterMs, resumed });
            await pause(pollMs, signal);
        }
        else if (jobIsGone(outcome)) {
            return { outcome: 'lost', id, message: outcome.message, last };
        }
        else {
            misses += 1;
            onUpdate?.({
                job: last,
                unreachable: outcome,
                stalled: last !== null && Date.now() - movedAt >= stalledAfterMs,
                resumed,
            });
            await pause(Math.min(pollMs * 2 ** misses, MAX_BACKOFF_MS), signal);
        }
    }
    return { outcome: 'aborted', id, last };
}
//# sourceMappingURL=ingests.js.map