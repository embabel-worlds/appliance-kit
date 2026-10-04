/*
 * WHAT THIS AGENT WILL DO, AND WHAT IT DID (#1781), on its card.
 *
 * Upcoming is the scheduled work with when each piece fires, and the one say a person has over a
 * single firing — skip it, postpone it, run it now — without touching the schedule itself. Runs are
 * the record: each with how it ended, and opened, every decision the Gatekeeper made on its behalf
 * as a receipt, with the business records it named. "Show me what Steward did last week, and what it
 * will do tomorrow" is these two sections, one above the other.
 */

import React, { useCallback, useEffect, useState } from 'react'
import type { AgentRun, Receipt, RunOutcome, Upcoming } from '../../../client/agentRuns.ts'
import type { AgentsServices } from '../contracts.ts'
import { Status, failureMessage } from '../studio/chrome.tsx'

function when(iso: string | null): string {
  if (!iso) return ''
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleString()
}

const OUTCOME_WORDS: Record<RunOutcome, string> = {
  RUNNING: 'running', DONE: 'done', FAILED: 'failed', TIMED_OUT: 'timed out', SKIPPED: 'skipped',
}

export function UpcomingSection({ name, services }: { name: string; services: AgentsServices }) {
  const [upcoming, setUpcoming] = useState<Upcoming | null>(null)
  const [problem, setProblem] = useState('')
  const [busy, setBusy] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!services.upcoming) return
    const result = await services.upcoming(name)
    if (!result.ok) {
      if (result.kind !== 'unsupported') setProblem(failureMessage(result, 'load upcoming work'))
      return
    }
    setProblem('')
    setUpcoming(result.value)
  }, [name, services])

  useEffect(() => {
    void load()
  }, [load])

  async function act(job: string, how: 'skip' | 'postpone' | 'run') {
    setBusy(job)
    const later = how === 'postpone' ? new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString() : undefined
    const result = how === 'run'
      ? await services.runFiringNow!(name, job)
      : await services.skipFiring!(name, job, how === 'postpone' ? 'postponed from the card' : 'skipped from the card', later)
    setBusy(null)
    if (!result.ok) {
      setProblem(failureMessage(result, how === 'run' ? 'run it now' : how === 'skip' ? 'skip it' : 'postpone it'))
      return
    }
    setProblem('')
    setUpcoming(result.value)
  }

  if (!services.upcoming) return null
  return (
    <div className="agent-upcoming">
      <h3 className="caption">Upcoming</h3>
      {problem && <Status tone="error">{problem}</Status>}
      {upcoming && upcoming.firings.length === 0 && upcoming.onSignals.length === 0 && (
        <p className="hint">Nothing scheduled: an agent off duty has no checks or routines waiting to fire.</p>
      )}
      {upcoming && upcoming.firings.length > 0 && (
        <ul className="upcoming-list">
          {upcoming.firings.map((f) => (
            <li key={f.job} className="row">
              <span className="upcoming-when" title={`${f.cron} (${f.zone})`}>{when(f.nextAt)}</span>
              <span>{f.kind === 'duty' ? `check ${f.work}` : `run ${f.work}`}</span>
              {f.skipped && <span className="agentrow-tag">{f.postponedTo ? `postponed to ${when(f.postponedTo)}` : 'skipped'}</span>}
              {!f.skipped && services.skipFiring && (
                <>
                  <button className="btn ghost tiny" disabled={busy === f.job} onClick={() => void act(f.job, 'skip')}>Skip</button>
                  <button className="btn ghost tiny" disabled={busy === f.job} onClick={() => void act(f.job, 'postpone')}>Postpone 3h</button>
                </>
              )}
              {services.runFiringNow && (
                <button className="btn ghost tiny" disabled={busy === f.job} onClick={() => void act(f.job, 'run')}>Run now</button>
              )}
            </li>
          ))}
        </ul>
      )}
      {upcoming && upcoming.onSignals.length > 0 && <p className="hint">Runs when something happens: {upcoming.onSignals.join(', ')}.</p>}
      {upcoming?.expected.map((e) => (
        <p key={e.duty} className="hint">
          Its last check of {e.duty} found {e.violations} to repair; expect as many requests at the next one if nothing changes.
        </p>
      ))}
      {upcoming && upcoming.inFlight.length > 0 && (
        <p className="hint">In flight: {upcoming.inFlight.map((r) => `${r.work} (due by ${when(r.deadline)})`).join(', ')}.</p>
      )}
      {upcoming && (
        <p className="hint">
          {upcoming.counts.runsLastHour} run{upcoming.counts.runsLastHour === 1 ? '' : 's'} in the last hour ·{' '}
          {upcoming.counts.writesToday} write{upcoming.counts.writesToday === 1 ? '' : 's'} and{' '}
          {upcoming.counts.requestsToday} request{upcoming.counts.requestsToday === 1 ? '' : 's'} today
        </p>
      )}
    </div>
  )
}

