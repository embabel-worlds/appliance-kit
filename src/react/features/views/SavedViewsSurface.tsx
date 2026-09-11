/*
 * VIEWS — the world's saved questions, as a place rather than a panel.
 *
 * A view is the durable thing: someone worked out a question worth asking, named it, and now
 * anyone can ask it again with different arguments. That is not a sub-feature of the editor, so it
 * is not buried in the editor's rail — it is where you go when you want an ANSWER rather than a
 * query. Writing one is still Query Studio's job, and "Save as view" lives there.
 *
 * BECAUSE THERE IS NO EDITOR HERE, running is the appliance's ONE-CALL form: `runView` merges your
 * arguments over the declared defaults and returns rows. Query Studio deliberately uses the
 * two-step instead — invocation, then execute — because a studio should show you the cypher a view
 * expands to before it costs you anything. Same engine, two honest paths, and "Open in Query
 * Studio" is how you cross from this one to that one.
 */

import React, { createContext, useCallback, useContext, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import type { KgSchema, KgView, KgViewParamSpec } from '../../../client/kg.ts'
import { isOk } from '../../../client/outcome.ts'
import { rowColumns, rowsToCsv, rowsToMarkdown } from '../../../vc/rows.ts'
import { formatDuration } from '../../../studio-kit/format.ts'
import type {
  SavedViewsHost,
  SavedViewsSurfaceProps,
  ViewsServices,
  Watch,
  WatchDelivery,
  WatchDiff,
  WatchRun,
} from '../contracts.ts'
import { CopyButton, RowTable, Status, StudioPanel, failureMessage } from '../studio/chrome.tsx'

type ViewPane = 'run' | 'results' | 'schema' | 'watch'

interface ViewsRuntime { services: ViewsServices; host: SavedViewsHost }
const ViewsRuntimeContext = createContext<ViewsRuntime | null>(null)
function useViewsRuntime(): ViewsRuntime {
  const runtime = useContext(ViewsRuntimeContext)
  if (!runtime) throw new Error('SavedViewsSurface runtime is missing')
  return runtime
}

export function SavedViewsSurface({ services, host }: SavedViewsSurfaceProps) {
  return <ViewsRuntimeContext.Provider value={{ services, host }}><SavedViewsBody /></ViewsRuntimeContext.Provider>
}

function SavedViewsBody() {
  const { services, host } = useViewsRuntime()
  const [views, setViews] = useState<KgView[] | null>(null)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState<string | null>(null)
  const [args, setArgs] = useState<Record<string, string>>({})
  const [expandedRealm, setExpandedRealm] = useState<string | null>(null)
  const [watchedViews, setWatchedViews] = useState<Set<string> | null>(null)
  const [watchSummaryLoaded, setWatchSummaryLoaded] = useState(false)
  const [watchSupported, setWatchSupported] = useState(true)
  const [pane, setPane] = useState<ViewPane>('run')
  const [schema, setSchema] = useState<KgSchema | null>(null)
  const [schemaError, setSchemaError] = useState('')
  const [status, setStatus] = useState<{ tone: 'ok' | 'error' | 'caution' | null; text: string }>({ tone: null, text: '' })
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([])
  const [ran, setRan] = useState(false)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    const outcome = await services.kg.views()
    if (!isOk(outcome)) return setError(failureMessage(outcome, 'list saved views'))
    setError('')
    setViews(outcome.value)
  }, [services])
  useEffect(() => { void load() }, [load])
  useEffect(() => {
    void services.watches.list().then((outcome) => {
      setWatchSummaryLoaded(true)
      if (isOk(outcome)) return setWatchedViews(new Set(outcome.value.map((watch) => watch.lensId)))
    })
    if (services.kg.schema) {
      void services.kg.schema().then((outcome) => {
        if (isOk(outcome)) {
          setSchema(outcome.value)
          setSchemaError('')
        } else {
          setSchemaError(failureMessage(outcome, 'load the graph schema'))
        }
      })
    } else {
      setSchemaError('This host does not provide the graph schema.')
    }
  }, [services])

  /*
   * DRIVABLE FROM THE URL: `#views/<name>` selects a view, `#views/<name>/run` selects and runs it.
   *
   * The console's own vocabulary (place.ts owns `#tab/rest`, and Apps already reads it), which is
   * what makes a TOUR able to move this panel: a tour step says `run: view.X` and the app navigates
   * here and runs it, in the panel where the user would find it again — rather than printing a
   * table into a transcript somewhere else, which teaches them nothing about where results live.
   */
  /*
   * SUBSCRIBED, not read during render. A hash change from `#views/A/run` to `#views/B/run` keeps
   * the tab the same, so App's listener sets the same tab and React bails out of re-rendering —
   * this panel never learned it had been asked for a different view, and a tour's second `run:`
   * silently did nothing while its caption said otherwise. Seen in a screenshot: the caption
   * described PlaceDossier while the panel still showed DistrictCrimeLeague.
   */
  const hashRest = useSyncExternalStore(host.subscribeSelection, host.selectedView, host.selectedView)

  const drivenBy = useRef<string | null>('')
  const operationRef = useRef<HTMLDivElement>(null)
  const paneNavRef = useRef<HTMLElement>(null)
  const sectionRefs = useRef<Partial<Record<ViewPane, HTMLElement>>>({})
  const pendingPaneScroll = useRef(false)
  /** Keep the requested values explicit; React may not have committed the form update yet. */
  const pendingRun = useRef<{ name: string; args: Record<string, string> } | null>(null)
  useEffect(() => {
    if (!views) return
    const rest = hashRest
    if (rest === drivenBy.current) return
    pendingPaneScroll.current = false
    pendingRun.current = null
    drivenBy.current = rest
    // null means the host is showing another workspace. Keep this mounted surface intact so a
    // Query Studio or Agents handoff can return to the operation, arguments and results.
    if (rest === null) return
    if (!rest) {
      setSelected(null)
      return
    }
    const [name, tail = ''] = rest.split('/')
    const wanted = views.find((candidate) => candidate.name === name)
    if (!wanted) return
    const [destination, query = ''] = tail.split('?')
    const shouldReveal = destination === 'run' || destination === 'results' || destination === 'schema' || destination === 'watch'
    const nextPane: ViewPane = destination === 'results' || destination === 'schema' || destination === 'watch'
      ? destination
      : 'run'
    pendingPaneScroll.current = shouldReveal
    if (selected === wanted.name) {
      setPane(nextPane)
      if (shouldReveal && pane === nextPane) requestAnimationFrame(() => revealPane(nextPane))
    } else {
      applyView(wanted, nextPane, shouldReveal)
    }
    // The visible form and the queued request use the same merge, without waiting for setArgs.
    const supplied = Object.fromEntries(new URLSearchParams(query))
    const nextArgs = { ...(selected === wanted.name ? args : defaultArgs(wanted)), ...supplied }
    if (Object.keys(supplied).length) setArgs(nextArgs)
    if (destination === 'run') pendingRun.current = { name: wanted.name, args: nextArgs }
  }, [views, hashRest, selected])

  const list = views ?? []
  const view = list.find((v) => v.name === selected) ?? null

  // Wait only for the matching view; the request already carries its intended arguments.
  useEffect(() => {
    const pending = pendingRun.current
    if (!pending || view?.name !== pending.name) return
    pendingRun.current = null
    void run(pending.args)
  }, [view, args, hashRest])
  const params = (view?.params ?? {}) as Record<string, KgViewParamSpec>
  const referencedLabels = new Set<string>()
  for (const match of view?.cypher?.matchAll(/:\s*`?([A-Za-z_][A-Za-z0-9_]*)`?/g) ?? []) {
    if (match[1]) referencedLabels.add(match[1])
  }
  if (view?.outputLabel) referencedLabels.add(view.outputLabel)
  const viewSchemaLabels = (schema?.labels ?? []).filter((label) => referencedLabels.has(label.label))

  /*
   * Provenance grouping. `source` is the realm that shipped a view; null means it was authored in
   * this world's own config. A flat list is unreadable the moment a few realms are aboard, and the
   * group header is also the answer to "where did this come from?".
   */
  const groups: Record<string, KgView[]> = {}
  for (const v of list) (groups[v.source || 'World'] ??= []).push(v)
  const groupNames = Object.keys(groups).sort((a, b) => (a === 'World' ? -1 : b === 'World' ? 1 : a.localeCompare(b)))

  function routeFor(name: string, destination: 'open' | ViewPane): string {
    return destination === 'open' ? name : `${name}/${destination}`
  }

  function navigate(name: string | null, destination: 'open' | ViewPane, replace = false): void {
    if (!host.navigateToView) return
    drivenBy.current = name ? routeFor(name, destination) : null
    host.navigateToView(name, destination, replace)
  }

  function defaultArgs(v: KgView): Record<string, string> {
    return Object.fromEntries(
      Object.entries((v.params ?? {}) as Record<string, KgViewParamSpec>)
        .map(([k, spec]) => [k, spec?.default == null ? '' : String(spec.default)]),
    )
  }

  function applyView(v: KgView, nextPane: ViewPane, reveal: boolean): void {
    pendingPaneScroll.current = reveal
    setExpandedRealm(v.source || 'World')
    setSelected(v.name)
    setPane(nextPane)
    setStatus({ tone: null, text: '' })
    setRows([])
    setRan(false)
    setArgs(defaultArgs(v))
  }

  function pick(v: KgView, nextPane: ViewPane = pane, destination: 'open' | ViewPane = nextPane === 'run' ? 'open' : nextPane): void {
    if (v.name === selected) return showPane(nextPane)
    applyView(v, nextPane, destination !== 'open')
    navigate(v.name, destination)
  }

  function revealPaneButton(nextPane: ViewPane): void {
    paneNavRef.current?.querySelector<HTMLElement>(`[data-view-pane="${nextPane}"]`)?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }

  function revealPane(nextPane: ViewPane): void {
    revealPaneButton(nextPane)
    sectionRefs.current[nextPane]?.scrollIntoView({ block: 'start', inline: 'nearest' })
    requestAnimationFrame(() => { pendingPaneScroll.current = false })
  }

  function showPane(nextPane: ViewPane, replace = true): void {
    if (!view) return
    const alreadyActive = pane === nextPane
    pendingPaneScroll.current = true
    setPane(nextPane)
    navigate(view.name, nextPane === 'run' ? 'open' : nextPane, replace)
    if (alreadyActive) requestAnimationFrame(() => revealPane(nextPane))
  }

  // URL/nav-driven panes scroll once. Scroll-driven pane changes deliberately do not set this flag,
  // so observing the document cannot snap it back or create a render loop.
  useEffect(() => {
    if (!view || !pendingPaneScroll.current) return
    const frame = requestAnimationFrame(() => revealPane(pane))
    return () => cancelAnimationFrame(frame)
  }, [view?.name, pane])

  useEffect(() => {
    const operation = operationRef.current
    if (!view || !operation) return
    let frame = 0
    let resizeFrame = 0
    const follow = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        if (pendingPaneScroll.current) return
        const marker = (paneNavRef.current?.getBoundingClientRect().bottom ?? 0) + 18
        let current: ViewPane = 'run'
        const candidates: ViewPane[] = watchSupported ? ['run', 'results', 'schema', 'watch'] : ['run', 'results', 'schema']
        for (const candidate of candidates) {
          const section = sectionRefs.current[candidate]
          if (section && section.getBoundingClientRect().top <= marker) current = candidate
        }
        const scroller = /auto|scroll/.test(window.getComputedStyle(operation).overflowY)
          ? operation : document.scrollingElement ?? document.documentElement
        // A short final section cannot reach the marker when its scroll owner runs out of room.
        const atBottom = scroller.clientHeight > 0 && scroller.scrollHeight > scroller.clientHeight
          && scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 1
        if (atBottom) current = candidates[candidates.length - 1]!
        if (current === pane) return
        setPane(current)
        navigate(view.name, current === 'run' ? 'open' : current, true)
        revealPaneButton(current)
      })
    }
    const resize = () => {
      // A breakpoint can move scrolling between the document and the operation column.
      pendingPaneScroll.current = true
      cancelAnimationFrame(frame)
      cancelAnimationFrame(resizeFrame)
      resizeFrame = requestAnimationFrame(() => revealPane(pane))
    }
    operation.addEventListener('scroll', follow, { passive: true })
    window.addEventListener('scroll', follow, { passive: true })
    window.addEventListener('resize', resize)
    return () => {
      cancelAnimationFrame(frame)
      cancelAnimationFrame(resizeFrame)
      operation.removeEventListener('scroll', follow)
      window.removeEventListener('scroll', follow)
      window.removeEventListener('resize', resize)
    }
  }, [view?.name, pane, watchSupported])

  /** A blank field means "use the declared default", NOT "pass an empty string". */
  const supplied = (values = args) => Object.fromEntries(Object.entries(values).filter(([, v]) => v !== '' && v != null))

  async function run(values = args): Promise<void> {
    if (!view) return
    setBusy(true)
    setRows([])
    setRan(false)
    setStatus({ tone: null, text: 'running…' })
    const outcome = await services.kg.runView(view.name, supplied(values))
    setBusy(false)
    if (!isOk(outcome)) {
      setStatus({ tone: 'error', text: failureMessage(outcome, `run '${view.name}'`) })
      showPane('results', true)
      return
    }
    const result = outcome.value
    const got = (result.rows ?? []) as Array<Record<string, unknown>>
    // `rowCount` is documented as required and is not always sent. The rows are the truth.
    const rowCount = result.rowCount ?? got.length
    if (result.error) {
      setStatus({ tone: 'error', text: result.error })
      showPane('results', true)
      return
    }
    const parts = [`${rowCount} row(s)`]
    if (result.durationMs != null) parts.push(formatDuration(result.durationMs))
    for (const warning of result.warnings ?? []) parts.push(warning)
    if (!rowCount && result.hint) parts.push(result.hint)
    setStatus({ tone: (result.warnings ?? []).length ? 'caution' : 'ok', text: parts.join(' · ') })
    setRows(got)
    setRan(true)
    showPane('results', true)
  }

  /** Expand with these arguments and hand the runnable cypher to the editor next door. */
  async function openInStudio() {
    if (!view) return
    setStatus({ tone: null, text: 'expanding…' })
    const outcome = await services.kg.viewInvocation(view.name, supplied())
    if (!isOk(outcome)) return setStatus({ tone: 'error', text: failureMessage(outcome, 'prepare this view for Query Studio') })
    if (!outcome.value.cypher) return setStatus({ tone: 'error', text: 'The appliance returned no Cypher. Try Open in Query Studio again.' })
    host.onOpenInStudio(outcome.value.cypher)
  }

  async function remove(name: string) {
    if (!confirm(`Delete the view '${name}'?`)) return
    const outcome = await services.kg.deleteView(name)
    if (!isOk(outcome)) return setStatus({ tone: 'error', text: failureMessage(outcome, 'delete this view') })
    setSelected(null)
    navigate(null, 'open')
    void load()
  }

  async function refresh(name: string) {
    setStatus({ tone: null, text: 'recomputing the cache…' })
    const outcome = await services.kg.refreshView(name)
    if (!isOk(outcome)) return setStatus({ tone: 'error', text: failureMessage(outcome, 'refresh this view') })
    setStatus({ tone: 'ok', text: `'${name}' recomputed` })
    void load()
  }

  if (!view) return (
    <div className="kit-feature kit-feature-views viewspage viewspage-board">
      <div className="viewboard-head">
        <div>
          <h2>Operation Board</h2>
          <p className="hint">Choose a realm, inspect its operations, and open or run one directly.</p>
        </div>
      </div>
      {error ? <Status tone="error">{error}</Status> : views == null ? <p className="hint">loading…</p> : list.length === 0 ? (
        <StudioPanel title="Saved views">
          <p className="hint">No saved views yet. Write a query in Query Studio and save it — that is where views come from.</p>
        </StudioPanel>
      ) : (
        <div className="viewrealms">
          {groupNames.map((name) => {
            const realmViews = groups[name]!
            const isExpanded = expandedRealm === name
            const materialized = realmViews.filter((candidate) => candidate.materialized).length
            const watched = watchedViews == null ? null : realmViews.filter((candidate) => watchedViews.has(candidate.name)).length
            return (
              <section className={`panel viewrealm${isExpanded ? ' expanded' : ''}`} key={name}>
                <button
                  className="viewrealm-head"
                  data-viewgroup={name}
                  aria-expanded={isExpanded}
                  onClick={() => setExpandedRealm(isExpanded ? null : name)}
                >
                  <span>
                    <strong>{name}</strong>
                    <small>{realmViews.length} operations · {materialized} materialized · {!watchSummaryLoaded ? 'watch state loading' : watched == null ? 'watch state unavailable' : `${watched} watched`}</small>
                  </span>
                  <span className="chev" aria-hidden="true">{isExpanded ? '−' : '+'}</span>
                </button>
                {isExpanded && (
                  <div className="viewrealm-operations">
                    {realmViews.map((candidate) => (
                      <article className="viewoperation" key={candidate.name}>
                        <button className="viewoperation-open" onClick={() => pick(candidate, 'run', 'open')}>
                          <strong>{candidate.name}</strong>
                          <small>{candidate.description}</small>
                          <span className="viewnote">
                            {Object.keys(candidate.params ?? {}).length} parameter(s) · {candidate.materialized ? 'Materialized' : candidate.outputLabel ?? 'Tabular'}
                          </span>
                        </button>
                        <button className="btn primary" onClick={() => { pendingRun.current = { name: candidate.name, args: defaultArgs(candidate) }; pick(candidate, 'run', 'run') }}>Run</button>
                      </article>
                    ))}
                  </div>
                )}
              </section>
            )
          })}
        </div>
      )}
    </div>
  )

  const realm = view.source || 'World'
  const siblings = groups[realm]!
  const paneLinks: Array<[ViewPane, string]> = [
    ['run', 'Run'],
    ['results', ran ? `Results · ${rows.length}` : 'Results'],
    ['schema', 'Schema'],
    ['watch', 'Watch / receipts'],
  ]
  const navigator = () => (
    <>
      <div className="viewnav-head">
        <span className="viewnav-label">Realm</span>
        <h2>{realm}</h2>
        <small>Selected operation</small>
        <strong>{view.name}</strong>
        <button className="btn ghost" onClick={() => { setSelected(null); navigate(null, 'open') }}>← Operation Board</button>
      </div>
      <nav className="viewnav-section" aria-label={`Other operations in ${realm}`}>
        <span className="viewnav-label">This realm · {siblings.length}</span>
        {siblings.map((candidate) => (
          <button key={candidate.name} className={`viewsibling${candidate.name === view.name ? ' active' : ''}`} aria-current={candidate.name === view.name ? 'page' : undefined} onClick={() => pick(candidate, pane)}>
            <strong>{candidate.name}</strong>
            <small>{Object.keys(candidate.params ?? {}).length} parameter(s) · {candidate.materialized ? 'Materialized' : candidate.outputLabel ?? 'Tabular'}</small>
          </button>
        ))}
      </nav>
    </>
  )

  return (
    <div className="kit-feature kit-feature-views viewspage viewspage-selected">
      <aside className="panel viewspage-sidebar" aria-label={`${realm} operation navigator`}>{navigator()}</aside>
      <details className="panel viewspage-mobile-nav">
        <summary>
          <span><strong>Browse this realm</strong><small>{realm} · {view.name}</small></span>
        </summary>
        <div className="viewspage-mobile-nav-body">{navigator()}</div>
      </details>
      <div className="viewspage-operation" ref={operationRef}>
        <section className="panel viewoperation-head">
          <div>
            <span className="viewnav-label">{realm} · operation</span>
            <h2>{view.name}</h2>
            <span className="viewnote">{Object.keys(params).length} parameter(s) · {view.materialized ? 'Materialized' : view.outputLabel ?? 'Tabular'}</span>
          </div>
          <div className="row">
            {view.materialized && <button className="btn ghost" onClick={() => void refresh(view.name)}>Refresh cache</button>}
            <button className="btn" onClick={() => void openInStudio()}>Open in Query Studio</button>
            <button className="btn ghost" onClick={() => void remove(view.name)}>Delete</button>
          </div>
          {view.description && <p className="hint">{view.description}</p>}
        </section>

        <nav className="viewoperation-nav" aria-label="Operation sections" ref={paneNavRef}>
          {paneLinks.map(([name, label]) => (
            <button key={name} data-view-pane={name} className={`viewoperation-nav-link${pane === name ? ' active' : ''}`} aria-current={pane === name ? 'page' : undefined} onClick={() => showPane(name)}>
              {label}
            </button>
          ))}
        </nav>
        <div className="viewoperation-sections">
          <section className="viewoperation-section" data-view-pane="run" ref={(node) => { sectionRefs.current.run = node ?? undefined }}>
          <StudioPanel title="Run">
            {Object.keys(params).length === 0 ? <p className="hint">No parameters — runs as saved.</p> : (
              <div className="paramform">
                {Object.entries(params).map(([key, spec]) => (
                  <label key={key} className="paramrow">
                    <span className="paramname">{key} <em>{spec?.type}</em></span>
                    <input value={args[key] ?? ''} placeholder={spec?.default != null ? `default: ${spec.default}` : 'no default'} onChange={(event) => setArgs((current) => ({ ...current, [key]: event.target.value }))} />
                    {spec?.description && <small>{spec.description}</small>}
                  </label>
                ))}
              </div>
            )}
            <div className="row"><button className="btn primary" disabled={busy} onClick={() => void run()}>{busy ? 'running…' : 'Run'}</button></div>
            {view.cypher && (
              <details className="cypherbox" open>
                <summary>Cypher{view.materialized ? ' · materialized — reads its cache' : ''}</summary>
                <pre tabIndex={0}><code>{view.cypher}</code></pre>
              </details>
            )}
            {/* Results owns the live announcement; keep this duplicate visually available only. */}
            <div className={`status${status.tone ? ` ${status.tone}` : ''}`}>{status.text}</div>
          </StudioPanel>
          </section>

          <section className="viewoperation-section" data-view-pane="results" ref={(node) => { sectionRefs.current.results = node ?? undefined }}>
          <StudioPanel title="Results">
            <span data-state="view.ran" hidden={!ran} />
            {!ran ? (busy ? <p className="hint">Running… Results will appear here.</p> : status.tone === 'error' ? null : <p className="hint">Nothing run yet.</p>) : rows.length === 0 ? <p className="hint">No rows.</p> : (
              <div className="view-results"><RowTable rows={rows} columns={rowColumns(rows)} /></div>
            )}
            <div className="row results-foot">
              {ran && rows.length > 0 && <><CopyButton label="Copy as Markdown" text={rowsToMarkdown(rows)} /><CopyButton label="Copy as CSV" text={rowsToCsv(rows)} /></>}
              <Status tone={status.tone}>{status.text}</Status>
            </div>
          </StudioPanel>
          </section>

          <section className="viewoperation-section" data-view-pane="schema" ref={(node) => { sectionRefs.current.schema = node ?? undefined }}>
          <StudioPanel title="Schema" aside={schema && <span className="hint">{viewSchemaLabels.length} labels used</span>}>
            {schemaError ? <Status tone="error">{schemaError}</Status> : schema == null ? <p className="hint">loading…</p> : viewSchemaLabels.length === 0 ? (
              <p className="hint">No declared schema labels were found in this operation's query.</p>
            ) : (
              <div className="viewschema">
                {viewSchemaLabels.map((label) => (
                  <article className="viewschema-label" key={label.label}>
                    <div className="row"><strong>{label.label}</strong><span className="viewtag">{label.anchor === false ? 'reach-only' : 'anchor'}</span></div>
                    {label.description && <p>{label.description}</p>}
                    <small>{label.realm ?? 'World'} · {label.sampleCount} sampled</small>
                    {label.properties.length > 0 && <dl>{label.properties.map((property) => <React.Fragment key={property.name}><dt>{property.name}</dt><dd>{property.type}</dd></React.Fragment>)}</dl>}
                  </article>
                ))}
              </div>
            )}
          </StudioPanel>
          </section>

          <section className="viewoperation-section" data-view-pane="watch" ref={(node) => { sectionRefs.current.watch = node ?? undefined }}>
          <WatchPanel
            key={view.name}
            viewName={view.name}
            args={args}
            onSupportChange={setWatchSupported}
            onWatchChange={(watching) => setWatchedViews((current) => {
              const next = new Set(current ?? [])
              watching ? next.add(view.name) : next.delete(view.name)
              return next
            })}
            onWriteAgent={(signalType) => host.onCreateHandler({ signalType, view: view.name })}
          />
          </section>
        </div>
      </div>
    </div>
  )
}

