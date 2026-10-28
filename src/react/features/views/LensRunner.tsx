/*
 * LENSES — the world's judgments composed in code, run beside its views.
 *
 * A view is one query; a lens is a program over several (a briefing, a triage) that the appliance
 * runs by id with declared params. Until this, a lens could be run only from REST or an app; the
 * console listed views and nothing else. This is the Views window's second mode, laid out the same
 * way: every lens in a list on the left under one filter, the chosen one on the right with its
 * params, Run, and what the run answered.
 *
 * WHAT IS SHOWN IS THE ENVELOPE. `POST /lenses/{id}/invoke` answers the same redacted envelope MCP's
 * `lens_open` and an app's `embabel.lenses.invoke` get, and this panel draws it as it came: the
 * outcome in words (EMPTY is a real empty; SOURCE_UNAVAILABLE is not), the warnings, the error's own
 * safe message, and the data — a table when it is rows, the JSON when it is a typed payload.
 *
 * WAITING. The host may answer a RUNNING envelope instead of holding the request open; the panel
 * then polls the run by its handle, says how long there has been no result, and can cancel it.
 * Leaving a lens mid-run cancels the run without asking, as leaving a view does.
 */

import React, { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { isOk } from '../../../client/outcome.ts'
import { rowColumns } from '../../../vc/rows.ts'
import { formatDuration } from '../../../studio-kit/format.ts'
import type { LensDestination, LensEnvelope, LensParamSpec, LensServices, LensSummary, SavedViewsHost } from '../contracts.ts'
import { CopyButton, RowTable, Status, StudioPanel, failureMessage } from '../studio/chrome.tsx'
import { RunWait } from './runWait.tsx'

/** How often a RUNNING lens is asked whether it has finished. */
const POLL_MS = 1500

const NO_ROUTE = (): string | null => null

type Tone = 'ok' | 'error' | 'caution' | null

/** A blank field means "use the declared default"; a typed one is sent as its declared type. */
function argsFor(params: LensParamSpec[], values: Record<string, string>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [name, raw] of Object.entries(values)) {
    if (raw === '' || raw == null) continue
    const type = params.find((param) => param.name === name)?.type?.toUpperCase()
    const number = Number(raw)
    out[name] = type === 'INT' && raw.trim() !== '' && Number.isFinite(number) ? number
      : type === 'BOOLEAN' ? raw === 'true'
        : raw
  }
  return out
}

function defaultArgs(lens: LensSummary): Record<string, string> {
  return Object.fromEntries((lens.params ?? []).map((param) => [param.name, param.default == null ? '' : String(param.default)]))
}

/** The envelope's status line: what happened, in the outcome's own terms, with what it cost. */
function verdictOf(envelope: LensEnvelope): { tone: Tone; text: string } {
  const parts: string[] = []
  const cost = envelope.metrics
  if (cost?.durationMs != null) parts.push(formatDuration(cost.durationMs))
  if (cost?.externalCalls) parts.push(`${cost.externalCalls} external call(s)`)
  for (const warning of envelope.warnings ?? []) parts.push(warning.message)
  const tail = parts.length ? ` · ${parts.join(' · ')}` : ''
  if (envelope.status === 'CANCELLED') return { tone: 'caution', text: `Cancelled. ${envelope.error?.message ?? ''}`.trim() }
  if (envelope.status === 'FAILED' || envelope.error) {
    return { tone: 'error', text: `${envelope.outcome} — ${envelope.error?.message ?? 'The lens could not be run.'}${tail}` }
  }
  if (envelope.outcome === 'EMPTY') return { tone: null, text: `EMPTY — the lens ran and found nothing${tail}` }
  return { tone: (envelope.warnings ?? []).length || envelope.outcome !== 'OK' ? 'caution' : 'ok', text: `${envelope.outcome}${tail}` }
}

