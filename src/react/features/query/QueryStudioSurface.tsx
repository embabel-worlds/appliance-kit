/*
 * QUERY STUDIO — the virtual-Cypher surface, on the Worlds door.
 *
 * The Me app has had this for a while; the console had a Views runner that could show you a saved
 * query's rows but never what it asked, and no way to write one. Both now stand on the same three
 * packages, which is what makes them one product rather than two readings of a spec:
 *
 *  - `@embabel/appliance-kit` — the REST client, generated from the surface the assistant's
 *    contract test guards. Same calls, same typed outcomes, same "your appliance predates this".
 *  - `.../vc` — what the engine actually offers. Relevance is an EDGE and the mode is chosen AT
 *    the edge: no `via` is vector (about X), `via:'keyword'` is lexical (mentions X),
 *    `via:'agentic-rag'` with an `intent` is a bounded LLM loop judging every candidate. Three
 *    modes because they are three different questions. Nothing about the engine's shape is decided
 *    in this file.
 *  - `.../studio-kit` — the editor behaviour, so the same keystroke completes the same way here as
 *    it does in Me.
 *
 * Three honesty guarantees come from using the appliance's own surfaces rather than reimplementing
 * them: the SCHEMA panel and completion read the same snapshot the engine validates against;
 * VALIDATION is the engine's strict preflight run without execution, so "valid" here and "rejected"
 * there can never disagree; and the per-user scope is applied server-side, so an edited query can
 * be wrong but not unsafe.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  type KgQueryResult,
  type KgScopeInfo,
  isBackgroundHandle,
  type KgSchema,
  type KgView,
  type KgViewParamSpec,
} from '../../../client/kg.ts'
import { isOk } from '../../../client/outcome.ts'
import {
  type GraphSchema,
  completeQuery,
  aliasMap,
  anchorLabels,
  declaredParams,
  rowColumns,
  rowsToCsv,
  rowsToMarkdown,
  scopeReference,
} from '../../../vc/index.ts'
import * as Vc from '../../../vc/index.ts'
import { CYPHER_KEYWORDS, createCypherHint, createDefinitionTooltip, definitionTitle, formatDuration } from '../../../studio-kit/index.ts'
import type { KgFill, QueryHistoryEntry, QueryStudioSurfaceProps, QueryStudioServices } from '../contracts.ts'
import { CodeMirror, useEditor } from '../studio/editor.ts'
import { useRunProgress } from '../studio/progress.ts'
import { CopyButton, RowTable, Status, StudioPanel, failureMessage, isAbsent } from '../studio/chrome.tsx'
import { SessionPane } from './SessionPane.tsx'
import { QueryRuntimeProvider, useQueryRuntime } from './runtime.tsx'

/*
 * The hint is registered against the CodeMirror SINGLETON, so it must happen exactly once for the
 * app rather than once per mount. `schema()` reads through a mutable box instead of closing over a
 * value: the helper is installed before any schema has arrived, and a captured `null` would mean
 * completion stayed empty for the life of the page.
 */
const schemaBox: { current: KgSchema | null } = { current: null }
let schemaOwner: symbol | null = null
let hintRegistered = false
function registerHint() {
  if (hintRegistered) return
  hintRegistered = true
  ;(CodeMirror as any).registerHelper(
    'hint',
    'cypher',
    createCypherHint(CodeMirror as any, Vc as any, { schema: () => schemaBox.current, keywords: CYPHER_KEYWORDS }),
  )
}

/** The Vaadin Cypher console's four views, and the same names, so one product has one vocabulary. */
type ResultView = 'table' | 'raw' | 'stats' | 'trace'

/** The outer split, same names — plus Session, the REPL reading of the same engine. */
type Pane = 'query' | 'results' | 'session'

const HISTORY_MAX = 20

/**
 * THE RUN TO KILL, WHEN THE TRACE NEVER NAMED ONE.
 *
 * Stop normally uses the id the trace bound, because the run registry is keyed by the SSE queryId
 * by design. But the stream is opened as the execute request goes out, and a connection that
 * completes a few milliseconds late misses `query.started` — the run is perfectly killable, we just
 * never heard its id, and a Stop button that gives up there is the complaint this feature exists to
 * answer.
 *
 * So ask: `GET /kg/runs` is the appliance's own account of what this user is running. Match on the
 * cypher AS SUBMITTED and take the most recent, since one user can legitimately have several runs
 * in flight and the same text twice is the only case this cannot separate — a race the trace path
 * has too, and one that costs a wrong cancel rather than a wrong answer.
 */
async function inFlightRunId(services: QueryStudioServices, cypher: string | null): Promise<string | null> {
  if (!cypher) return null
  const outcome = await services.kg.runs()
  if (!isOk(outcome)) return null
  const mine = outcome.value
    .filter((run) => run.cypher.trim() === cypher)
    .sort((a, b) => b.startedAt - a.startedAt)
  return mine[0]?.runId ?? null
}

/**
 * @param handedOver cypher arriving from another tab (a view expanded in Views), landed once. A
 *   changing value lands again; null never clobbers what is already in the editor.
 */
export function QueryStudioSurface({ services, host, handedOver }: QueryStudioSurfaceProps) {
  return (
    <QueryRuntimeProvider services={services} host={host}>
      <QueryStudioBody handedOver={handedOver} />
    </QueryRuntimeProvider>
  )
}