export function RunsSection({ name, services }: { name: string; services: AgentsServices }) {
  const [runs, setRuns] = useState<AgentRun[] | null>(null)
  const [problem, setProblem] = useState('')
  const [open, setOpen] = useState<Record<string, Receipt[]>>({})

  const load = useCallback(async () => {
    if (!services.listRuns) return
    const result = await services.listRuns(name)
    if (!result.ok) {
      if (result.kind !== 'unsupported') setProblem(failureMessage(result, 'load its runs'))
      return
    }
    setProblem('')
    setRuns(result.value)
  }, [name, services])

  useEffect(() => {
    void load()
  }, [load])

  async function receipts(run: AgentRun) {
    if (open[run.id] || !services.getRun) return
    const result = await services.getRun(name, run.id)
    if (result.ok) setOpen((all) => ({ ...all, [run.id]: result.value.receipts }))
  }

  if (!services.listRuns) return null
  return (
    <div className="agent-runs">
      <div className="row">
        <h3 className="caption">Runs</h3>
        <button className="btn ghost tiny" onClick={() => void load()}>Refresh</button>
      </div>
      {problem && <Status tone="error">{problem}</Status>}
      {runs && runs.length === 0 && <p className="hint">No runs yet.</p>}
      {runs && runs.length > 0 && (
        <ol className="run-list">
          {runs.map((r) => (
            <li key={r.id}>
              <details onToggle={(e) => { if ((e.target as HTMLDetailsElement).open) void receipts(r) }}>
                <summary className="row">
                  <span className={`run-outcome is-${r.outcome.toLowerCase()}`}>{OUTCOME_WORDS[r.outcome]}</span>
                  <span>{r.work}</span>
                  <span className="hint">{r.trigger}{r.observing ? ' · observing' : ''}{r.agentVersion ? ` · v${r.agentVersion}` : ''}</span>
                  <span className="hint">{when(r.startedAt)}</span>
                  {r.violations != null && <span className="hint">{r.violations} found, {r.repairs ?? 0} repaired</span>}
                  {r.requests.length > 0 && <span className="hint">{r.requests.length} request{r.requests.length === 1 ? '' : 's'}</span>}
                </summary>
                {r.error && <p className="hint">{r.error}</p>}
                {r.output && <pre className="run-output">{r.output}</pre>}
                {open[r.id] && <Receipts receipts={open[r.id] ?? []} />}
              </details>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}

function Receipts({ receipts }: { receipts: Receipt[] }) {
  if (receipts.length === 0) return <p className="hint">No decisions: it changed nothing.</p>
  return (
    <ul className="receipt-list">
      {receipts.map((rc) => (
        <li key={rc.id} title={rc.hash}>
          <strong>{rc.decision}</strong> {rc.verb} — {rc.reason}
          {rc.decidedBy && ` (by ${rc.decidedBy})`}
          {rc.entityKeys.length > 0 && <span className="hint"> · {rc.entityKeys.join(', ')}</span>}
        </li>
      ))}
    </ul>
  )
}
