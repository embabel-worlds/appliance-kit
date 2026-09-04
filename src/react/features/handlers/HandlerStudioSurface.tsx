/*
 * HANDLER STUDIO — the sibling of Query Studio, for TypeScript event handlers: smallish programs
 * handed the triggering `signal` (or a cron tick) that read the graph and take effects through the
 * typed `gateway.*` surface.
 *
 * The honesty guarantees are Query Studio's, transplanted:
 *
 *  - Completion reads the appliance's OWN generated surface (`interfaces.ts`, parsed by the kit's
 *    `code-surface`) — the same file that types code-mode — so what the editor offers and what
 *    compiles cannot drift apart.
 *  - Validity is the engine's own `tsc` gate, debounced as you type; save runs the same gate as a
 *    hard stop, so "valid here" and "saved there" agree.
 *  - The safe verb is primary: dry-run is observe-only ON THE APPLIANCE, against a real recent
 *    signal it names in the result. Enabling and scheduling — the acts that let a handler actually
 *    act on the world — are separate, and marked.
 *  - Cypher inside `kg` calls completes through the kit's vc semantics, the same package Query
 *    Studio composes from.
 *
 * Until recently this could not have been written here at all: the appliance's handler endpoints
 * answered untyped maps and were outside the guarded snapshot, so there was nothing to generate a
 * client from. They are typed and guarded now, and this is the first surface built on that.
 */

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import {
  type HandlerAvailable,
  type HandlerListing,
  type HandlerSource,
} from '../../../client/handlers.ts'
import { isOk } from '../../../client/outcome.ts'
import { type GatewaySurface, type SurfaceMethod, gatewayPathAt, membersOf, parseSurface } from '../../../code-surface/index.ts'
import { cypherFragmentCompletions, formatDuration } from '../../../studio-kit/index.ts'
import * as Vc from '../../../vc/index.ts'
import type { HandlerDraft, HandlerStudioServices, HandlerStudioSurfaceProps, SignalType, WorldSkill } from '../contracts.ts'
import { CodeMirror, useEditor } from '../studio/editor.ts'
import { CopyButton, Status, StudioPanel, failureMessage, isAbsent } from '../studio/chrome.tsx'

/** `try { … } catch { '' }` as an expression — used where a bad value must not break a render. */
function runCatching(f: () => string): string {
  try { return f() } catch { return '' }
}

/** The ambient vocabulary a handler body has in scope, beyond the gateway. */
const KEYWORDS = [
  'await', 'const', 'let', 'if', 'else', 'for', 'of', 'return', 'try', 'catch', 'throw',
  'gateway', 'signal', 'trigger', 'now', 'dryRun', 'console.log', 'JSON.stringify',
]

const STARTER = `// A handler reacts: \`signal\` is the triggering event (or undefined on a cron
// tick), and \`gateway.*\` is your typed surface — Ctrl-Space completes both.
// Dry-run is observe-only: effects are suppressed, output comes back here.

console.log('triggered by', signal?.typeName ?? 'cron tick')
`

/*
 * Completion state lives outside the component for the same reason Query Studio's schema does: the
 * hint is registered against the CodeMirror singleton, once, and must read the CURRENT surface
 * rather than whatever had arrived when it was installed.
 */
const state: {
  surface: GatewaySurface | null
  schema: unknown
  sample: Record<string, unknown> | null
} = { surface: null, schema: null, sample: null }

