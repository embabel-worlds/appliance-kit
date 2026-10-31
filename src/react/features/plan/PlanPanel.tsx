/*
 * THE PLAN PANEL: what the appliance's planner makes of a goal, shown while it is being written.
 *
 * A goal is the final query someone wants answered, written over facts that may not exist yet —
 * an Issue projected from meeting notes, a TRACKED_BY edge a judging view draws. The planner finds
 * the views and rules that make those facts and compiles them into one statement. This panel asks
 * it, as the goal settles, and shows the answer: which facts the goal reads and what produces each,
 * the chain of steps in the order they run, what each one reaches beyond the stored graph, and the
 * one statement they compile to.
 *
 * TYPING NEVER RUNS ANYTHING. The as-you-type call is `plan`, whose route on the appliance cannot
 * execute a step, call a model or read a source. Running is `runPlan`, behind a button, and nothing
 * else in this file reaches it. A plan whose steps ask a model costs money and time every run; a
 * keystroke must not be what spends it.
 *
 * Every outcome is an answer, and each is shown as one: `unreachable` names the fact nothing
 * produces, `tie` names the rival plans, `refused` says what to change. None is an error state.
 *
 * A step's cost class — stored, API, AI — is read from what the appliance says the step REACHES,
 * not from its numeric cost: the number comes from a heuristic a deployment can replace, and a label
 * inferred from it would be a guess about whichever one is installed.
 *
 * The chain is a list, not a diagram. Nothing either console ships draws Mermaid, and a plan is a
 * sequence; adding a diagram library to draw a sequence would be weight for nothing.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react'
import type { KgPlanAnswer, KgPlanInputs, KgPlanStep } from '../../../client/kg.ts'
import { rowColumns } from '../../../vc/rows.ts'
import type { PlanPanelProps } from '../contracts.ts'
import { RowTable, Status, failureMessage, isAbsent } from '../studio/chrome.tsx'

const DEFAULT_DEBOUNCE_MS = 700

interface InputRow {
  id: number
  name: string
  type: string
  value: string
}

/**
 * A fact as the planner writes it, as a person reads it: `node:Issue` is an Issue,
 * `edge:Attendee-RAISED->Issue` is the pattern it would be in a query. Anything else is shown as
 * sent rather than guessed at.
 */
export function factLabel(fact: string): string {
  if (fact.startsWith('node:')) return fact.slice('node:'.length)
  if (fact.startsWith('input:')) return `${fact.slice('input:'.length)} input`
  const edge = /^edge:([^-]+)-([^-]+)->(.+)$/.exec(fact)
  if (edge) return `(${edge[1]})-[:${edge[2]}]->(${edge[3]})`
  return fact
}

/** Stored, API or AI: what a step goes beyond the graph for, from what it reaches. */
export function costClass(step: Pick<KgPlanStep, 'reaches'>): string {
  const api = step.reaches.includes('api')
  const model = step.reaches.includes('model')
  if (api && model) return 'API + AI'
  if (model) return 'AI'
  if (api) return 'API'
  return 'stored'
}

/* Only inputs with a name and a value are sent: a row still being filled in is not an input yet. */
function inputsOf(rows: InputRow[]): KgPlanInputs {
  const inputs: KgPlanInputs = {}
  for (const row of rows) {
    const name = row.name.trim()
    if (name && row.value.trim()) inputs[name] = { type: row.type.trim() || 'text', value: row.value }
  }
  return inputs
}

function Fact({ fact }: { fact: string }) {
  return <code className="planfact" title={fact}>{factLabel(fact)}</code>
}