/*
 * WATCHING A VIEW — the shortest path from a saved question to an agent.
 *
 * The appliance's watch subsystem does the work: it re-materializes the subject on a cron, diffs
 * the result with a declarative `DiffSpec`, and keeps every run, snapshot and diff. This panel adds
 * no logic to that; it creates a Watch whose subject is this view and whose delivery channel is
 * `signal`.
 *
 * Change-signal publication is separate from configured delivery. A watch with no delivery
 * notifies no one; that does not mean it publishes no change signal.
 *
 * The presets are the schedules people actually mean. 6-field cron, hour in the HOUR field —
 * `0 0 7 * * *` is 7am daily; `0 7 * * * *` is seven minutes past every hour, which is the mistake
 * everybody makes once.
 */
const SCHEDULES: [string, string][] = [
  ['0 0 7 * * *', 'every morning at 7'],
  ['0 0 * * * *', 'hourly, on the hour'],
  ['0 */15 * * * *', 'every 15 minutes'],
  ['0 0 9 * * MON', 'Monday mornings at 9'],
]

/** As `/watches` reports one. Only the fields this panel reads. */
function WatchPanel({ viewName, args, onWatchChange, onWriteAgent, onSupportChange }: {
  viewName: string
  args: Record<string, string>
  onSupportChange(supported: boolean): void
  onWatchChange(watching: boolean): void
  onWriteAgent(signalType: string): void
}) {
  const { services } = useViewsRuntime()
  const [watch, setWatch] = useState<Watch | null>(null)
  const [loading, setLoading] = useState(true)
  const [problem, setProblem] = useState('')
  const [schedule, setSchedule] = useState(SCHEDULES[0]![0])
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<{ tone: 'ok' | 'error' | 'caution' | null; text: string }>({ tone: null, text: '' })

  const signalType = `view.${viewName}.changed`

  const load = useCallback(async () => {
    setLoading(true)
    setProblem('')
    const r = await services.watches.list()
    onSupportChange(r.ok || r.kind !== 'unsupported')
    setLoading(false)
    if (!r.ok) return setProblem(failureMessage(r, 'list watches'))
    setWatch(r.value.find((w) => w.lensId === viewName) ?? null)
  }, [viewName, services, onSupportChange])

  useEffect(() => { void load() }, [load])

  async function start() {
    setBusy(true)
    const r = await services.watches.create({
      lensId: viewName,
      name: viewName,
      params: args,
      cron: schedule,
      delivery: { channel: 'signal' },
    })
    setBusy(false)
    if (!r.ok) {
      return setStatus({ tone: 'error', text: failureMessage(r, 'start watching this view') })
    }
    setStatus({ tone: 'ok', text: 'Watching. The first run takes a baseline; changes after that publish a signal.' })
    onWatchChange(true)
    void load()
  }

  async function stop() {
    if (!watch) return
    setBusy(true)
    const r = await services.watches.delete(watch.id)
    setBusy(false)
    if (!r.ok) return setStatus({ tone: 'error', text: failureMessage(r, 'stop this watch') })
    setWatch(null)
    onWatchChange(false)
    setStatus({ tone: null, text: 'Watch stopped.' })
  }

  async function runNow() {
    if (!watch) return
    setBusy(true)
    const r = await services.watches.run(watch.id)
    setBusy(false)
    setStatus(r.ok
      ? { tone: 'ok', text: 'Run requested. Check the run receipts above for its outcome.' }
      : { tone: 'error', text: failureMessage(r, 'run this watch') })
  }

  if (loading) return <StudioPanel title="Watch"><Status tone={null}>Checking watches…</Status></StudioPanel>
  if (problem) return (
    <StudioPanel title="Watch">
      <Status tone="error">{problem}</Status>
      <button className="btn" onClick={() => void load()}>Retry watch listing</button>
    </StudioPanel>
  )

  return (
    <StudioPanel
      title="Watch"
      aside={watch ? <span className="stage watching">watching</span> : undefined}
    >
      {!watch ? (
        <>
          <p className="hint">
            Run this view on a schedule, diff the answer, and publish <code>{signalType}</code> when
            it changes. The watch publishes a signal; it does not notify anyone by itself.
          </p>
          <div className="row skillsource">
            <select value={schedule} aria-label="Watch schedule" onChange={(e) => setSchedule(e.target.value)}>
              {SCHEDULES.map(([cron, says]) => <option key={cron} value={cron}>{says}</option>)}
            </select>
            <input value={schedule} onChange={(e) => setSchedule(e.target.value)} aria-label="cron expression" />
            <button className="btn" disabled={busy} onClick={() => void start()}>Watch this</button>
          </div>
          <p className="hint">
            Any arguments above are frozen into the watch — the same question, asked on a timer.
          </p>
        </>
      ) : (
        <>
          <div className="statline">
            <span>Change signal:&nbsp;</span>
            <strong><code>{signalType}</code></strong>
          </div>
          <div className="statline">
            <span>Schedule:&nbsp;</span>
            <strong>{watch.cron ?? 'not scheduled'}</strong>
          </div>
          <div className="statline">
            <span>Delivery:&nbsp;</span>
            <strong>{!watch.delivery?.channel || watch.delivery.channel === 'none' ? 'none — notifies no one' : watch.delivery.channel}</strong>
          </div>
          <div className="row studio-actions">
            <button className="btn" disabled={busy} onClick={() => void runNow()}>Run it now</button>
            <button className="btn" onClick={() => onWriteAgent(signalType)}>Write an agent for it</button>
            <button className="btn ghost" disabled={busy} onClick={() => void stop()}>Stop watching</button>
          </div>
          <p className="hint">
            This watch reruns on schedule and publishes <code>{signalType}</code> when rows change.
            Add a handler only if you want an automated response.
          </p>
          <div className="subhead">Runs</div>
          <WatchReceipts watchId={watch.id} />
        </>
      )}
      <Status tone={status.tone}>{status.text}</Status>
    </StudioPanel>
  )
}