/** Rows when the payload is a list of records, which is what a table can show honestly. */
function rowsOf(data: unknown): Array<Record<string, unknown>> | null {
  if (!Array.isArray(data) || data.length === 0) return null
  return data.every((item) => item !== null && typeof item === 'object' && !Array.isArray(item))
    ? data as Array<Record<string, unknown>>
    : null
}

export function LensRunner({ services, host, modeSwitch }: {
  services: LensServices
  host: SavedViewsHost
  /** The Views | Lenses switch, drawn at the head of the list. */
  modeSwitch: React.ReactNode
}) {
  const [lenses, setLenses] = useState<LensSummary[] | null>(null)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState<string | null>(null)
  const [args, setArgs] = useState<Record<string, string>>({})
  const [filter, setFilter] = useState('')
  const [busy, setBusy] = useState(false)
  const [startedAt, setStartedAt] = useState<number | null>(null)
  const [cancelling, setCancelling] = useState(false)
  /** A run handle is held, so there is a run Cancel can name. */
  const [cancellable, setCancellable] = useState(false)
  const [envelope, setEnvelope] = useState<LensEnvelope | null>(null)
  const [status, setStatus] = useState<{ tone: Tone; text: string }>({ tone: null, text: '' })
  /* Refs, because a run awaits across renders: which run owns the screen, and its handle. */
  const generation = useRef(0)
  const runHandle = useRef<string | null>(null)

  const load = useCallback(async () => {
    const outcome = await services.list()
    if (!isOk(outcome)) return setError(failureMessage(outcome, 'list lenses'))
    setError('')
    setLenses([...outcome.value].sort((a, b) => a.name.localeCompare(b.name)))
  }, [services])
  useEffect(() => { void load() }, [load])

  const route = useSyncExternalStore(host.subscribeSelection, host.selectedLens ?? NO_ROUTE, host.selectedLens ?? NO_ROUTE)
  const drivenBy = useRef<string | null>('')

  /*
   * LEAVING A LENS MID-RUN cancels it, without asking: the answer would arrive for a lens nobody is
   * looking at. Its answer is disowned first, so a late reply cannot land on another lens.
   */
  function abandonRun(): void {
    generation.current += 1
    const handle = runHandle.current
    runHandle.current = null
    setBusy(false)
    setStartedAt(null)
    setCancelling(false)
    setCancellable(false)
    if (handle && services.kill) void services.kill(handle)
  }
  const abandonOnUnmount = useRef(abandonRun)
  abandonOnUnmount.current = abandonRun
  useEffect(() => () => abandonOnUnmount.current(), [])

  function apply(lens: LensSummary): void {
    abandonRun()
    setSelected(lens.id)
    setArgs(defaultArgs(lens))
    setEnvelope(null)
    setStatus({ tone: null, text: '' })
  }

  /* DRIVABLE FROM THE URL, as views are: `<id>` selects a lens, `<id>/run` selects and runs it, and
     a query string fills its params — `#lenses/briefing/run?since=2026-10-01` in the console. */
  useEffect(() => {
    if (!lenses || route === drivenBy.current) return
    drivenBy.current = route
    if (route === null) return
    if (!route) {
      abandonRun()
      setSelected(null)
      return
    }
    const [path = '', query = ''] = route.split('?')
    const [id, destination = ''] = path.split('/')
    const wanted = lenses.find((candidate) => candidate.id === id)
    if (!wanted) return
    if (selected !== wanted.id) apply(wanted)
    const supplied = Object.fromEntries(new URLSearchParams(query))
    const nextArgs = { ...(selected === wanted.id ? args : defaultArgs(wanted)), ...supplied }
    if (Object.keys(supplied).length) setArgs(nextArgs)
    if (destination === 'run') void run(wanted, nextArgs)
  }, [lenses, route])

  function navigate(id: string | null, destination: LensDestination): void {
    if (!host.navigateToLens) return
    drivenBy.current = id ? (destination === 'open' ? id : `${id}/${destination}`) : ''
    host.navigateToLens(id, destination)
  }

  function pick(lens: LensSummary): void {
    if (lens.id === selected) return
    apply(lens)
    navigate(lens.id, 'open')
  }

  async function run(lens: LensSummary, values: Record<string, string>): Promise<void> {
    abandonRun()
    const mine = ++generation.current
    setBusy(true)
    setEnvelope(null)
    setStatus({ tone: null, text: '' })
    setStartedAt(performance.now())
    let outcome = await services.invoke(lens.id, argsFor(lens.params ?? [], values))
    // A RUNNING envelope's executionId is the run's handle: ask after it until it settles.
    while (mine === generation.current && isOk(outcome) && outcome.value.status === 'RUNNING') {
      runHandle.current = outcome.value.executionId
      setCancellable(true)
      await new Promise((resolve) => setTimeout(resolve, POLL_MS))
      if (mine !== generation.current) return
      outcome = await services.run(outcome.value.executionId)
    }
    if (mine !== generation.current) return
    runHandle.current = null
    setBusy(false)
    setStartedAt(null)
    setCancelling(false)
    setCancellable(false)
    if (!isOk(outcome)) return setStatus({ tone: 'error', text: failureMessage(outcome, `run '${lens.name}'`) })
    setEnvelope(outcome.value)
    setStatus(verdictOf(outcome.value))
  }

  /* Cancel is a request: the run settles CANCELLED, and that settled envelope is what is shown. */
  async function cancel(): Promise<void> {
    const handle = runHandle.current
    if (!handle || !services.kill) return
    setCancelling(true)
    const mine = generation.current
    const outcome = await services.kill(handle)
    if (mine !== generation.current) return
    generation.current += 1
    runHandle.current = null
    setBusy(false)
    setStartedAt(null)
    setCancelling(false)
    setCancellable(false)
    if (!isOk(outcome)) return setStatus({ tone: 'error', text: failureMessage(outcome, 'cancel this run') })
    setEnvelope(outcome.value)
    setStatus(verdictOf(outcome.value))
  }

  const list = lenses ?? []
  const lens = list.find((candidate) => candidate.id === selected) ?? null

  if (error || lenses == null || list.length === 0) return (
    <div className="kit-feature kit-feature-views viewspage">
      {modeSwitch}
      {error ? <Status tone="error">{error}</Status> : lenses == null ? <p className="hint">loading…</p> : (
        <StudioPanel title="Lenses">
          <p className="hint">No lenses in this world yet. A lens comes with a realm or the world's own config, or is saved from chat.</p>
        </StudioPanel>
      )}
    </div>
  )

  const wanted = filter.trim().toLowerCase()
  const shown = list.filter((candidate) => !wanted || `${candidate.id} ${candidate.name} ${candidate.description ?? ''}`.toLowerCase().includes(wanted))
  const navigator = () => (
    <>
      {modeSwitch}
      <div className="viewnav-filter">
        <input type="search" aria-label="Filter lenses" placeholder={`Filter ${list.length} lenses`} value={filter} onChange={(event) => setFilter(event.target.value)} />
      </div>
      <div className="viewnav-list">
        {shown.length === 0 && <p className="hint viewnav-none">No lens matches “{filter.trim()}”.</p>}
        <nav className="viewnav-section" aria-label="Lenses">
          <span className="viewnav-label">Lenses · {shown.length}</span>
          {shown.map((candidate) => (
            <button key={candidate.id} className={`viewsibling${candidate.id === lens?.id ? ' active' : ''}`} aria-current={candidate.id === lens?.id ? 'page' : undefined} onClick={() => pick(candidate)}>
              <strong>{candidate.name}</strong>
              <small title={candidate.description || undefined}>
                {candidate.description || `${(candidate.params ?? []).length} parameter(s) · ${candidate.id}`}
              </small>
            </button>
          ))}
        </nav>
      </div>
    </>
  )

  const params = lens?.params ?? []
  const rows = rowsOf(envelope?.data)
  const hasData = envelope?.data != null && !(Array.isArray(envelope.data) && envelope.data.length === 0)
  const json = hasData ? JSON.stringify(envelope?.data, null, 2) : ''

  return (
    <div className="kit-feature kit-feature-views viewspage viewspage-selected">
      <aside className="panel viewspage-sidebar" aria-label="Lenses">{navigator()}</aside>
      <details className="panel viewspage-mobile-nav">
        <summary><span><strong>Browse lenses</strong><small>{lens ? lens.name : `${list.length} lenses`}</small></span></summary>
        <div className="viewspage-mobile-nav-body">{navigator()}</div>
      </details>
      {!lens ? (
        <div className="viewspage-operation viewspage-none">
          <p className="hint">Choose a lens to see what it takes and run it.</p>
        </div>
      ) : (
        <div className="viewspage-operation">
          <section className="panel viewoperation-head">
            <div>
              <span className="viewnav-label">Lens · {lens.id}</span>
              <div className="viewoperation-title"><h2>{lens.name}</h2></div>
              <span className="viewnote">{params.length} parameter(s)</span>
            </div>
            {lens.description && <p className="hint">{lens.description}</p>}
          </section>

          <div className="viewrunbar">
            {params.length === 0 ? <span className="hint">No parameters.</span> : params.map((param) => (
              <label key={param.name} className="paramrow">
                <span className="paramname">{param.label && param.label !== param.name ? param.label : param.name} <em>{param.type?.toLowerCase()}</em></span>
                {param.type?.toUpperCase() === 'BOOLEAN' ? (
                  <select value={args[param.name] ?? ''} onChange={(event) => setArgs((current) => ({ ...current, [param.name]: event.target.value }))}>
                    <option value="">{param.default != null ? `default: ${param.default}` : param.required ? 'required' : 'not set'}</option>
                    <option value="true">true</option>
                    <option value="false">false</option>
                  </select>
                ) : (
                  <input
                    value={args[param.name] ?? ''}
                    placeholder={param.default != null ? `default: ${param.default}` : param.required ? 'required' : 'optional'}
                    onChange={(event) => setArgs((current) => ({ ...current, [param.name]: event.target.value }))}
                    onKeyDown={(event) => { if (event.key === 'Enter') void run(lens, args) }}
                  />
                )}
              </label>
            ))}
            <div className="row viewrunbar-actions">
              <button className="btn primary" disabled={busy} onClick={() => void run(lens, args)}>{busy ? 'running…' : 'Run'}</button>
              {busy && services.kill && cancellable && (
                <button className="btn ghost" data-lens-cancel onClick={() => void cancel()}>{cancelling ? 'cancelling…' : 'Cancel'}</button>
              )}
            </div>
          </div>

          <div className="viewoperation-body">
            <section className="viewpane viewpane-results" aria-label="What the lens answered" data-lens-result>
              <div className="viewpane-scroll view-results" tabIndex={0}>
                {!envelope ? (busy ? <p className="hint">Running… The result will appear here.</p> : status.tone === 'error' ? null : <p className="hint">Nothing run yet.</p>)
                  : rows ? <RowTable rows={rows} columns={rowColumns(rows)} />
                    : hasData ? <pre className="lensdata">{json}</pre>
                      : <p className="hint">{envelope.outcome === 'EMPTY' ? 'Nothing to show.' : 'No data.'}</p>}
              </div>
              <div className="row results-foot">
                {envelope?.outputType && <span className="viewnote">{envelope.outputType}</span>}
                {hasData && <CopyButton label="Copy as JSON" text={json} />}
                {busy && startedAt != null && <RunWait startedAt={startedAt} lastStep={null} />}
                <Status tone={status.tone}>{status.text}</Status>
              </div>
            </section>
          </div>
        </div>
      )}
    </div>
  )
}
