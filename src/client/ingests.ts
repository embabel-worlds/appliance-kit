import type { Failure, Outcome } from './outcome.ts'

/*
 * FOLLOWING AN INGEST, RATHER THAN WAITING FOR ONE.
 *
 * An ingest used to be one request held open until the document was converted, chunked, embedded
 * and written. A client holding it could not tell a book queued behind two others from an appliance
 * that had died, so it waited a fixed time and then guessed: five minutes failed books that landed
 * a minute later (appliance-kit#16), and an hour is still a guess. The appliance now answers an
 * ingest at once with a JOB, and says where the job has got; this follows it.
 *
 * NO DEADLINE. A job ends when the appliance says it ended — succeeded or failed, in its own words
 * — or when the appliance no longer knows it, which is what a restart looks like from here. Time
 * alone never fails a job: a slow book is slow, not broken. What time CAN say is that nothing has
 * moved for a while, and that is reported as `stalled` for a person to judge, never acted on.
 *
 * NOT REACHABLE IS NOT AN ANSWER. A poll that fails to reach the appliance, or gets a 5xx, says
 * nothing about the job — the network blinked, or the appliance is mid-restart. So it is retried,
 * with backoff, for as long as the caller keeps following.
 *
 * A RESTART IS SURVIVABLE. An appliance that keeps its jobs durably picks them up again when it
 * comes back, under the same id, and counts it in `resumes`: the job answers again — often from an
 * earlier stage — and following simply carries on. Only an appliance that did not keep the job
 * answers `lost`.
 */

export type IngestJobState =
  | 'queued'
  /** Admitted in principle, waiting for the ingest heap budget to have room (embabel/me#1681). */
  | 'waiting_for_memory'
  | 'converting'
  | 'embedding'
  | 'writing'
  | 'succeeded'
  | 'failed'

export interface IngestJob {
  id: string
  /** The filename or URL this job is ingesting — what a person recognises it by. */
  name: string
  state: IngestJobState
  /** Units done of a known total, for a stage that has one (embedding counts chunks). Null otherwise. */
  progress: { done: number; total: number } | null
  /** Set once the appliance knows it — the stored document's identity. */
  uri?: string | null
  title?: string | null
  /** The appliance's own sentence for why a `failed` job failed. */
  error?: string | null
  /**
   * On a `succeeded` job, how many chunks the document was cut into, and how many of those could
   * not be embedded. A document with chunks it could not embed is still ingested — it is kept, not
   * failed — but those chunks miss semantic search, so a client should say so rather than draw it
   * as done. {@link DocumentsClient.startEmbedMissing} embeds them. Absent from an older appliance.
   */
  chunks?: number | null
  chunksWithoutEmbeddings?: number | null
  /**
   * How many appliance restarts this job has survived: it was picked up again, under the same id,
   * and may have gone back to an earlier stage. Absent from an appliance that does not keep jobs
   * across a restart — there a restart makes the job `lost` instead.
   */
  resumes?: number
  startedAt: string
  /** When the appliance last saw this job move: a stage change or a progress tick. */
  updatedAt: string
}

/** How a followed ingest ended. Never an exception: a lost job is an answer, not an error. */
export type IngestResult =
  | { outcome: 'succeeded'; job: IngestJob }
  | { outcome: 'failed'; job: IngestJob }
  /**
   * The appliance no longer knows the job — it restarted, or never had it. Whether the document
   * landed is then unknown, which is why this is not reported as a failure: check the listing
   * before sending it again.
   */
  | { outcome: 'lost'; id: string; message: string; last: IngestJob | null }
  /** The caller stopped following. The job itself carries on in the appliance. */
  | { outcome: 'aborted'; id: string; last: IngestJob | null }