function QueryStudioBody({ handedOver }: { handedOver?: string | null }) {
  const { services, host } = useQueryRuntime()
  const [schema, setSchema] = useState<KgSchema | null>(null)
  const [validity, setValidity] = useState<{ tone: 'ok' | 'error' | null; text: string; violations: string[] }>(
    { tone: null, text: '', violations: [] },
  )
  /*
   * WHETHER THE VIOLATIONS ARE ON SCREEN, which is not the same question as whether the query is
   * valid.
   *
   * The preflight runs as you type, and half-typed Cypher is invalid by construction: `e.d` on the
   * way to `e.division` gets back a paragraph explaining that `d` is not a property of Electorate
   * and listing the twelve that are. Correct, useful when you asked, and — arriving mid-keystroke,
   * in red — it makes the editor look broken rather than helpful.
   *
   * So the PILL stays live: a quiet ✓ or "3 schema problems", which is a signal and costs nothing
   * to glance past. The PROSE waits until you ask for an answer (Run) or ask for it directly (the
   * pill is a button while there is something to show). Typing hides it again, because a verdict
   * is stale the moment the text moves.
   */
  const [showViolations, setShowViolations] = useState(false)
  const [runStatus, setRunStatus] = useState<{ tone: 'ok' | 'error' | 'caution' | null; text: string }>(
    { tone: null, text: '' },
  )
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([])
  /* The WHOLE result, because `apiCallLog`, `llmCallLog` and the call counts ride on it and were
   * being thrown away — they are what the Vaadin console's Stats view is made of. */
  const [result, setResult] = useState<KgQueryResult | null>(null)
  const [view, setView] = useState<ResultView>('table')
  const [pane, setPane] = useState<Pane>('query')
  const [ran, setRan] = useState(false)
  const [running, setRunning] = useState(false)
  /* A kill has been asked for and the run has not answered yet. Separate from `running` because
   * the two overlap: the query is still in flight for as long as it takes the engine to notice. */
  const [stopping, setStopping] = useState(false)
  const runningCypher = useRef<string | null>(null)
  const [history, setHistory] = useState<QueryHistoryEntry[]>(() => host.history.read() ?? [])
  /* Bumped whenever a capture lands, so the Scopes rail re-reads without owning the execute path. */
  const [scopesVersion, setScopesVersion] = useState(0)
  const [fillsVersion, setFillsVersion] = useState(0)
  /* What the engine is doing while we wait. The appliance has published this trace all along; not
   * reading it is why a slow run looked identical to a wedged one. */
  const progress = useRunProgress(services.subscribeProgress)
  /* Pinned to the newest line: the one that just arrived is the one being stared at while someone
   * decides whether this run is worth waiting for. */
  const progressRef = useRef<HTMLDivElement>(null)

  // Validation stops asking for good once an appliance answers "no such endpoint" — nagging per
  // keystroke about a feature this server simply does not have helps nobody.
  const validateSupported = useRef(true)
  const validateTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const validatedCypher = useRef<string | null>(null)
  const active = useRef(true)
  const schemaGeneration = useRef(0)
  const validationGeneration = useRef(0)
  const runGeneration = useRef(0)
  const owner = useRef(Symbol('query-schema-owner')).current

  const runRef = useRef<() => void>(() => {})
  /* Both callbacks go through refs rather than being passed directly. `scheduleValidation`
   * reaches `validateNow`, which reads `handle` — which comes out of this very call — so naming it
   * here would be a circular inference TypeScript gives up on. The ref breaks the cycle and, as a
   * bonus, keeps the editor from caring that a callback identity moved. */
  const editRef = useRef<() => void>(() => {})
  const { ref: editorRef, handle } = useEditor({
    mode: 'application/x-cypher-query',
    onRun: () => runRef.current(),
    onEdit: () => editRef.current(),
  })

  registerHint()

  // ── the schema: one fetch, driving BOTH the browser panel and completion ────────────────────
  /* Fetched on mount AND on window focus: the schema changes underneath a long-lived tab — a
   * realm install adds labels — and a snapshot taken once at mount quietly stops matching what
   * the engine validates against. Focus is when someone comes back from installing something. */
  const loadSchema = useCallback(async (): Promise<void> => {
    const generation = ++schemaGeneration.current
    const outcome = await services.kg.schema()
    if (!active.current || generation !== schemaGeneration.current || schemaOwner !== owner) return
    if (!isOk(outcome)) return
    setSchema(outcome.value)
    schemaBox.current = outcome.value
  }, [owner, services])
  useEffect(() => {
    active.current = true
    schemaOwner = owner
    validationGeneration.current += 1
    runGeneration.current += 1
    validateSupported.current = true
    validatedCypher.current = null
    setSchema(null)
    void loadSchema()
    const onFocus = (): void => void loadSchema()
    window.addEventListener('focus', onFocus)
    return () => {
      active.current = false
      schemaGeneration.current += 1
      validationGeneration.current += 1
      runGeneration.current += 1
      if (validateTimer.current) clearTimeout(validateTimer.current)
      validateTimer.current = null
      window.removeEventListener('focus', onFocus)
      if (schemaOwner === owner) {
        schemaOwner = null
        schemaBox.current = null
      }
    }
  }, [loadSchema, owner])

  /*
   * HOVER A LABEL, READ WHAT IT MEANS.
   *
   * The schema panel shows every declared definition, but the place labels are actually POINTED AT
   * is the query — hovering `Electorate` in your own Cypher should answer with the same declared
   * definition, and the tooltip is the kit's, so it is the same answer the Me app gives.
   *
   * Attached once the editor exists, and torn down with it: CodeMirror owns this DOM node and
   * React will not clean up listeners it never added.
   */
  useEffect(() => {
    const cm = handle.editor
    if (!cm) return
    const definitions = createDefinitionTooltip(document)
    const wrapper = cm.getWrapperElement()
    let hovered: string | null = null

    const onMove = (e: MouseEvent) => {
      const pos = cm.coordsChar({ left: e.clientX, top: e.clientY }, 'window')
      const token = cm.getTokenAt(pos)
      const word = token?.string ?? ''
      // coordsChar CLAMPS to the nearest character, so the cursor must genuinely be on the token —
      // otherwise the last word of a line answers for all the empty space after it.
      const start = cm.charCoords({ line: pos.line, ch: token.start }, 'window')
      const end = cm.charCoords({ line: pos.line, ch: token.end }, 'window')
      const inside = e.clientX >= start.left && e.clientX <= end.right
        && e.clientY >= start.top && e.clientY <= start.bottom
      if (!inside) {
        hovered = null
        return definitions.hide()
      }
      if (word === hovered) return
      hovered = word

      const box = { left: start.left, right: end.right, top: start.top, bottom: start.bottom }
      const labels = (schemaBox.current?.labels ?? []) as Array<{
        label: string
        description?: string
        realm?: string
        properties?: Array<{ name: string; description?: string }>
      }>
      const text = cm.getValue()
      // The cypher mode tokenizes `e:Electorate` as ONE atom, so the label is what follows the
      // colon. A bare alias (`e` in `e.division`) resolves through the query's own alias map, so
      // hovering it answers for its label too.
      const name = word.includes(':') ? word.slice(word.lastIndexOf(':') + 1) : word
      const resolved = labels.some((l) => l.label === name) ? name : aliasMap(text)[name]
      const label = labels.find((l) => l.label === resolved)
      if (label) {
        return definitions.show(box as unknown as HTMLElement, definitionTitle(label), label.description ?? '')
      }
      // `e.marginPct` → the PROPERTY's declared description: the alias before the dot names the
      // label, the token names the property.
      const owner = cm.getLine(pos.line).slice(0, token.start).match(/(\w+)\.$/)
      const ownerLabel = owner ? labels.find((l) => l.label === aliasMap(text)[owner[1] ?? '']) : undefined
      const prop = ownerLabel?.properties?.find((pr) => pr.name === word && pr.description)
      if (prop && ownerLabel) {
        return definitions.show(box as unknown as HTMLElement, `${ownerLabel.label}.${prop.name}`, prop.description ?? '')
      }
      definitions.hide()
    }

    const onLeave = () => { hovered = null; definitions.hide() }
    wrapper.addEventListener('mousemove', onMove)
    wrapper.addEventListener('mouseleave', onLeave)
    return () => {
      wrapper.removeEventListener('mousemove', onMove)
      wrapper.removeEventListener('mouseleave', onLeave)
      definitions.hide()
    }
  }, [handle.editor])

  // ── validation: the engine's strict preflight, debounced ────────────────────────────────────
  const validateNow = useCallback(async (): Promise<void> => {
    // Validate what RUN will execute — the completed form — or the pill contradicts the Run button.
    const { cypher } = completeQuery(handle.getText())
    if (!cypher) {
      validatedCypher.current = null
      return setValidity({ tone: null, text: '', violations: [] })
    }
    const generation = ++validationGeneration.current
    const outcome = await services.kg.validate(cypher)
    if (!active.current || generation !== validationGeneration.current || completeQuery(handle.getText()).cypher !== cypher) return
    if (!isOk(outcome)) {
      if (isAbsent(outcome)) validateSupported.current = false
      validatedCypher.current = null
      return setValidity({ tone: null, text: '', violations: [] })
    }
    // `ok` IS the verdict on this endpoint — it means "this cypher passes the preflight", not
    // "the request worked". The handlers surface next door splits those into two booleans; this
    // one does not, and reading it as a transport result would call every rejected query valid.
    const { ok: valid, violations = [] } = outcome.value
    validatedCypher.current = valid ? cypher : null
    setValidity(valid
      ? { tone: 'ok', text: '✓ schema-valid', violations: [] }
      : { tone: 'error', text: `${violations.length} schema problem(s)`, violations })
  }, [handle, services])

  const scheduleValidation = useCallback((): void => {
    if (!validateSupported.current) return
    if (validateTimer.current) clearTimeout(validateTimer.current)
    validationGeneration.current += 1
    validatedCypher.current = null
    setValidity((v) => ({ ...v, tone: null, text: '…' }))
    // Anything painted about the OLD text is wrong now.
    setShowViolations(false)
    validateTimer.current = setTimeout((): void => void validateNow(), 700)
  }, [validateNow])
  editRef.current = scheduleValidation

  // ── running ─────────────────────────────────────────────────────────────────────────────────
  const run = useCallback(async (): Promise<void> => {
    // A RETURN-less MATCH runs with its RETURN implied — same rule as the Session tab, so
    // `MATCH (c:Chunk)` is runnable everywhere. The editor's text is not rewritten.
    const { cypher, note: impliedNote } = completeQuery(handle.getText())
    if (!cypher || validatedCypher.current !== cypher) return
    const generation = ++runGeneration.current
    setRunning(true)
    setStopping(false)
    // The outcome is what you asked for; don't leave it on a tab nobody is looking at.
    setPane('results')
    /* The cypher AS SUBMITTED. Stop needs to name the run it is stopping, and by the time anyone
     * presses it the editor may hold something else entirely. */
    runningCypher.current = cypher
    progress.begin()
    setView('trace')
    // Asking for an answer is asking why you cannot have one.
    setShowViolations(true)
    setRows([])
    setResult(null)
    setRan(false)
    setRunStatus({ tone: null, text: 'Running — relevance joins fetch live, give it a moment…' })
    const outcome = await services.kg.execute(cypher)
    if (!active.current || generation !== runGeneration.current) return
    setRunning(false)
    setStopping(false)
    runningCypher.current = null
    /* The rows are here, so nothing further is coming — but the LINES stay on screen. Someone who
     * waited forty seconds is owed the account of where it went. */
    progress.end()
    if (!isOk(outcome)) {
      return setRunStatus({ tone: 'error', text: failureMessage(outcome, 'query execution') })
    }
    // `execute` has two success shapes. Without `background` this is always the finished result,
    // but the type says otherwise and reading `rows` off a handle would silently show zero rows.
    // The guard identifies the handle by its `runId` — testing for a MISSING `rowCount` instead
    // threw away the rows of any result that did not send one, which is how this looked in
    // practice: "parked in the background", over a payload holding the answer.
    if (isBackgroundHandle(outcome.value)) {
      return setRunStatus({ tone: 'caution', text: 'The appliance parked this run in the background.' })
    }
    const result = outcome.value
    /* A KILLED run comes back 200, with no error and no rows — so the generic path below would
     * report "0 row(s)", which is the one thing it must never say. Zero rows because you stopped it
     * is not zero rows because the graph is empty, and `reason` exists exactly so a client need not
     * guess from the hint text. The hint is the engine's own: committed work is KEPT, so re-running
     * resumes from the first cold anchor rather than starting over. */
    if (result.reason === 'KILLED') {
      return setRunStatus({
        tone: 'caution',
        text: `Stopped. ${result.hint ?? 'Work already materialized is kept — run it again to resume from there.'}`,
      })
    }
    const rows = (result.rows ?? []) as Array<Record<string, unknown>>
    // `rowCount` is documented as required and is not always sent. The rows are the truth.
    const rowCount = result.rowCount ?? rows.length
    const parts: string[] = [`${rowCount} row(s)`]
    if (impliedNote) parts.push(impliedNote)
    if (result.durationMs != null) parts.push(formatDuration(result.durationMs))
    for (const warning of result.warnings ?? []) parts.push(warning)
    if (!rowCount && result.hint) parts.push(result.hint)
    if (result.error) return setRunStatus({ tone: 'error', text: result.error })
    setRunStatus({ tone: (result.warnings ?? []).length ? 'caution' : 'ok', text: parts.join(' · ') })
    setRows(rows)
    setResult(result)
    setRan(true)
    // The rows are the answer; the trace was the wait. Go back to the answer.
    setView('table')
    setHistory((entries) => {
      const next = [{ cypher, rows: rowCount, at: new Date().toISOString() },
        ...entries.filter((e) => e.cypher !== cypher)].slice(0, HISTORY_MAX)
      host.history.write(next)
      return next
    })
  }, [handle, progress, services])
  runRef.current = () => void run()

  /*
   * STOPPING A RUN. The execute POST stays open — the appliance answers it with the typed KILLED
   * outcome once the kill lands, and that answer is where the "Stopped" status comes from. Nothing
   * here aborts the request: a client that hung up would leave the run going on the server and
   * would have to invent an explanation for a query it stopped watching.
   *
   * Cancellation is COOPERATIVE server-side — the expensive loops check a flag at their
   * boundaries, so granularity is about one model call. Stop is therefore a request, not a switch,
   * and the status says so rather than freezing the button and looking broken.
   */
  const stop = useCallback(async (): Promise<void> => {
    setStopping(true)
    setRunStatus({ tone: null, text: 'Stopping — the engine checks between steps, so this can take a moment…' })
    const runId = progress.runId ?? (await inFlightRunId(services, runningCypher.current))
    if (!runId) {
      setStopping(false)
      return setRunStatus({ tone: 'caution', text: 'Could not identify this run — the appliance reports nothing in flight for you.' })
    }
    const outcome = await services.kg.kill(runId)
    if (!isOk(outcome)) {
      setStopping(false)
      return setRunStatus({ tone: 'error', text: failureMessage(outcome, 'stopping the run') })
    }
    /* `killed: false` means the registry had no such run — it finished between the click and the
     * call. The execute POST is about to return the real answer, so say nothing that contradicts
     * the rows that are one moment away. */
    if (!outcome.value.killed) setStopping(false)
  }, [progress.runId])

  const land = useCallback((cypher: string) => {
    validatedCypher.current = null
    handle.setText(cypher)
    scheduleValidation()
  }, [handle, scheduleValidation])

  /* Recalling from History replaces the editor text, and the replaced text may be work in
   * progress — so it is stashed as a history entry first (rows null, shown as "not run"),
   * making the overwrite lossless. Collapsing the panel and focusing the editor are what
   * make the click VISIBLE: with History expanded above the editor, the landed text was
   * below the fold and a click looked like it did nothing. */
  const historyRef = useRef<HTMLDetailsElement>(null)
  const recall = useCallback((cypher: string) => {
    const current = handle.getText()
    if (current.trim() && current !== cypher) {
      setHistory((entries) => {
        if (entries.some((e) => e.cypher === current)) return entries
        const next = [{ cypher: current, rows: null, at: new Date().toISOString() }, ...entries].slice(0, HISTORY_MAX)
        host.history.write(next)
        return next
      })
    }
    land(cypher)
    historyRef.current?.removeAttribute('open')
    handle.editor?.focus()
  }, [handle, land])

  /* Landed on arrival AND on change, so opening the same view twice still works. The editor is
   * created asynchronously, so this waits for it rather than firing into nothing. */
  const landed = useRef<string | null>(null)
  useEffect(() => {
    if (!handedOver || !handle.editor || landed.current === handedOver) return
    landed.current = handedOver
    land(handedOver)
  }, [handedOver, handle.editor, land])

  useEffect(() => {
    const el = progressRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [progress.lines])

  /* CM5 measures itself against a laid-out DOM, and a `display: none` pane has no dimensions. An
   * editor coming back on screen therefore renders blank, or drops the cursor in the wrong place,
   * until it is told to measure again. This is the whole cost of hiding rather than unmounting,
   * and it is a cheap one. */
  useEffect(() => {
    if (pane === 'query') handle.editor?.refresh()
  }, [pane, handle.editor])

  const columns = rowColumns(rows)

  return (
    <div className="kit-feature kit-feature-query studio">
      {/* Me's distribution, panel for panel: the rail is what FEEDS a query — controls, saved
          views, the schema, what you ran before. Ask, the editor and the results are the work
          itself and share the wide column. */}
      <div className="studio-side">
        <SchemaPanel schema={schema} onInsert={land} onReload={() => void loadSchema()} />
        <ScopesPanel version={scopesVersion} onInsert={land} />
        <FillsPanel version={fillsVersion} />
      </div>

      {/*
        QUERY | RESULTS, the Vaadin Cypher console's own split, for the reason it has it: stacked,
        the editor and the rows compete for one column's height and BOTH lose. The editor was the
        one that lost worst — squeezed to a few lines while Results held its floor — and a Cypher
        box you cannot see six lines of is not a Cypher box.

        Tabbed, whichever one you are working with gets the whole column. Run jumps to Results, so
        the outcome is never missed (Vaadin's `switchToResults`, same reasoning); the tab back is
        how you edit, and the editor is exactly as you left it.

        HIDDEN, NOT UNMOUNTED. CodeMirror owns its DOM node and React must not recreate it —
        unmounting the Query pane would destroy the editor and take the text and the undo history
        with it. So both panes stay mounted and CSS decides which is on screen.
      */}
      <div className="studio-tabbed">
        <nav className="studiotabs" role="tablist">
          {(['query', 'results', 'session'] as Pane[]).map((p) => (
            <button key={p} role="tab" aria-selected={pane === p}
                    className={`studiotab${pane === p ? ' is-on' : ''}`} onClick={() => setPane(p)}>
              {p === 'query' ? 'Query' : p === 'session' ? 'Interactive' : progress.live ? 'Results ●' : 'Results'}
            </button>
          ))}
        </nav>

      <div className="studio-pane studio-pane-query" hidden={pane !== 'query'}>
        {/* Ask sits ABOVE the query, not beside it. Tucked into the rail it was the last thing
            anyone found, and "describe what you want" is the shortest path into this surface for
            someone who does not write Cypher — it has to be the first thing on the page. */}
        <Ask onLand={land} current={() => handle.getText()} />
        {/* HISTORY LIVES WITH THE QUERY — it is past queries, and its one action is
            "put that back in the editor". In the rail it sat below Schema, where nobody
            found it (twice); dimmed and below the editor, it hid a third time. ABOVE the
            editor, undimmed, collapsed until wanted. */}
        <details className="queryhistory" ref={historyRef}>
          <summary className="queryhistory-title">History · {history.length}</summary>
          {history.length === 0 ? <p className="hint">Queries you run land here.</p> : (
            <div className="historylist">
              {history.map((entry) => {
                const firstLine = entry.cypher.split('\n').find((l) => l.trim() && !l.trim().startsWith('//')) ?? entry.cypher
                return (
                  <button className="history-item" key={entry.at} title={entry.cypher} onClick={() => recall(entry.cypher)}>
                    <span className="history-cypher">{firstLine}</span>
                    <span className="history-meta">{entry.rows == null ? '· not run' : `· ${entry.rows} row(s)`}</span>
                  </button>
                )
              })}
            </div>
          )}
        </details>
        <StudioPanel
          title="Query"
          aside={validity.violations.length > 0 && !showViolations
            ? (
              <button className="status error as-link" onClick={() => setShowViolations(true)}>
                {validity.text} — show
              </button>
            )
            : <Status tone={validity.tone}>{validity.text}</Status>}
        >
          {/* Copy lives ON the query box, where the thing being copied is. */}
          <div className="editor-wrap">
            <div className="editor-host" ref={editorRef} />
            <CopyButton label="Copy" text={handle.getText()} />
          </div>
          {showViolations && validity.violations.length > 0 && (
            <div className="verdict">
              {validity.violations.map((v, i) => <div className="violation" key={i}>{v}</div>)}
            </div>
          )}
          <div className="row studio-actions">
            <button
              className="btn primary"
              disabled={running || validity.tone !== 'ok'
                || validatedCypher.current !== completeQuery(handle.getText()).cypher}
              onClick={() => void run()}
            >
              {running ? 'running…' : 'Run ⌘⏎'}
            </button>
            {/* Only while there is something to stop — a permanently disabled Stop teaches that the
                feature does not work. It stays clickable while stopping: the second press is
                harmless, and greying it out mid-kill reads as a hang. */}
            {running && (
              <button className="btn ghost" onClick={() => void stop()}>
                {stopping ? 'stopping…' : 'Stop'}
              </button>
            )}
            <SaveView current={() => handle.getText()} />
            <CaptureScope current={() => handle.getText()} onCaptured={() => setScopesVersion((v) => v + 1)} />
            <StartFill current={() => completeQuery(handle.getText()).cypher} onStarted={() => setFillsVersion((v) => v + 1)} />
            <span className="hint">⌃Space completes from the schema</span>
          </div>
        </StudioPanel>
      </div>

      <div className="studio-pane" hidden={pane !== 'results'}>
        {/* Table / Raw / Stats / Trace share one selector. Trace selects itself while a run is
            live so progress is visible without hiding the eventual result. */}
        <StudioPanel
          title="Results"
          aside={
            (ran || progress.lines.length > 0) && (
              <span className="viewtabs" role="tablist">
                {(['table', 'raw', 'stats', 'trace'] as ResultView[]).map((v) => (
                  <button key={v} role="tab" aria-selected={view === v}
                          className={`viewtab${view === v ? ' is-on' : ''}`} onClick={() => setView(v)}>
                    {v === 'trace' && progress.live ? 'Trace ●' : v[0]!.toUpperCase() + v.slice(1)}
                  </button>
                ))}
              </span>
            )
          }
        >
          {view === 'table' && (
            !ran ? <p className="hint">Nothing run yet.</p> :
            rows.length === 0 ? <p className="hint">No rows.</p> :
            <RowTable rows={rows} columns={columns} />
          )}
          {/* Raw is the underlying JSON — the escape hatch for a shape the table flattens away. */}
          {view === 'raw' && (
            !ran ? <p className="hint">Nothing run yet.</p> :
            <pre className="rawresult">{JSON.stringify(result ?? rows, null, 2)}</pre>
          )}
          {view === 'stats' && <ResultStats result={result} rowCount={rows.length} ran={ran} />}
          {view === 'trace' && (
            <div className="progresslist" ref={progressRef}>
              {progress.lines.map((line) => (
                <div className={`progressline${line.failed ? ' failed' : ''}`} key={line.key}>{line.text}</div>
              ))}
              {progress.lines.length === 0 && (
                <p className="hint">
                  {progress.live
                    ? 'Waiting for the engine to report…'
                    : 'No trace — a query with no virtual labels never materializes anything, so there is nothing to narrate.'}
                </p>
              )}
            </div>
          )}
          {/* The run's own account — row count, duration, warnings, emptiness hints — reads AFTER
              the rows it describes, where the eye lands. Me's order, and its reasoning. */}
          <div className="row results-foot">
            {ran && rows.length > 0 && view === 'table' && (
              <>
                <CopyButton label="Copy as Markdown" text={rowsToMarkdown(rows)} />
                <CopyButton label="Copy as CSV" text={rowsToCsv(rows)} />
              </>
            )}
            <Status tone={runStatus.tone}>{runStatus.text}</Status>
          </div>
        </StudioPanel>
      </div>

      {/* Hidden, not unmounted, like the other panes: the transcript and bindings are state
          worth keeping across tab switches. */}
      <div className="studio-pane" hidden={pane !== 'session'}>
        <SessionPane
          onCaptured={() => setScopesVersion((v) => v + 1)}
          onOpenInEditor={(cypher) => { land(cypher); setPane('query') }}
        />
      </div>

      </div>
    </div>
  )
}

// ── ask: English in, Cypher out ───────────────────────────────────────────────────────────────

/**
 * Generation only, never execution. The appliance can generate and run in one call (`/ask`), but a
 * studio that ran generated Cypher before showing it would spend the user's money on a query they
 * never saw. Generate, land it in the editor, let them read it, let them press Run.
 */
function Ask({ onLand, current }: { onLand(cypher: string): void; current(): string }) {
  const { services } = useQueryRuntime()
  const [question, setQuestion] = useState('')
  const [instruction, setInstruction] = useState('')
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<{ tone: 'ok' | 'error' | null; text: string }>({ tone: null, text: '' })
  const [explanation, setExplanation] = useState('')

  async function go(refine: boolean) {
    // Two boxes, two questions: one describes the query you want, the other the change you want
    // made to the one on screen. Sharing a box made "refine" read as a second Write.
    const text = (refine ? instruction : question).trim()
    if (!text) return
    setBusy(true)
    setExplanation('')
    setStatus({ tone: null, text: refine ? 'Revising your query…' : 'Writing the Cypher — an LLM call, give it a moment…' })
    const outcome = refine ? await services.kg.refine(current(), text) : await services.kg.generate(text)
    setBusy(false)
    if (!isOk(outcome)) {
      return setStatus({ tone: 'error', text: failureMessage(outcome, refine ? 'query refinement' : 'query generation') })
    }
    const generated = outcome.value
    if (!generated.cypher) return setStatus({ tone: 'error', text: 'Nothing came back.' })
    onLand(generated.cypher)
    setExplanation(generated.explain ?? '')
    // Generation reports the preflight verdict on what it wrote, so a query that will be rejected
    // says so here rather than at Run.
    setStatus(generated.valid
      ? { tone: 'ok', text: 'Landed in the editor — read it before you run it.' }
      : { tone: 'error', text: `Landed, but it has ${(generated.violations ?? []).length} schema problem(s).` })
  }

  return (
    <StudioPanel title="Ask">
      <div className="ask-row">
        <input
          value={question}
          placeholder="which documents mention the renewal? · files about trip logistics…"
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') void go(false) }}
        />
        <button className="btn primary" disabled={busy} onClick={() => void go(false)}>Write the query</button>
      </div>
      <div className="ask-row">
        <input
          value={instruction}
          placeholder="refine what's in the editor: also show the margin · sort by state · drop the limit…"
          onChange={(e) => setInstruction(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') void go(true) }}
        />
        {/* Refine sends the query that is IN the editor, so it revises what you are looking at
            rather than regenerating around your words. */}
        <button className="btn" disabled={busy || !current().trim()} onClick={() => void go(true)}>Refine</button>
      </div>
      <Status tone={status.tone}>{status.text}</Status>
      {explanation && <p className="hint">{explanation}</p>}
    </StudioPanel>
  )
}

// ── the schema browser ────────────────────────────────────────────────────────────────────────

/**
 * The query a label should OPEN with.
 *
 * An anchor label reads bare. A reach-only one — `anchor: false`, meaning the engine will not let
 * it open a pattern — is composed REACHED, through an edge from an anchor the schema actually
 * shows, because the bare scan is precisely what the preflight rejects. Handing someone a query
 * that cannot run is worse than handing them nothing.
 *
 * `anchor` is absent on an older appliance, and absent is read as true: a server that does not
 * express the distinction has no reach-only labels to protect.
 */
function useQuery(schema: KgSchema | null, label: { label: string; anchor?: boolean }): string {
  const bare = `MATCH (n:${label.label})\nRETURN n LIMIT 25`
  if (label.anchor !== false) return bare
  const anchors = new Set(anchorLabels(schema as unknown as GraphSchema))
  const relationships = (schema?.relationships ?? []) as Array<{ from: string; type: string; to: string }>
  const inbound = relationships.find((r) => r.to === label.label && anchors.has(r.from))
  if (inbound) return `MATCH (a:${inbound.from})-[:${inbound.type}]->(n:${label.label})\nRETURN n LIMIT 25`
  const outbound = relationships.find((r) => r.from === label.label && anchors.has(r.to))
  if (outbound) return `MATCH (n:${label.label})-[:${outbound.type}]->(a:${outbound.to})\nRETURN n LIMIT 25`
  // Nothing in the schema reaches it. Say so in the query rather than composing a scan that fails.
  return `// ${label.label} is reach-only: traverse to it from a bound anchor\n${bare}`
}

/**
 * The engine's OWN snapshot, virtual labels included — the same one validation checks against and
 * completion offers from. A hand-maintained list of labels would be a fourth reading of the graph
 * and the first to go stale.
 */
function SchemaPanel({ schema, onInsert, onReload }: {
  schema: KgSchema | null
  onInsert(cypher: string): void
  onReload?(): void
}) {
  const [filter, setFilter] = useState('')
  const [open, setOpen] = useState<string | null>(null)
  const labels = (schema?.labels ?? []) as Array<{
    label: string
    realm?: string
    description?: string
    anchor?: boolean
    properties?: Array<{ name: string; description?: string }>
  }>
  const needle = filter.trim().toLowerCase()
  // Alphabetical, not server order: the panel is a lookup, and lookups sort.
  const shown = (needle ? labels.filter((l) => l.label.toLowerCase().includes(needle)) : labels)
    .slice().sort((a, b) => a.label.localeCompare(b.label))

  return (
    <StudioPanel
      title="Schema"
      aside={
        <span className="hint">
          {labels.length} labels
          {onReload && (
            <button className="btn ghost tiny" title="Re-read the schema — after installing a realm" onClick={onReload}>↻</button>
          )}
        </span>
      }
    >
      {schema == null ? <p className="hint">loading…</p> : (
        <>
          <input value={filter} placeholder="filter labels" onChange={(e) => setFilter(e.target.value)} />
          <div className="schemalist">
            {shown.map((label) => (
              <div className="schemarow" key={label.label}>
                <button className="schemaname" onClick={() => setOpen((o) => (o === label.label ? null : label.label))}>
                  <strong>{definitionTitle(label)}</strong>
                  {/* Reach-only is worth saying out loud: it explains why `use` composes a
                      traversal rather than the scan someone might expect. */}
                  {label.anchor === false && <span className="viewtag">reach-only</span>}
                </button>
                <button
                  className="btn ghost tiny"
                  title={useQuery(schema, label)}
                  onClick={() => onInsert(useQuery(schema, label))}
                >
                  Query
                </button>
                {/* The description belongs to the OPENED row: a rail of full sentences reads as a
                    wall; a rail of names reads as an index, which is what this panel is. */}
                {open === label.label && label.description && <small className="schemadesc">{label.description}</small>}
                {open === label.label && (
                  <ul className="proplist">
                    {(label.properties ?? []).map((p) => (
                      <li key={p.name}><code>{p.name}</code>{p.description && <span> — {p.description}</span>}</li>
                    ))}
                    {(label.properties ?? []).length === 0 && <li className="hint">no declared properties</li>}
                  </ul>
                )}
              </div>
            ))}
            {shown.length === 0 && <p className="hint">nothing matches "{filter}"</p>}
          </div>
        </>
      )}
    </StudioPanel>
  )
}


// ── keeping what you wrote ────────────────────────────────────────────────────────────────────

/**
 * Save the query in the editor as a named view. Writing one belongs HERE, next to the thing being
 * written; browsing and running them is the Views tab.
 *
 * The APPLIANCE persists it — a console never edits world YAML itself, so what is stored is what
 * the server validated.
 */
export function SaveView({ current }: { current(): string }) {
  const { services } = useQueryRuntime()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<{ tone: 'ok' | 'error' | null; text: string }>({ tone: null, text: '' })
  /** Set when the saved body is not the body typed — see the note where it is assigned. */
  const [promoted, setPromoted] = useState<{ cypher: string; note?: string } | null>(null)

  // The parameters this query declares, so saving one tells you what it will ask for.
  const declared = open ? declaredParams(current()) : []

  /** This query's scope references, so the panel can say what promoting it will do BEFORE it runs. */
  const scopeRefs = open ? [...new Set([...current().matchAll(/`\$([A-Za-z_]\w*)`/g)].map((m) => m[1]))] : []

  async function save() {
    const viewName = name.trim()
    const cypher = current().trim()
    if (!viewName || !cypher) return setStatus({ tone: 'error', text: 'a view needs a name and a query' })
    setBusy(true)
    const outcome = await services.kg.saveView(
      description.trim() ? { name: viewName, cypher, description: description.trim() } : { name: viewName, cypher },
    )
    setBusy(false)
    if (!isOk(outcome)) return setStatus({ tone: 'error', text: failureMessage(outcome, 'saving views') })
    if (!outcome.value.ok) {
      // THE APPLIANCE'S OWN WORDS. "The appliance refused it" threw away the one thing the
      // refusal was written to carry — which scope blocks the save, that it was captured with
      // LIMIT so its members are particular rows from one moment, and that a view re-runs. The
      // reader could act on that sentence and could do nothing at all with ours.
      const refusal = (outcome.value as { error?: string }).error
      return setStatus({ tone: 'error', text: refusal || `The appliance refused '${viewName}'.` })
    }
    // PROMOTION IS NOT SILENT. A body written against captured scopes is stored with each
    // reference replaced by what the scope was captured from, so what the world keeps is not
    // the text that was typed. Showing it is the difference between the feature being true and
    // the author knowing it happened — and the note carries the part that changes underneath
    // them: a scope holds rows frozen at capture, a view asks the question again.
    setPromoted(outcome.value.savedCypher ? { cypher: outcome.value.savedCypher, note: outcome.value.note } : null)
    setStatus({ tone: 'ok', text: `Saved '${viewName}' — it is in the Views tab.` })
    setName('')
    setDescription('')
  }

  if (!open) return <button className="btn" onClick={() => setOpen(true)}>Save as view…</button>

  return (
    <div className="saveview">
      <div className="row">
        <label className="field">
          <span>Name</span>
          <input value={name} placeholder="recent_contracts" onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="field grow">
          <span>Description</span>
          <input value={description} placeholder="what this view answers" onChange={(e) => setDescription(e.target.value)} />
        </label>
      </div>
      {declared.length > 0 && (
        <p className="hint">Declares {declared.map((p) => `$${p}`).join(', ')} — they become its parameters.</p>
      )}
      {scopeRefs.length > 0 && (
        <p className="hint">
          Uses {scopeRefs.map((s) => `$${s}`).join(', ')} — saving inlines what each was captured from,
          because a scope expires and a view must not.
        </p>
      )}
      {promoted && (
        <div className="promoted">
          <p className="hint">Saved as — scope references written out, so it runs on its own:</p>
          <pre className="promoted-cypher">{promoted.cypher}</pre>
          {promoted.note && <p className="hint">{promoted.note}</p>}
        </div>
      )}
      <div className="row">
        <button className="btn primary" disabled={busy} onClick={() => void save()}>{busy ? 'saving…' : 'Save to this world'}</button>
        <button className="btn ghost" onClick={() => { setOpen(false); setStatus({ tone: null, text: '' }); setPromoted(null) }}>Cancel</button>
        <Status tone={status.tone}>{status.text}</Status>
      </div>
    </div>
  )
}

// ── captured scopes: the REPL bindings ────────────────────────────────────────────────────────

/**
 * The session rail's scope list — the appliance's frozen result-set bindings, per acting user.
 * A scope is CONSUMED in a query as (x:`$name`); Use lands exactly that, opened as a peek. The
 * membership is frozen but the values are live, and the panel says so once rather than per row.
 *
 * Absent endpoint = older appliance: the panel says CONTRACT GAP once and stops asking, the same
 * honesty rule as the other surfaces on this door.
 */
/*
 * A FILL, AS THE SERVER ACTUALLY SENDS IT.
 *
 * `/admin/kg/fills` is outside the guarded OpenAPI snapshot, so this type is hand-written — which
 * is exactly the hazard `api.ts` names: "a hand-written type here would be a guess wearing a
 * type's clothes". This one guessed wrong. The server's `Fill` keeps its DEFINITION separate from
 * the half that changes every tick (`VcFillService.Fill` / `FillProgress`), so `state`, `ticks`,
 * `liveCallsTotal` and `lastError` arrive nested under `progress` — not flat, as this declared.
 *
 * The cost of that one wrong shape was the whole Query Studio tab: `f.state` was undefined,
 * `.toLowerCase()` threw during render, and React unmounted the tree to a blank page for anyone
 * who had a fill on record.
 *
 * So every field the panel reads is optional here and defaulted at the point of use. A type that
 * cannot be generated should claim the least it can get away with, not the most.
 */
/* "Run slowly": hand the query to the fill driver instead of this tab. The right verb for a
 * deep `periods:` history or an open sweep — the appliance advances it a budgeted, source-paced
 * chunk every couple of minutes, survives restarts, and the Fills panel carries the progress. */
function StartFill({ current, onStarted }: { current(): string; onStarted(): void }) {
  const { services } = useQueryRuntime()
  const [busy, setBusy] = useState(false)
  const start = async () => {
    const cypher = current().trim()
    if (!cypher) return
    setBusy(true)
    const r = await services.fills.create(cypher, (cypher.split('\n')[0] ?? '').slice(0, 60))
    setBusy(false)
    if (r.ok) onStarted()
  }
  return (
    <button className="btn ghost" disabled={busy} onClick={() => void start()}
            title="Run this query as a background fill: a budgeted chunk every couple of minutes until nothing is left to fetch. For deep histories and open sweeps.">
      {busy ? 'starting…' : 'Fill'}
    </button>
  )
}

/* EARN THE RAIL SPACE, same rule as Scopes: the panel exists only while fills exist. Polls while
 * any fill is RUNNING — progress is the point — and goes quiet once everything is DONE. */
function FillsPanel({ version }: { version: number }) {
  const { services } = useQueryRuntime()
  const [fills, setFills] = useState<KgFill[] | null>(null)
  const [supported, setSupported] = useState(true)

  useEffect(() => {
    if (!supported) return
    let stop = false
    const load = async () => {
      const r = await services.fills.list()
      if (stop) return
      if (!r.ok) {
        if (r.status === 404) setSupported(false)
        return
      }
      setFills(r.value)
      if (r.value.some((f) => f.progress?.state === 'RUNNING')) setTimeout(() => { if (!stop) void load() }, 20000)
    }
    void load()
    return () => { stop = true }
  }, [version, supported, services])

  if (!supported || fills == null || fills.length === 0) return null

  const cancel = async (id: string) => {
    await services.fills.delete(id)
    const r = await services.fills.list()
    if (r.ok) setFills(r.value)
  }

  return (
    <StudioPanel
      title="Fills"
      aside={<span className="hint">slow background materializations</span>}
    >
      <div className="schemalist">
        {fills.map((f) => (
          <div className="schemarow" key={f.id}>
            <div className="schemaname" title={f.cypher}>
              <strong>{f.label || f.id}</strong>
              {/* Read once, defaulted once. A fill whose progress has not been written yet is a
                  real state — it was just started — and it reads as "pending" rather than
                  taking the tab down. */}
              <span className={`viewtag${f.progress?.state === 'RUNNING' ? '' : f.progress?.lastError ? ' is-bad' : ''}`}>
                {(f.progress?.state ?? 'pending').toLowerCase()}
              </span>
              <small>
                {f.progress?.ticks ?? 0} tick(s) · {f.progress?.liveCallsTotal ?? 0} live call(s)
                {f.progress?.lastError ? ` · ${f.progress.lastError.slice(0, 60)}` : ''}
              </small>
            </div>
            {f.progress?.state === 'RUNNING' && (
              <button className="btn ghost tiny" title="Stop driving this fill — everything fetched stays cached"
                      onClick={() => void cancel(f.id)}>
                Cancel
              </button>
            )}
          </div>
        ))}
      </div>
    </StudioPanel>
  )
}

function ScopesPanel({ version, onInsert }: { version: number; onInsert(cypher: string): void }) {
  const { services } = useQueryRuntime()
  const [scopes, setScopes] = useState<KgScopeInfo[] | null>(null)
  const [supported, setSupported] = useState(true)
  const [status, setStatus] = useState('')

  useEffect(() => {
    if (!supported) return
    void (async () => {
      const outcome = await services.kg.scopes()
      if (!isOk(outcome)) {
        if (isAbsent(outcome)) setSupported(false)
        return
      }
      setScopes(outcome.value.scopes ?? [])
    })()
  }, [version, supported, services])

  const act = async (label: string, call: () => Promise<unknown>) => {
    setStatus(label)
    await call()
    setStatus('')
    const outcome = await services.kg.scopes()
    if (isOk(outcome)) setScopes(outcome.value.scopes ?? [])
  }

  /* EARN THE RAIL SPACE. An empty scopes panel above (or below) the schema is noise that
   * made the rail confusing — the panel appears once a capture EXISTS, which is also the
   * moment its contents mean something. An appliance without the surface shows nothing here;
   * the Interactive pane reports that honestly at the moment of a capture attempt. */
  if (!supported || scopes == null || scopes.length === 0) return null

  return (
    <StudioPanel
      title="Scopes"
      aside={<span className="hint">frozen rows, live values</span>}
    >
      {scopes == null ? <p className="hint">loading…</p> : scopes.length === 0 ? (
        <p className="hint">Run a query with “Capture as scope” and its rows become a named binding here.</p>
      ) : (
        <div className="schemalist">
          {scopes.map((scope) => (
            <div className="schemarow" key={scope.name}>
              <button
                className="schemaname"
                title={scope.statement}
                onClick={() => onInsert(`MATCH ${scopeReference(scope.name, 'x')}\nRETURN x LIMIT 25`)}
              >
                <strong>${scope.name}</strong>
                {scope.expiresAt == null && <span className="viewtag">pinned</span>}
                <small>{scope.outputLabel} · {scope.members} member(s)</small>
              </button>
              {scope.expiresAt != null && (
                <button className="btn ghost tiny" title="Keep this scope until you delete it"
                        onClick={() => void act(`pinning ${scope.name}…`, () => services.kg.pinScope(scope.name))}>
                  Pin
                </button>
              )}
              <button className="btn ghost tiny" title="Delete this scope"
                      onClick={() => void act(`deleting ${scope.name}…`, () => services.kg.deleteScope(scope.name))}>
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
      {status && <p className="hint">{status}</p>}
    </StudioPanel>
  )
}

/**
 * Run the query in the editor AND freeze its result set as a named scope — the appliance's
 * capture-on-execute, synchronous by contract. Kept beside Save-as-view deliberately: one keeps
 * the QUESTION, the other keeps this run's ROWS. The appliance refuses a projection (tabular —
 * nothing to freeze) and its message lands here verbatim.
 */
function CaptureScope({ current, onCaptured }: { current(): string; onCaptured(): void }) {
  const { services } = useQueryRuntime()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<{ tone: 'ok' | 'error' | null; text: string }>({ tone: null, text: '' })

  async function capture() {
    const scopeName = name.trim()
    // Same completion as Run and the Session tab: `MATCH (c:Chunk)` captures without a RETURN.
    const { cypher } = completeQuery(current())
    if (!cypher) return setStatus({ tone: 'error', text: 'nothing to capture — write a query first' })
    if (!scopeName) return setStatus({ tone: 'error', text: 'name the scope — the name is how a later query references it' })
    setBusy(true)
    setStatus({ tone: null, text: 'Running and freezing the result set…' })
    const outcome = await services.kg.execute(cypher, { captureAs: scopeName })
    setBusy(false)
    if (!isOk(outcome)) return setStatus({ tone: 'error', text: failureMessage(outcome, 'capturing a scope') })
    if (isBackgroundHandle(outcome.value)) {
      return setStatus({ tone: 'error', text: 'The appliance parked this run — capture is synchronous-only.' })
    }
    const result = outcome.value
    if (result.error) return setStatus({ tone: 'error', text: result.error })
    const captured = result.capturedScope
    if (!captured) return setStatus({ tone: 'error', text: 'The run finished but nothing was captured.' })
    setStatus({
      tone: 'ok',
      text: `Captured ${captured.members} member(s) as $${captured.name} — reference it as (x:\`$${captured.name}\`).`,
    })
    setName('')
    onCaptured()
  }

  if (!open) return <button className="btn" onClick={() => setOpen(true)}>Capture as scope…</button>

  return (
    <div className="saveview">
      <div className="row">
        <label className="field">
          <span>Scope name</span>
          <input value={name} placeholder="overdue" onChange={(e) => setName(e.target.value)} />
        </label>
        <button className="btn primary" disabled={busy} onClick={() => void capture()}>
          {busy ? 'capturing…' : 'Run & capture'}
        </button>
        <button className="btn ghost" onClick={() => { setOpen(false); setStatus({ tone: null, text: '' }) }}>Cancel</button>
      </div>
      <Status tone={status.tone}>{status.text}</Status>
    </div>
  )
}

// ── stats ─────────────────────────────────────────────────────────────────────────────────────

/**
 * What the run COST, in the Vaadin Cypher console's terms: wall time, external fetches, LLM calls,
 * rows — and then the calls themselves, in order.
 *
 * The logs are the point. `apiCallLog` is every fetch as `producer(key)`, in the order it
 * happened, so a repeated line is an N+1 fan-out you can SEE rather than infer from a duration.
 * `llmCallLog` is separate because a model call is a different kind of expensive from a fetch.
 *
 * All of it already rode on the execute response and was being discarded.
 */
function ResultStats({ result, rowCount, ran }: { result: KgQueryResult | null; rowCount: number; ran: boolean }) {
  if (!ran || !result) return <p className="hint">Nothing run yet.</p>
  const fetches = result.apiCallLog ?? []
  const llm = result.llmCallLog ?? []
  return (
    <div className="stats">
      <div className="statline"><span>Time</span><strong>{formatDuration(result.durationMs ?? 0)}</strong></div>
      <div className="statline"><span>API calls</span><strong>{(result.apiCalls ?? 0).toLocaleString()}</strong></div>
      <div className="statline"><span>LLM calls</span><strong>{(result.llmCalls ?? 0).toLocaleString()}</strong></div>
      <div className="statline"><span>Rows</span><strong>{(result.rowCount ?? rowCount).toLocaleString()}</strong></div>
      {fetches.length > 0 && (
        <div className="calllog">
          <div className="subhead">Fetches ({fetches.length})</div>
          {fetches.map((c, i) => <div className="callline" key={i}>{c}</div>)}
        </div>
      )}
      {llm.length > 0 && (
        <div className="calllog">
          <div className="subhead">LLM calls ({llm.length})</div>
          {llm.map((c, i) => <div className="callline" key={i}>{c}</div>)}
        </div>
      )}
      {fetches.length === 0 && llm.length === 0 && (
        <p className="hint">No external fetches and no model calls — this ran entirely on the graph.</p>
      )}
    </div>
  )
}
