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

import React, { useCallback, useEffect, useState } from 'react'
import { coveragePercent, coverageWords, fillStatusWords, type Fill } from '../../../client/fills.ts'
import type { FillsSurfaceProps } from '../contracts.ts'
import { Status, StudioPanel, failureMessage, isAbsent } from '../studio/chrome.tsx'

/** A fill ticks every two minutes; polling faster than this only spends requests. */
const DEFAULT_REFRESH_MS = 30_000

const TONE: Record<string, string> = {
  complete: 'ok',
  cancelled: '',
  'polling, not progressing': 'caution',
  converging: 'ok',
  running: '',
}

function when(ms: number | null | undefined): string {
  if (!ms) return 'not yet'
  const date = new Date(ms)
  return Number.isNaN(date.getTime()) ? String(ms) : date.toLocaleString()
}

/**
 * The coverage of the last pass: a bar only where there is a denominator to draw one against.
 *
 * `aria-valuetext` carries the words rather than the number, because "4,182 assessed, total
 * unknown" is the whole content of the unknown case and a screen reader given only a percentage
 * would hear nothing at all.
 */
function Coverage({ fill }: { fill: Fill }) {
  const { coverage } = fill.progress
  const percent = coveragePercent(coverage)
  const words = coverageWords(coverage)
  return (
    <div className="fill-coverage">
      {percent === null ? (
        <span className="fill-coverage-unknown" aria-valuetext={words}>
          {words}
        </span>
      ) : (
        <>
          <div
            className="fill-bar"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={percent}
            aria-valuetext={words}
          >
            <div className="fill-bar-filled" style={{ width: `${percent}%` }} />
          </div>
          <span className="fill-coverage-words">{words}</span>
        </>
      )}
      <span className="fill-asof">as at {when(fill.progress.lastTickAt)}</span>
    </div>
  )
}

function FillRow({ fill, onCancel, busy }: { fill: Fill; onCancel(id: string): void; busy: boolean }) {
  const status = fillStatusWords(fill)
  const { lastError, state } = fill.progress
  return (
    <li className="fill-row">
      <div className="fill-head">
        <span className="fill-label">{fill.label || fill.id}</span>
        <Status tone={(TONE[status] ?? '') as never}>{status}</Status>
      </div>

      <Coverage fill={fill} />

      {/*
       * The warning is why a sweep polls rather than converges, and it stays put: it is a property
       * of how the realm declared its producers, not a transient event, so it reads as a note on
       * the row rather than something that flashed past.
       */}
      {fill.warning ? <p className="fill-warning">{fill.warning}</p> : null}

      {/*
       * A failed pass leaves the fill RUNNING on purpose — the next tick retries a source that may
       * have recovered. Saying "last failure" rather than "failed" is the difference between a
       * campaign that hit a bump and one that died.
       */}
      {lastError ? (
        <p className="fill-error">
          {state === 'RUNNING' ? 'Last failure (retrying): ' : 'Failed: '}
          {lastError}
        </p>
      ) : null}

      <details className="fill-details">
        <summary>Technical details</summary>
        <dl>
          <dt>Query</dt>
          <dd>
            <code>{fill.cypher}</code>
          </dd>
          <dt>Budget per tick</dt>
          <dd>{fill.budgetPerTick.toLocaleString()} units of paid work</dd>
          <dt>Live calls</dt>
          <dd>
            {fill.progress.liveCallsTotal.toLocaleString()} in total, {fill.progress.liveCallsLastTick.toLocaleString()}{' '}
            on the last pass
          </dd>
          <dt>Started</dt>
          <dd>{when(fill.progress.createdAt)}</dd>
        </dl>
      </details>

      {state === 'RUNNING' ? (
        <button type="button" className="fill-cancel" disabled={busy} onClick={() => onCancel(fill.id)}>
          Stop driving this
        </button>
      ) : null}
    </li>
  )
}

export function FillsSurface({ services, refreshMs = DEFAULT_REFRESH_MS }: FillsSurfaceProps) {
  const [fills, setFills] = useState<Fill[] | null>(null)
  const [problem, setProblem] = useState<string | null>(null)
  const [unsupported, setUnsupported] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)

  const load = useCallback(async () => {
    const outcome = await services.listFills()
    if (outcome.ok) {
      setFills(outcome.value)
      setProblem(null)
      setUnsupported(false)
      return
    }
    if (isAbsent(outcome)) {
      setUnsupported(true)
      return
    }
    setProblem(failureMessage(outcome, 'list the sweeps'))
  }, [services])

  useEffect(() => {
    void load()
    if (refreshMs <= 0) return
    const timer = setInterval(() => void load(), refreshMs)
    return () => clearInterval(timer)
  }, [load, refreshMs])

  const cancel = useCallback(
    async (id: string) => {
      setBusy(id)
      const outcome = await services.cancelFill(id)
      setBusy(null)
      if (!outcome.ok) {
        setProblem(failureMessage(outcome, 'stop that sweep'))
        return
      }
      await load()
    },
    [services, load],
  )

  if (unsupported) {
    return (
      <div className="kit-feature kit-feature-fills">
        <StudioPanel title="Sweeps">
          <p>This appliance does not drive sweeps yet.</p>
        </StudioPanel>
      </div>
    )
  }

  const running = (fills ?? []).filter((f) => f.progress.state === 'RUNNING')
  const settled = (fills ?? []).filter((f) => f.progress.state !== 'RUNNING')

  /* The root carries `kit-feature`, which is what the kit's feature stylesheet is scoped under. */
  return (
    <div className="kit-feature kit-feature-fills">
      <StudioPanel title="Sweeps">
        {problem ? <Status tone="error">{problem}</Status> : null}
        {fills === null ? <p>Looking…</p> : null}
        {fills !== null && fills.length === 0 ? (
          <p>No sweeps. One starts where a query is too expensive to answer in a request.</p>
        ) : null}

        {running.length > 0 ? (
          <ul className="fill-list">
            {running.map((fill) => (
              <FillRow key={fill.id} fill={fill} onCancel={cancel} busy={busy === fill.id} />
            ))}
          </ul>
        ) : null}

        {/* Finished and cancelled sweeps stay as the record: "what did I mine, and did it finish" is
            a question people come back with, and the mined data is still in the graph. */}
        {settled.length > 0 ? (
          <>
            <h3 className="fill-settled-heading">Finished</h3>
            <ul className="fill-list">
              {settled.map((fill) => (
                <FillRow key={fill.id} fill={fill} onCancel={cancel} busy={false} />
              ))}
            </ul>
          </>
        ) : null}
      </StudioPanel>
    </div>
  )
}