/** One observation while following, for a caller drawing a progress row. */
export interface IngestFollowUpdate {
  /** The newest state the appliance reported. Null until the first poll answers. */
  job: IngestJob | null
  /**
   * Why the latest poll got no answer about the job — unreachable, a 5xx, or a lapsed sign-in — when
   * it did not. Cleared by the next answer.
   */
  unreachable: Failure | null
  /** Nothing has moved for `stalledAfterMs`. Informational: following carries on. */
  stalled: boolean
  /**
   * The appliance restarted while this was being followed and picked the job up again: its
   * `resumes` rose since following began. Stays true once seen, so a row can keep saying so.
   */
  resumed: boolean
}

export interface FollowIngestOptions {
  onUpdate?: (update: IngestFollowUpdate) => void
  signal?: AbortSignal
  /** Between polls while the appliance answers. */
  pollMs?: number
  /** How long a job may go unchanged before it is reported `stalled`. */
  stalledAfterMs?: number
}

export const DEFAULT_INGEST_POLL_MS = 2_000
/** Ten minutes: longer than any single stage a large book has been measured to sit in without a tick. */
export const DEFAULT_INGEST_STALLED_AFTER_MS = 600_000
/** The ceiling on backoff while the appliance is unreachable: a restart takes about thirty seconds. */
const MAX_BACKOFF_MS = 30_000

/** Resolves after `ms`, or at once when `signal` aborts — never leaves a timer behind. */
function pause(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal?.aborted) return resolve()
    const done = () => {
      clearTimeout(timer)
      signal?.removeEventListener('abort', done)
      resolve()
    }
    const timer = setTimeout(done, ms)
    signal?.addEventListener('abort', done, { once: true })
  })
}

/** The fields that say a job moved. `updatedAt` alone would do, if every appliance stamped it. */
const movement = (job: IngestJob) =>
  `${job.state}|${job.updatedAt}|${job.progress?.done ?? ''}/${job.progress?.total ?? ''}|${job.resumes ?? 0}`

/**
 * A poll's failure that means the appliance does not know this job. A documented 404 is `refused`;
 * a route the appliance no longer has is `unsupported` — the job cannot be followed there either.
 */
const jobIsGone = (failure: Failure) =>
  failure.kind === 'unsupported' || (failure.kind === 'refused' && failure.status === 404)

/** Follow job `id` through `read` until it ends. See the file comment for what ends it. */
export async function followIngest(
  id: string,
  read: (id: string) => Promise<Outcome<IngestJob>>,
  options: FollowIngestOptions = {},
): Promise<IngestResult> {
  const pollMs = options.pollMs ?? DEFAULT_INGEST_POLL_MS
  const stalledAfterMs = options.stalledAfterMs ?? DEFAULT_INGEST_STALLED_AFTER_MS
  const { signal, onUpdate } = options
  let last: IngestJob | null = null
  let seen = ''
  let movedAt = Date.now()
  let misses = 0
  // The restarts the job had already survived when following began; more than that is a resume seen here.
  let resumesAtStart: number | null = null
  let resumed = false

  while (!signal?.aborted) {
    const outcome = await read(id)
    if (signal?.aborted) break
    if (outcome.ok) {
      misses = 0
      const job = outcome.value
      last = job
      resumesAtStart ??= job.resumes ?? 0
      if ((job.resumes ?? 0) > resumesAtStart) resumed = true
      const now = movement(job)
      if (now !== seen) {
        seen = now
        movedAt = Date.now()
      }
      if (job.state === 'succeeded' || job.state === 'failed') {
        onUpdate?.({ job, unreachable: null, stalled: false, resumed })
        return { outcome: job.state, job }
      }
      onUpdate?.({ job, unreachable: null, stalled: Date.now() - movedAt >= stalledAfterMs, resumed })
      await pause(pollMs, signal)
    } else if (jobIsGone(outcome)) {
      return { outcome: 'lost', id, message: outcome.message, last }
    } else {
      misses += 1
      onUpdate?.({
        job: last,
        unreachable: outcome,
        stalled: last !== null && Date.now() - movedAt >= stalledAfterMs,
        resumed,
      })
      await pause(Math.min(pollMs * 2 ** misses, MAX_BACKOFF_MS), signal)
    }
  }
  return { outcome: 'aborted', id, last }
}