/** Cypher inside a `kg` call — the fragment doubles as its own alias source. */
function cypherContext(before: string): string | null {
  // The last unterminated single- or backtick-quoted string, when it looks like Cypher. Small and
  // stable enough to read directly; anything more would be parsing TypeScript to complete it.
  const match = before.match(/(?:kg\.\w+\(\s*\{[^}]*?(?:query|cypher)\s*:\s*)(['`])((?:[^'`\\]|\\.)*)$/)
  return match ? match[2] ?? null : null
}

let hintRegistered = false
function registerHint() {
  if (hintRegistered) return
  hintRegistered = true
  const CM = CodeMirror as any
  /* The return is CodeMirror's hint shape — `{list, from, to}` with `Pos` values CM5 exports no
   * type for. Stated as `any` at the boundary rather than restated here, which would be a second
   * declaration of someone else's structure. */
  CM.registerHelper('hint', 'javascript', (editor: any): any => {
    const cursor = editor.getCursor()
    const before = editor.getLine(cursor.line).slice(0, cursor.ch)
    const found = (list: string[], from: number) => ({
      list: [...list].sort((a, b) => a.localeCompare(b)),
      from: CM.Pos(cursor.line, from),
      to: CM.Pos(cursor.line, cursor.ch),
    })

    // gateway.… → the appliance's own generated surface, never an invented list.
    const path = gatewayPathAt(before)
    if (path) {
      const members = membersOf(state.surface, path.path)
      return found(
        members.filter((m) => m.name.toLowerCase().startsWith(path.stem.toLowerCase())).map((m) => m.name),
        cursor.ch - path.stem.length,
      )
    }

    // signal.… → the keys of the sampled signal, so what you complete is what will be bound.
    let m
    if ((m = before.match(/\bsignal\.(\w*)$/))) {
      const stem = m[1] ?? ''
      const keys = state.sample ? Object.keys(state.sample) : []
      return found(keys.filter((k) => k.toLowerCase().startsWith(stem.toLowerCase())), cursor.ch - stem.length)
    }

    const embedded = cypherContext(before)
    if (embedded !== null) {
      const c = cypherFragmentCompletions(Vc as any, state.schema, embedded, embedded)
      if (c) return found(c.list, cursor.ch - c.stemLength)
    }

    if ((m = before.match(/(\w+)$/))) {
      const stem = m[1] ?? ''
      return found(KEYWORDS.filter((w) => w.toLowerCase().startsWith(stem.toLowerCase())), cursor.ch - stem.length)
    }
    return null
  })
}

/**
 * The gateway surface arrives as TypeScript SOURCE, not JSON, so it cannot go through the kit's
 * transport — which parses every body as JSON. Same origin, same ambient credentials as everything
 * else here.
 */
async function fetchSurface(services: HandlerStudioServices): Promise<GatewaySurface | null> {
  const outcome = await services.gatewayInterfaces()
  return outcome.ok ? parseSurface(outcome.value) : null
}

interface HandlerRuntime { services: HandlerStudioServices }
const HandlerRuntimeContext = createContext<HandlerRuntime | null>(null)
function useHandlerRuntime(): HandlerRuntime {
  const runtime = useContext(HandlerRuntimeContext)
  if (!runtime) throw new Error('HandlerStudioSurface runtime is missing')
  return runtime
}

export function HandlerStudioSurface({
  services,
  draft,
  onDraftConsumed,
}: HandlerStudioSurfaceProps) {
  return (
    <HandlerRuntimeContext.Provider value={{ services }}>
      <HandlerStudioBody draft={draft} onDraftConsumed={onDraftConsumed} />
    </HandlerRuntimeContext.Provider>
  )
}

function HandlerStudioBody({ draft, onDraftConsumed }: { draft?: HandlerDraft | null; onDraftConsumed?(): void }) {
  const { services } = useHandlerRuntime()
  const [surface, setSurface] = useState<GatewaySurface | null>(null)
  const [catalogue, setCatalogue] = useState<SignalType[] | null>(null)
  /* The skills bundled with the agent being authored. Owned here because BOTH halves need them:
     Ask hands them to the writing model, Save persists them with the action. */
  const [skills, setSkills] = useState<string[]>([])
  const [installed, setInstalled] = useState<WorldSkill[]>([])
  const [yours, setYours] = useState<HandlerListing[]>([])
  const [available, setAvailable] = useState<HandlerAvailable[]>([])
  const [listError, setListError] = useState('')
  const [openName, setOpenName] = useState<string | null>(null)

  const [validity, setValidity] = useState<{ tone: 'ok' | 'error' | null; text: string; violations: string[] }>(
    { tone: null, text: '', violations: [] },
  )
  const [runStatus, setRunStatus] = useState<{ tone: 'ok' | 'error' | 'caution' | null; text: string }>(
    { tone: null, text: '' },
  )
  const [output, setOutput] = useState<{ stdout: string; ranAgainst: string } | null>(null)
  const [busy, setBusy] = useState(false)
  /*
   * ARRIVING FROM A WATCH. The Views tab writes `{signalType, view}` and sends the browser here,
   * so "Write an agent for it" lands on an editor whose trigger is already the signal the watch
   * publishes — the step where the journey used to end, with somebody copying a signal type by
   * hand and getting it subtly wrong.
   *
   * Read once and CLEARED, because it is a handoff rather than a preference: coming back to this
   * tab later should not silently re-prefill a trigger nobody asked for this time.
   */
  const [signalType, setSignalType] = useState(draft?.signalType ?? '')
  useEffect(() => {
    if (!draft) return
    setSignalType(draft.signalType)
    onDraftConsumed?.()
  }, [draft, onDraftConsumed])

  const validateSupported = useRef(true)
  const validateTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  // A compile spins the sandbox, so an edit that undid itself must not buy the same verdict twice.
  const lastValidated = useRef<string | null>(null)

  const dryRunRef = useRef<() => void>(() => {})
  /* Both callbacks go through refs rather than being passed directly. `scheduleValidation`
   * reaches `validateNow`, which reads `handle` — which comes out of this very call — so naming it
   * here would be a circular inference TypeScript gives up on. The ref breaks the cycle and, as a
   * bonus, keeps the editor from caring that a callback identity moved. */
  const editRef = useRef<() => void>(() => {})
  const { ref: editorRef, handle } = useEditor({
    mode: 'text/typescript',
    onRun: () => dryRunRef.current(),
    onEdit: () => editRef.current(),
  })

  registerHint()

  useEffect(() => {
    void (async () => {
      const parsed = await fetchSurface(services)
      state.surface = parsed
      setSurface(parsed)
      const schema = await services.kg.schema()
      state.schema = isOk(schema) ? schema.value : null
    })()
  }, [services])

  // The editor starts with the starter rather than empty: an empty box does not tell you that
  // `signal` and `gateway` are in scope, and that is the whole shape of a handler.
  const seeded = useRef(false)
  useEffect(() => {
    if (seeded.current || !handle.editor) return
    seeded.current = true
    handle.setText(STARTER)
  }, [handle])

  const loadHandlers = useCallback(async () => {
    const outcome = await services.handlers.list()
    if (!isOk(outcome)) return setListError(failureMessage(outcome, 'the handlers surface'))
    setListError('')
    setYours(outcome.value.yours ?? [])
    setAvailable(outcome.value.available ?? [])
  }, [services])
  useEffect(() => { void loadHandlers() }, [loadHandlers])

  /* WHAT THIS WORLD CAN NOTICE — fetched once. A null catalogue means the appliance predates the
     endpoint, and the trigger falls back to a free-text box rather than an empty list, which would
     read as "this world notices nothing". */
  useEffect(() => {
    let stop = false
    void (async () => {
      const [types, world] = await Promise.all([
        services.signalTypes(),
        services.worldSkills(),
      ])
      if (stop) return
      setCatalogue(types.ok ? types.value : null)
      setInstalled(world.ok ? world.value : [])
    })()
    return () => { stop = true }
  }, [services])

  // ── validation: the appliance's tsc gate ────────────────────────────────────────────────────
  const validateNow = useCallback(async (): Promise<void> => {
    const source = handle.getText().trim()
    if (!source) return setValidity({ tone: null, text: '', violations: [] })
    if (source === lastValidated.current) return
    const outcome = await services.handlers.validate(source)
    if (!isOk(outcome)) {
      if (isAbsent(outcome)) validateSupported.current = false
      return setValidity({ tone: null, text: '', violations: [] })
    }
    lastValidated.current = source
    const { valid, violations = [], durationMs } = outcome.value
    setValidity(valid
      ? { tone: 'ok', text: `✓ compiles · ${formatDuration(durationMs ?? 0)}`, violations: [] }
      : { tone: 'error', text: `${violations.length} type error(s)`, violations })
  }, [handle, services])

  const scheduleValidation = useCallback((): void => {
    if (!validateSupported.current) return
    if (validateTimer.current) clearTimeout(validateTimer.current)
    setValidity((v) => ({ ...v, tone: null, text: '…' }))
    // Generous next to Query Studio's 700ms: this one spins a sandbox and runs tsc.
    validateTimer.current = setTimeout((): void => void validateNow(), 1500)
  }, [validateNow])
  editRef.current = scheduleValidation

  // ── the safe verb ───────────────────────────────────────────────────────────────────────────
  const dryRun = useCallback(async (): Promise<void> => {
    const source = handle.getText().trim()
    if (!source) return
    setBusy(true)
    setOutput(null)
    setRunStatus({ tone: null, text: 'Running observe-only on the appliance…' })
    const outcome = await services.handlers.dryRun(source, signalType || undefined)
    setBusy(false)
    if (!isOk(outcome)) return setRunStatus({ tone: 'error', text: failureMessage(outcome, 'handler dry runs') })
    const result = outcome.value
    // What it RAN AGAINST, not what was asked for: a signal type with nothing on record falls back
    // to a cron tick, and reporting the request would tell you it saw an event it never saw.
    const ranAgainst = `${result.ranAgainst?.signalType ?? '?'} · ${result.ranAgainst?.signalId ?? '?'}`
    setOutput({ stdout: result.stdout ?? '', ranAgainst })
    setRunStatus(result.ok
      ? { tone: 'ok', text: `ran against ${ranAgainst}` }
      : { tone: 'error', text: result.error ?? 'the handler threw' })
  }, [handle, signalType, services])
  dryRunRef.current = () => void dryRun()

  async function open(name: string) {
    const outcome = await services.handlers.open(name)
    if (!isOk(outcome)) return setRunStatus({ tone: 'error', text: failureMessage(outcome, 'opening handlers') })
    const spec: HandlerSource = outcome.value
    handle.setText(spec.source ?? '')
    setOpenName(spec.name ?? name)
    setSignalType(spec.signalType && spec.signalType !== '*' ? spec.signalType : '')
    // Round-tripped, or saving an edit would quietly unbundle every skill the agent had.
    setSkills(((spec as unknown as { skills?: string[] }).skills) ?? [])
    lastValidated.current = null
    scheduleValidation()
  }

  async function setEnabled(name: string, enabled: boolean) {
    const outcome = await services.handlers.setEnabled(name, enabled)
    if (!isOk(outcome)) return setListError(failureMessage(outcome, 'enabling handlers'))
    void loadHandlers()
  }

  async function remove(name: string) {
    if (!confirm(`Delete the agent '${name}'?`)) return
    const outcome = await services.handlers.delete(name)
    if (!isOk(outcome)) return setListError(failureMessage(outcome, 'deleting handlers'))
    if (openName === name) setOpenName(null)
    void loadHandlers()
  }

  return (
    <div className="kit-feature kit-feature-handlers studio">
      <div className="studio-side">
        <HandlersList
          yours={yours}
          available={available}
          error={listError}
          openName={openName}
          onOpen={(n) => void open(n)}
          onToggle={(n, on) => void setEnabled(n, on)}
          onDelete={(n) => void remove(n)}
        />
        <SignalsPanel catalogue={catalogue} onPick={(t) => setSignalType(t)} />
        <SurfacePanel surface={surface} />
      </div>

      <div className="studio-main">
        <Ask onLand={(source) => { handle.setText(source); lastValidated.current = null; scheduleValidation() }}
             current={() => handle.getText()}
             installed={installed} skills={skills} onSkills={setSkills} />
        <StudioPanel
          title={openName ? `Agent · ${openName}` : 'Agent'}
          aside={<Status tone={validity.tone}>{validity.text}</Status>}
        >
          <div className="editor-host" ref={editorRef} />
          {validity.violations.length > 0 && (
            <div className="verdict">
              {validity.violations.map((v, i) => <div className="violation" key={i}>{v}</div>)}
            </div>
          )}
          <div className="row studio-actions">
            <button className="btn primary" disabled={busy} onClick={() => void dryRun()}>
              {busy ? 'running…' : 'Dry run'}
            </button>
            <label className="field inline">
              <span>against</span>
              <input value={signalType} placeholder="most recent signal · blank = cron tick"
                     onChange={(e) => setSignalType(e.target.value)} />
            </label>
            <CopyButton label="Copy" text={handle.getText()} />
          </div>
          <p className="hint">
            Dry run is observe-only and happens on the appliance — effects are suppressed. Saving,
            enabling and scheduling are what let a handler act; they are below, and separate.
          </p>
          <Status tone={runStatus.tone}>{runStatus.text}</Status>
        </StudioPanel>

        <StudioPanel title="Output" aside={output && <span className="hint">ran against {output.ranAgainst}</span>}>
          {!output ? <p className="hint">Dry run output appears here.</p> :
           output.stdout.trim() === '' ? <p className="hint">The handler logged nothing.</p> :
           <pre className="runoutput">{output.stdout}</pre>}
        </StudioPanel>

        <SavePanel
          source={() => handle.getText()}
          defaultName={openName ?? ''}
          defaultSignalType={signalType}
          catalogue={catalogue}
          skills={skills}
          onSaved={() => { void loadHandlers() }}
        />
      </div>
    </div>
  )
}

/*
 * THE LADDER. The server stores two booleans; what they MEAN is three states, and only the
 * third one can do anything you would want to undo.
 *
 * Deriving it here rather than storing a third field is deliberate: `active` and `autonomous`
 * remain the truth, and a console that invented its own stage column would be one refresh away
 * from disagreeing with the appliance about whether something is running.
 */
type Stage = 'proposed' | 'watching' | 'acting'

export function stageOf(h: { active: boolean; autonomous: boolean }): Stage {
  if (!h.active) return 'proposed'
  return h.autonomous ? 'acting' : 'watching'
}

const STAGE_SAYS: Record<Stage, string> = {
  proposed: 'Saved and idle. It fires at nothing and changes nothing.',
  watching: 'Live, observe-only. It runs for real on real events and logs what it WOULD do.',
  acting: 'Live and permitted to apply effects. This is the state with consequences.',
}

// ── the handlers list ─────────────────────────────────────────────────────────────────────────

function HandlersList({ yours, available, error, openName, onOpen, onToggle, onDelete }: {
  yours: HandlerListing[]
  available: HandlerAvailable[]
  error: string
  openName: string | null
  onOpen(name: string): void
  onToggle(name: string, enabled: boolean): void
  onDelete(name: string): void
}) {
  return (
    <StudioPanel title="Agents">
      {error ? <Status tone="error">{error}</Status> : (
        <>
          {yours.length === 0 && available.length === 0 && (
            /*
             * AN EMPTY LIST IS A MENU, NOT A SENTENCE.
             *
             * "No agents yet" beside an empty editor is the original problem in miniature: it tells
             * somebody the tab is empty and leaves them to invent what could fill it. These are the
             * three real routes in, in the order they cost effort — the cheapest first, because the
             * point is to own one agent today, not to write the best one.
             */
            <div className="emptymenu">
              <p className="hint">Nothing runs unattended in this world yet. Three ways to start:</p>
              <a className="emptyroute" href="#views">
                <strong>Watch a saved view</strong>
                <small>a question you already trust, on a schedule — it publishes a signal when the answer moves</small>
              </a>
              <button className="emptyroute" onClick={() => document.querySelector('.ask-row.tall textarea')?.scrollIntoView({ behavior: 'smooth', block: 'center' })}>
                <strong>Describe one in English</strong>
                <small>the Ask above writes it, type-checks it against this world, and lands it in the editor</small>
              </button>
              <a className="emptyroute" href="#realms">
                <strong>Install a realm that ships agents</strong>
                <small>a realm brings its own — observe-only until you adopt them</small>
              </a>
            </div>
          )}
          {yours.length > 0 && <div className="subhead">yours</div>}
          {yours.map((h) => (
            <div className={`handler-row ${h.name === openName ? 'active' : ''}`} key={h.name}>
              <button className="handlername" onClick={() => onOpen(h.name)}>
                <strong>{h.name}</strong>
                <small>
                  {h.signalType && h.signalType !== '*' ? `on ${h.signalType}` : 'no trigger'}
                  {h.schedule ? ` · cron ${h.schedule}` : ''}
                  {' · '}
                  <span className={`stage ${stageOf(h)}`} title={STAGE_SAYS[stageOf(h)]}>{stageOf(h)}</span>
                </small>
              </button>
              {/* The arming verb is styled apart from the safe ones: enabling is the moment a
                  handler starts acting on the world without anyone watching. */}
              <button className={`btn tiny ${h.active ? 'ghost' : 'arm'}`} onClick={() => onToggle(h.name, !h.active)}>
                {h.active ? 'Stand down' : 'Start watching'}
              </button>
              <button className="btn ghost tiny" onClick={() => onDelete(h.name)}>Delete</button>
            </div>
          ))}
          {available.length > 0 && <div className="subhead">available to adopt</div>}
          {available.map((h) => (
            <div className="handler-row" key={h.name}>
              <button className="handlername" onClick={() => onOpen(h.name)}>
                <strong>{h.name}</strong>
                <small>{h.signalType && h.signalType !== '*' ? `on ${h.signalType}` : 'no trigger'} · from a realm</small>
              </button>
              {/* A realm handler can only be adopted or left alone — deleting someone else's
                  shipped handler is not this console's to offer. */}
              <button className="btn tiny arm" onClick={() => onToggle(h.name, true)}>Adopt</button>
            </div>
          ))}
        </>
      )}
    </StudioPanel>
  )
}

// ── ask ───────────────────────────────────────────────────────────────────────────────────────

/**
 * English → handler, with the compiler's verdict already attached. Generation only: what comes
 * back lands in the editor and is never run, for the same reason Query Studio generates without
 * asking.
 */
function Ask({ onLand, current, installed, skills, onSkills }: {
  onLand(source: string): void
  current(): string
  installed: { name: string; description: string }[]
  skills: string[]
  onSkills(next: string[]): void
}) {
  const { services } = useHandlerRuntime()
  const [english, setEnglish] = useState('')
  const [instruction, setInstruction] = useState('')
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<{ tone: 'ok' | 'error' | 'caution' | null; text: string }>({ tone: null, text: '' })

  async function go(refine: boolean) {
    /* TWO BOXES, TWO QUESTIONS — Query Studio's arrangement, and for its reason: one describes the
       agent you want, the other the change you want made to the one on screen. Shared, "refine"
       reads as a second Write and the text you wrote for one is wrong for the other. */
    const text = (refine ? instruction : english).trim()
    if (!text) return
    setBusy(true)
    setStatus({ tone: null, text: `The appliance is ${refine ? 'revising' : 'writing'} your agent — an LLM call plus a compile…` })
    const r = await services.generateHandler(text, refine ? current() : undefined, skills)
    setBusy(false)
    if (!r.ok) return setStatus({ tone: 'error', text: r.message })
    const generated = r.value
    onLand(generated.source ?? '')
    // `attempts` of 2 means the model was handed its own type errors and fixed them — worth
    // saying, because it explains the wait.
    const attempts = (generated.attempts ?? 1) > 1 ? ` after ${generated.attempts} attempts` : ''
    setStatus(generated.valid
      ? { tone: 'ok', text: `Written and it compiles${attempts}.` }
      : { tone: 'caution', text: `Written${attempts}, but it does not compile — the errors are on the editor.` })
  }

  /* ⌘/Ctrl-Enter, not Enter. Query Studio's asks are one-line inputs where Enter can submit; an
     agent is described in a paragraph — what it reacts to, what it should check, when it should
     stay quiet — so Enter has to make a new line and the shortcut moves to the modifier. */
  const submitOn = (refine: boolean) => (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); void go(refine) }
  }

  return (
    <StudioPanel title="Ask">
      <div className="ask-row tall">
        <textarea
          rows={5}
          value={english}
          placeholder={'when a review is requested on one of my PRs, tell me whether the author has contributed before\n\nevery weekday at 8, digest the PRs waiting on me — one message, not one each'}
          onChange={(e) => setEnglish(e.target.value)}
          onKeyDown={submitOn(false)}
        />
        <button className="btn primary" disabled={busy} onClick={() => void go(false)}>Write it</button>
      </div>
      <div className="ask-row tall">
        <textarea
          rows={2}
          value={instruction}
          placeholder="refine what's in the editor: only for my own repos · skip drafts · say nothing when there is nothing"
          onChange={(e) => setInstruction(e.target.value)}
          onKeyDown={submitOn(true)}
        />
        {/* Refine sends the source that is IN the editor, so it revises what you are looking at
            rather than regenerating around your words. */}
        <button className="btn" disabled={busy || !current().trim()} onClick={() => void go(true)}>Refine</button>
      </div>
      <SkillPicker installed={installed} chosen={skills} onChange={onSkills} />
      <Status tone={status.tone}>{status.text}</Status>
      <p className="hint">⌘/Ctrl-Enter submits; Enter is a new line.</p>
    </StudioPanel>
  )
}

/*
 * BUNDLING SKILLS WITH AN AGENT.
 *
 * A skill is a realm's own account of how to work with it — `realm-github` ships one that teaches
 * search-then-get, safe pagination and the pitfalls. None of that reached the model that writes
 * agents, so it re-derived idioms the realm had already documented and got them subtly wrong.
 *
 * Chosen by the AUTHOR rather than judged by the model: chat activates a skill because the LLM
 * decides relevance mid-conversation, but somebody bundling one here has already decided. The
 * chosen set is saved with the agent, so refining it a month later is briefed exactly as it was
 * written.
 */
function SkillPicker({ installed, chosen, onChange }: {
  installed: { name: string; description: string }[]
  chosen: string[]
  onChange(next: string[]): void
}) {
  if (installed.length === 0) {
    return (
      <p className="hint">
        No skills installed. The <a href="#skills">Skills</a> tab brings them in — a realm's own
        instructions make a better agent than a model guessing at its idioms.
      </p>
    )
  }
  const toggle = (name: string) =>
    onChange(chosen.includes(name) ? chosen.filter((n) => n !== name) : [...chosen, name])

  return (
    <div className="skillpicker">
      <div className="subhead">Bundle skills</div>
      <div className="skillchips">
        {installed.map((s) => (
          <button
            key={s.name}
            className={`skillchip${chosen.includes(s.name) ? ' is-on' : ''}`}
            title={s.description || s.name}
            aria-pressed={chosen.includes(s.name)}
            onClick={() => toggle(s.name)}
          >
            {s.name}
          </button>
        ))}
      </div>
      <p className="hint">
        {chosen.length === 0
          ? 'None bundled — the model writes from the world’s schema and gateway surface alone.'
          : `${chosen.length} bundled — put in front of the model that writes and refines this agent, and saved with it.`}
      </p>
    </div>
  )
}

// ── the gateway surface browser ───────────────────────────────────────────────────────────────

/** The appliance's own generated `interfaces.ts`, read for names and docs — not type-checked. */
function SurfacePanel({ surface }: { surface: GatewaySurface | null }) {
  const [filter, setFilter] = useState('')
  const needle = filter.trim().toLowerCase()
  const matches = (m: SurfaceMethod) => !needle || m.name.toLowerCase().includes(needle)

  return (
    <StudioPanel title="Gateway">
      {surface == null ? (
        <p className="hint">
          The appliance did not offer a generated surface — completion falls back to the ambient
          vocabulary.
        </p>
      ) : (
        <>
          <input value={filter} placeholder="filter verbs" onChange={(e) => setFilter(e.target.value)} />
          <div className="surfacelist">
            {surface.methods.filter(matches).map((m) => (
              <div className="surfacerow" key={m.name}>
                <code>gateway.{m.signature}</code>
                {m.doc && <small>{m.doc}</small>}
              </div>
            ))}
            {surface.namespaces.map((ns) => {
              const shown = ns.methods.filter(matches)
              if (shown.length === 0) return null
              return (
                <div className="surfacens" key={ns.name}>
                  <div className="subhead">gateway.{ns.name}</div>
                  {shown.map((m) => (
                    <div className="surfacerow" key={m.name}>
                      <code>{m.signature}</code>
                      {m.doc && <small>{m.doc}</small>}
                    </div>
                  ))}
                </div>
              )
            })}
          </div>
        </>
      )}
    </StudioPanel>
  )
}

// ── saving, and the acts that let a handler act ───────────────────────────────────────────────

/**
 * Save is tsc-gated on the appliance — a handler that does not compile is never persisted, so a
 * false `ok` here is the compiler's verdict rather than a failed request.
 *
 * Enabling and scheduling are deliberately NOT folded into save. A saved handler that is off
 * changes nothing; the moment it is on, it runs unattended on real events. That is a different
 * decision from "keep this text", and it reads as one.
 */
function SavePanel({ source, defaultName, defaultSignalType, catalogue, skills, onSaved }: {
  source(): string
  defaultName: string
  defaultSignalType: string
  /** The live catalogue, so the trigger is completed from what exists rather than remembered. */
  catalogue: SignalType[] | null
  /** Chosen in the Ask panel above, persisted here — the bundle is part of the agent. */
  skills: string[]
  onSaved(): void
}) {
  const { services } = useHandlerRuntime()
  const [name, setName] = useState(defaultName)
  const [signalType, setSignalType] = useState(defaultSignalType)
  const [schedule, setSchedule] = useState('')
  const [autonomous, setAutonomous] = useState(false)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<{ tone: 'ok' | 'error' | null; text: string }>({ tone: null, text: '' })

  // Opening a handler renames the box, so saving edits to it does not silently fork a copy.
  useEffect(() => { setName(defaultName) }, [defaultName])
  useEffect(() => { setSignalType(defaultSignalType) }, [defaultSignalType])

  async function save() {
    const handlerName = name.trim()
    if (!handlerName) return setStatus({ tone: 'error', text: 'a handler needs a name' })
    setBusy(true)
    const r = await services.saveHandler({
      name: handlerName,
      source: source(),
      signalType: signalType.trim() || '*',
      schedule: schedule.trim() || undefined,
      autonomous,
      skills,
    })
    setBusy(false)
    if (!r.ok) return setStatus({ tone: 'error', text: r.message })
    setStatus({ tone: r.value.ok ? 'ok' : 'error', text: r.value.message ?? '' })
    if (r.value.ok) onSaved()
  }

  return (
    <StudioPanel title="Save">
      <div className="saveform">
        <label className="field">
          <span>Name</span>
          <input value={name} placeholder="pr-triage" onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="field">
          <span>Fires on</span>
          <input
            value={signalType}
            list="signal-types"
            placeholder={catalogue && catalogue.length > 0
              ? `${catalogue[0]!.typeName} · blank = no signal trigger`
              : 'PullRequestOpened · blank = no signal trigger'}
            onChange={(e) => setSignalType(e.target.value)}
          />
          {/* A datalist rather than a select: a signal type the world has not seen YET is still a
              legitimate trigger — an agent for an event that has never arrived is exactly what you
              write before the first one does. Completion, not a closed set. */}
          <datalist id="signal-types">
            {(catalogue ?? []).map((t) => <option key={t.typeName} value={t.typeName} />)}
          </datalist>
        </label>
        <label className="field">
          <span>Cron</span>
          <input value={schedule} placeholder="0 0 9 * * * · blank = not scheduled"
                 onChange={(e) => setSchedule(e.target.value)} />
        </label>
        <label className="field checkbox">
          <input type="checkbox" checked={autonomous} onChange={(e) => setAutonomous(e.target.checked)} />
          <span>May act — apply real effects, not just observe</span>
        </label>
      </div>
      <button className="btn" disabled={busy} onClick={() => void save()}>{busy ? 'saving…' : 'Save agent'}</button>
      {skills.length > 0 && (
        <p className="hint">Bundled skills: {skills.join(', ')} — saved with it, and used when you refine it.</p>
      )}
      <p className="hint">
        Saving stores it. It stays <em>proposed</em> until you start it watching — that is the act
        that lets it run unattended, and letting it <em>act</em> is a second one.
      </p>
      <Status tone={status.tone}>{status.text}</Status>
    </StudioPanel>
  )
}

/** One signal type this world receives, as the catalogue reports it. */
/*
 * WHAT THIS WORLD CAN NOTICE — the question that has to occur to somebody before they can write an
 * agent at all, and which this console could not answer until now. `action_brief` has handed the
 * same catalogue to coding agents all along; the human surface offered a text box and a
 * placeholder, so the only people who could name a trigger were the ones who already knew one.
 *
 * The COUNT is not decoration. A type with four hundred events last month and one with a single
 * event in March are both "available", and are completely different propositions to build on. The
 * old box presented them identically, which is how somebody writes an agent for an event that will
 * never fire again.
 */
function SignalsPanel({ catalogue, onPick }: {
  catalogue: SignalType[] | null
  onPick(typeName: string): void
}) {
  const [filter, setFilter] = useState('')
  const [open, setOpen] = useState<string | null>(null)

  if (catalogue == null) {
    return (
      <StudioPanel title="What this world notices">
        <p className="hint">
          This appliance does not publish a signal catalogue — the trigger stays a typed name.
        </p>
      </StudioPanel>
    )
  }

  const needle = filter.trim().toLowerCase()
  const shown = catalogue.filter((t) => !needle || t.typeName.toLowerCase().includes(needle))

  return (
    <StudioPanel title="What this world notices">
      {catalogue.length === 0 ? (
        <p className="hint">
          No signals on record yet. Install a realm that produces events, or watch a view — a watch
          publishes <code>view.&lt;name&gt;.changed</code>, which is a signal like any other.
        </p>
      ) : (
        <>
          <input value={filter} placeholder="filter signal types" onChange={(e) => setFilter(e.target.value)} />
          <div className="surfacelist">
            {shown.map((t) => (
              <div className="signalrow" key={t.typeName}>
                <button className="signalname" onClick={() => setOpen(open === t.typeName ? null : t.typeName)}>
                  <code>{t.typeName}</code>
                  <small>
                    {t.count > 0 ? `${t.count} in 30 days` : 'none in 30 days'}
                    {t.lastSeen ? ` · last ${t.lastSeen.slice(0, 10)}` : ''}
                  </small>
                </button>
                <button className="btn ghost tiny" onClick={() => onPick(t.typeName)}>Use</button>
                {open === t.typeName && (
                  <div className="signalfields">
                    {t.fields.length === 0
                      ? <small className="hint">No fields sampled.</small>
                      : t.fields.map((f) => <code key={f}>signal.{f}</code>)}
                  </div>
                )}
              </div>
            ))}
            {shown.length === 0 && <p className="hint">Nothing matches that filter.</p>}
          </div>
        </>
      )}
    </StudioPanel>
  )
}