/*
 * RECEIPTS — what the watch actually did.
 *
 * A watch that runs and shows you nothing is indistinguishable from a watch that does not run, and
 * that is the worst possible first impression for the one feature here nobody else has. The
 * appliance already keeps every run, snapshot, diff and delivery; none of it had a surface.
 *
 * Three facts are joined, because separately none of them is a receipt:
 *
 *   RUNS       — it woke up, and whether it completed        (/watches/{id}/runs)
 *   DIFFS      — what actually changed, if anything          (/watches/{id}/changes)
 *   DELIVERIES — outcomes of configured delivery            (/watches/{id}/deliveries)
 *
 * A missing delivery receipt does not establish whether a change signal was published.
 */
/** `2026-08-27T22:53:44Z` → `27 Aug 22:53`. Local, short, and never the seconds — a receipt is
 *  read for "when roughly", and the id is there when somebody needs to be exact. */
function whenShort(iso?: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return Number.isNaN(d.getTime())
    ? String(iso).slice(0, 16).replace('T', ' ')
    : d.toLocaleString(undefined, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

function WatchReceipts({ watchId }: { watchId: string }) {
  const { services } = useViewsRuntime()
  const [runs, setRuns] = useState<WatchRun[] | null>(null)
  const [diffs, setDiffs] = useState<WatchDiff[]>([])
  const [deliveries, setDeliveries] = useState<WatchDelivery[]>([])
  const [problem, setProblem] = useState('')

  const load = useCallback(async () => {
    const [r, c, d] = await Promise.all([
      services.watches.runs(watchId),
      services.watches.changes(watchId),
      services.watches.deliveries(watchId),
    ])
    if (!r.ok) return setProblem(failureMessage(r, "list this watch's runs"))
    if (!c.ok) return setProblem(failureMessage(c, "list this watch's changes"))
    if (!d.ok) return setProblem(failureMessage(d, "list this watch's deliveries"))
    setProblem('')
    // Newest first: a receipt is read from the top, and the run somebody just triggered is the
    // one they are looking for.
    setRuns([...r.value].reverse())
    setDiffs(c.value)
    setDeliveries(d.value)
  }, [watchId, services])

  useEffect(() => { void load() }, [load])

  if (problem) return <><Status tone="error">{problem}</Status><button className="btn ghost tiny" onClick={() => void load()}>Refresh receipts</button></>
  if (runs === null) return <p className="hint">Reading this watch's history…</p>
  if (runs.length === 0) {
    return <><p className="hint">No runs listed yet. <em>Run it now</em> requests a run.</p><button className="btn ghost tiny" onClick={() => void load()}>Refresh receipts</button></>
  }

  const diffFor = (run: WatchRun) => diffs.find((d) => d.id === run.diffId || d.targetRunId === run.id)

  return (
    <div className="receipts">
      {runs.slice(0, 8).map((run) => {
        const diff = diffFor(run)
        const changes = diff?.changes ?? []
        const delivered = deliveries.filter((d) => d.diffId === diff?.id)
        const counts = ['ADDED', 'REMOVED', 'UPDATED']
          .map((k) => [k, changes.filter((c) => c.kind === k).length] as const)
          .filter(([, n]) => n > 0)
          .map(([k, n]) => `${n} ${k.toLowerCase()}`)
        return (
          <div className="receipt" key={run.id}>
            <div className="receipt-head">
              <span className={`stage ${run.errorCode ? 'acting' : changes.length ? 'watching' : 'proposed'}`}>
                {run.errorCode ? 'failed' : changes.length ? 'changed' : 'no recorded changes'}
              </span>
              <strong>{whenShort(run.startedAt)}</strong>
              <small>{(run.status ?? '').toLowerCase()}</small>
            </div>
            {run.errorCode && <p className="receipt-line">{run.errorCode}</p>}
            {changes.length > 0 && (
              <p className="receipt-line">
                {counts.join(' · ')}
                {changes.slice(0, 3).map((c) => c.key).filter(Boolean).length > 0 &&
                  ` — ${changes.slice(0, 3).map((c) => c.key).filter(Boolean).join(', ')}`}
                {changes.length > 3 ? ` and ${changes.length - 3} more` : ''}
              </p>
            )}
            {/* Preserve each delivery outcome; a receipt is not necessarily a successful delivery. */}
            {delivered.length > 0 && (
              <p className="receipt-line receipt-delivery">
                {delivered.map((d) => `Delivery to ${d.channel ?? 'an unspecified channel'} · ${(d.status ?? 'status unavailable').toLowerCase()}`).join(' · ')}
              </p>
            )}
            {changes.length > 0 && delivered.length === 0 && (
              <p className="receipt-line hint">
                No delivery receipt is available for this run.
              </p>
            )}
          </div>
        )
      })}
      <div className="row">
        <button className="btn ghost tiny" onClick={() => void load()}>Refresh receipts</button>
        {runs.length > 8 && <span className="hint">showing the last 8 of {runs.length}</span>}
      </div>
    </div>
  )
}