function Producers({ answer }: { answer: KgPlanAnswer }) {
  const reads = answer.reads ?? []
  if (!reads.length) return null
  const steps = answer.steps ?? []
  return (
    <div className="planreads">
      <h3>What the goal reads</h3>
      <ul>
        {reads.map((fact) => {
          const makers = steps.filter((step) => step.adds.includes(fact)).map((step) => step.from)
          return (
            <li key={fact}>
              <Fact fact={fact} />
              <span className="planfrom">
                {fact.startsWith('input:') ? ' ← what you supply' : makers.length ? ` ← ${makers.join(', ')}` : ''}
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function Chain({ steps }: { steps: KgPlanStep[] }) {
  return (
    <ol className="planchain">
      {steps.map((step) => (
        <li key={step.from} className="planstep">
          <div className="planstep-head">
            <strong>{step.from}</strong>
            <span className="plantag">{step.kind}</span>
            <span className={`plantag plancost plancost-${costClass(step).replace(/\W+/g, '').toLowerCase()}`}
              title={`Cost ${step.cost} in the planner's units`}>{costClass(step)}</span>
            {step.realm && <span className="hint">from {step.realm}</span>}
            {!step.runs && <span className="hint">fires when read</span>}
          </div>
          {step.adds.length > 0 && <div className="planstep-facts">adds {step.adds.map((f) => <Fact key={f} fact={f} />)}</div>}
          {step.requires.length > 0 && <div className="planstep-facts">needs {step.requires.map((f) => <Fact key={f} fact={f} />)}</div>}
        </li>
      ))}
    </ol>
  )
}

function Quote({ answer }: { answer: KgPlanAnswer }) {
  const quote = answer.quote
  if (!quote) return null
  const parts: string[] = []
  if (quote.modelCalls != null) parts.push(`~${quote.modelCalls} model call(s)`)
  if (quote.apiCalls != null) parts.push(`~${quote.apiCalls} API call(s)`)
  return (
    <div className="planquote">
      {parts.length > 0 && <div className="hint">Quote: {parts.join(', ')}</div>}
      {quote.wouldRefuse && <Status tone="caution">The cost gate would refuse this run: {quote.wouldRefuse}</Status>}
      {quote.unpriced.map((line) => <div key={line} className="hint">{line}</div>)}
    </div>
  )
}

/** The answer itself, one branch per outcome. */
function Outcome({ answer }: { answer: KgPlanAnswer }) {
  switch (answer.outcome) {
    case 'planned':
      /* A goal over stored data alone needs no step; the planner says so by choosing none. */
      if (!(answer.steps ?? []).length) {
        return <div className="hint planstored">This reads only what the world already holds: no step is needed, so it runs as written.</div>
      }
      return (
        <>
          <Producers answer={answer} />
          <h3>The chain</h3>
          <Chain steps={answer.steps ?? []} />
          <Quote answer={answer} />
        </>
      )
    case 'unreachable':
      return (
        <div className="planunreachable">
          {(answer.missing ?? []).map((fact) => (
            <Status key={fact} tone="caution">Nothing produces <Fact fact={fact} />.</Status>
          ))}
          {answer.detail && <div className="hint">{answer.detail}</div>}
        </div>
      )
    case 'tie':
      return (
        <div className="plantie">
          <Status tone="caution">
            {(answer.plans ?? []).length} plans reach this at the same cost. Make the goal more specific to choose between them.
          </Status>
          <ul>
            {(answer.plans ?? []).map((plan) => <li key={plan.join('>')}>{plan.join(' → ')}</li>)}
          </ul>
        </div>
      )
    /* The two English-mode answers. The panel sends a goal, so these arrive only from a host that asks a question. */
    case 'needsInput':
      return (
        <Status tone="caution">
          This needs {answer.needsInput?.type === 'text' ? 'some text' : `a ${answer.needsInput?.type}`} as input: {answer.needsInput?.why}
        </Status>
      )
    case 'declined':
      return (
        <div className="planunreachable">
          {answer.reason && <Status tone="caution">{answer.reason}</Status>}
          {(answer.missing ?? []).map((fact) => (
            <Status key={fact} tone="caution">Nothing produces <Fact fact={fact} />.</Status>
          ))}
        </div>
      )
    default:
      return (
        <div className="planrefused">
          {(answer.reasons ?? []).map((reason) => <Status key={reason} tone="error">{reason}</Status>)}
        </div>
      )
  }
}

const HEADLINE: Record<string, string> = {
  planned: 'Planned',
  unreachable: 'Not reachable',
  tie: 'Tied',
  refused: 'Cannot plan this as written',
  needsInput: 'Needs an input',
  declined: 'Declined',
}

export function PlanPanel({ services, goal, debounceMs = DEFAULT_DEBOUNCE_MS, onShowCompiled }: PlanPanelProps) {
  const [answer, setAnswer] = useState<KgPlanAnswer | null>(null)
  const [planning, setPlanning] = useState(false)
  const [problem, setProblem] = useState('')
  const [absent, setAbsent] = useState(false)
  const [rows, setRows] = useState<InputRow[]>([])
  const [inputsOpen, setInputsOpen] = useState(false)
  const [compiledOpen, setCompiledOpen] = useState(false)
  const [run, setRun] = useState<{ answer?: KgPlanAnswer; problem?: string } | null>(null)
  const [running, setRunning] = useState(false)
  const [saveOpen, setSaveOpen] = useState(false)
  const [viewName, setViewName] = useState('')
  const [viewDescription, setViewDescription] = useState('')
  const [saveStatus, setSaveStatus] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null)
  const nextRow = useRef(1)
  const latest = useRef(0)

  const inputs = useMemo(() => inputsOf(rows), [rows])
  const inputsKey = JSON.stringify(inputs)
  const trimmed = goal.trim()

  /*
   * The dry run, once the goal and inputs have been still for `debounceMs`. Each request takes a
   * number and only the newest may land, so a slow answer about an older goal never overwrites the
   * answer about the current one. Unmounting bumps the number too.
   */
  useEffect(() => {
    const n = ++latest.current
    setRun(null)
    if (!trimmed || absent) {
      setAnswer(null)
      setPlanning(false)
      if (!absent) setProblem('')
      return
    }
    setPlanning(true)
    const timer = setTimeout(async () => {
      const result = await services.plan(trimmed, JSON.parse(inputsKey) as KgPlanInputs)
      if (n !== latest.current) return
      setPlanning(false)
      if (!result.ok) {
        /* An appliance without a planner says so once and then stays quiet, rather than on every keystroke. */
        if (isAbsent(result)) setAbsent(true)
        setProblem(failureMessage(result, 'plan this goal'))
        setAnswer(null)
        return
      }
      setProblem('')
      setAnswer(result.value)
    }, debounceMs)
    return () => clearTimeout(timer)
  }, [trimmed, inputsKey, services, debounceMs, absent])

  useEffect(() => () => { latest.current++ }, [])

  async function runIt() {
    if (!trimmed || running) return
    setRunning(true)
    const result = await services.runPlan(trimmed, inputs)
    setRunning(false)
    setRun(result.ok ? { answer: result.value } : { problem: failureMessage(result, 'run this plan') })
  }

  async function save(event: React.FormEvent) {
    event.preventDefault()
    const name = viewName.trim()
    if (!name || !services.saveGoalView) return
    const result = await services.saveGoalView({ name, goal: trimmed, description: viewDescription.trim() })
    setSaveStatus(result.ok
      ? { tone: 'ok', text: `Saved as ${result.value.name ?? name}.` }
      : { tone: 'error', text: failureMessage(result, 'save this goal as a view') })
  }

  function updateRow(id: number, patch: Partial<InputRow>) {
    setRows((current) => current.map((row) => row.id === id ? { ...row, ...patch } : row))
  }

  if (!trimmed) {
    return (
      <div className="kit-feature kit-feature-plan plan">
        <p className="hint">Write the query you want answered, over the facts you want made, and the plan shows here.</p>
      </div>
    )
  }

  const planned = answer?.outcome === 'planned'
  return (
    <div className="kit-feature kit-feature-plan plan" aria-busy={planning}>
      <div className="planhead">
        <strong>{answer ? HEADLINE[answer.outcome] ?? answer.outcome : planning ? 'Planning…' : 'Plan'}</strong>
        {answer && planning && <span className="hint">updating…</span>}
      </div>
      {problem && <Status tone={absent ? null : 'error'}>{problem}</Status>}
      {answer && <Outcome answer={answer} />}
      {answer?.diagnostics && answer.diagnostics.length > 0 && (
        <details className="plandiagnostics">
          <summary>{answer.diagnostics.length} step(s) left out of planning</summary>
          <ul>{answer.diagnostics.map((line) => <li key={line}>{line}</li>)}</ul>
        </details>
      )}

      <div className="row planactions">
        <button className="btn" disabled={!planned}
          onClick={() => (onShowCompiled && answer?.compiled ? onShowCompiled(answer.compiled) : setCompiledOpen((open) => !open))}>
          {compiledOpen && !onShowCompiled ? 'Hide compiled' : 'Show compiled'}
        </button>
        <button className="btn" aria-expanded={inputsOpen} onClick={() => setInputsOpen((open) => !open)}>Run with input…</button>
        {services.saveGoalView && (
          <button className="btn" aria-expanded={saveOpen} onClick={() => setSaveOpen((open) => !open)}>Save as goal view</button>
        )}
      </div>

      {compiledOpen && !onShowCompiled && planned && answer?.compiled && (
        <pre className="plancompiled">{answer.compiled}</pre>
      )}

      {inputsOpen && (
        <div className="planinputs">
          {rows.map((row) => (
            <div key={row.id} className="row planinput">
              <input aria-label="Input name" placeholder="name, e.g. notes" value={row.name}
                onChange={(e) => updateRow(row.id, { name: e.target.value })} />
              <input aria-label="Input type" placeholder="text, or a spine label" value={row.type}
                onChange={(e) => updateRow(row.id, { type: e.target.value })} />
              {row.type.trim() === 'text' || !row.type.trim()
                ? <textarea aria-label="Input value" placeholder="the text — an email, meeting notes" value={row.value}
                  onChange={(e) => updateRow(row.id, { value: e.target.value })} />
                : <input aria-label="Input value" placeholder="the entity's key" value={row.value}
                  onChange={(e) => updateRow(row.id, { value: e.target.value })} />}
              <button className="btn" onClick={() => setRows((current) => current.filter((r) => r.id !== row.id))}>Remove</button>
            </div>
          ))}
          <div className="row">
            <button className="btn" onClick={() => setRows((current) => [...current, { id: nextRow.current++, name: '', type: 'text', value: '' }])}>
              Add input
            </button>
            <button className="btn primary" disabled={!planned || running} onClick={() => void runIt()}>
              {running ? 'Running…' : 'Run plan'}
            </button>
          </div>
          {!planned && <div className="hint">Run is offered once the goal plans.</div>}
        </div>
      )}

      {run?.problem && <Status tone="error">{run.problem}</Status>}
      {run?.answer && <RunResult answer={run.answer} />}

      {saveOpen && services.saveGoalView && (
        <form className="plansave" onSubmit={(e) => void save(e)}>
          <input aria-label="View name" placeholder="ViewName" value={viewName} onChange={(e) => setViewName(e.target.value)} />
          <input aria-label="View description" placeholder="what it answers, in one line" value={viewDescription}
            onChange={(e) => setViewDescription(e.target.value)} />
          <button className="btn primary" type="submit" disabled={!viewName.trim()}>Save</button>
          {saveStatus && <Status tone={saveStatus.tone}>{saveStatus.text}</Status>}
        </form>
      )}
    </div>
  )
}

/* A run that did not plan comes back as that outcome, so it is shown the way the dry run would be. */
function RunResult({ answer }: { answer: KgPlanAnswer }) {
  if (answer.outcome !== 'planned') return <Outcome answer={answer} />
  const rows = (answer.rows ?? []) as Array<Record<string, unknown>>
  return (
    <div className="planrun">
      {answer.error && <Status tone="error">{answer.error}</Status>}
      {(answer.warnings ?? []).map((warning) => <Status key={warning} tone="caution">{warning}</Status>)}
      {!answer.error && (rows.length
        ? <RowTable rows={rows} columns={rowColumns(rows)} />
        : <div className="hint">No rows.</div>)}
    </div>
  )
}
