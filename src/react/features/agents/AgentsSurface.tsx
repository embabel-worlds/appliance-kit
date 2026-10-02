/*
 * AGENTS — the colleagues in a world, whether each is on duty, and what each still needs.
 *
 * An agent is a named role with a job and someone who answers for it (its sponsor), holding the
 * routines and duties it does. Its stage is a ladder people already understand: off duty; on duty,
 * observing (it runs, and writes nothing); on duty. Every word on this surface is chosen for the
 * person who answers for the agent, not for whoever wrote its code: no "handler", no "autonomous".
 *
 * Two things are shown that a tidier screen would hide, because hiding them is how an agent ends
 * up "on" and doing nothing:
 *  - WHAT FIRES, beside what was chosen. An agent can be put on duty and still be off in practice
 *    (no sponsor yet, never signed). Each routine says the stage it actually runs at, and the
 *    agent's needs say why the two differ.
 *  - A REFUSAL, in the appliance's own words, next to the control that was refused.
 *
 * An agent runs as SIGNED. Edits, a realm update or a changed view appear as unsigned changes and
 * reach nothing until the sponsor signs, so the version panel is where an edit takes effect.
 */

import React, { useCallback, useEffect, useState } from 'react'
import type { Agent, AgentDuty, AgentStage, AgentVersion, DutyCheck } from '../../../client/agents.ts'
import type { AgentsSurfaceProps } from '../contracts.ts'
import { Status, StudioPanel, failureMessage } from '../studio/chrome.tsx'

const STAGES: { stage: AgentStage; label: string }[] = [
  { stage: 'off', label: 'Off duty' },
  { stage: 'observing', label: 'Observing' },
  { stage: 'on', label: 'On duty' },
]

const STAGE_WORDS: Record<AgentStage, string> = {
  off: 'off duty',
  observing: 'on duty, observing',
  on: 'on duty',
}

const TONE: Record<AgentStage, string> = { off: '', observing: 'caution', on: 'ok' }

/** A date a person reads at a glance; the exact moment stays on the title. */
function when(iso: string | null): string {
  if (!iso) return ''
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleString()
}

/* Whether the duty may go on duty as it stands: a test run of the version that will run, or not yet. */
function testedWords(duty: AgentDuty, version: number): string {
  if (duty.testedVersion == null) return 'Not tested yet'
  const on = duty.testedAt ? ` on ${when(duty.testedAt)}` : ''
  return duty.testedVersion === version
    ? `Tested on version ${version}${on}`
    : `Last tested on version ${duty.testedVersion}${on}; version ${version} needs a test run`
}

/* What a test run just found, and what the repair would have done about it. */
function CheckFound({ check }: { check: DutyCheck | undefined }) {
  return check ? <p className="hint">{checkWords(check)}</p> : null
}

function checkWords(check: DutyCheck): string {
  const found = check.state === 'unknown'
    ? `Could not tell: ${check.reason ?? 'no reason given'}`
    : check.state === 'upheld' ? 'Upheld: nothing to repair' : `Lapsed: ${check.violations} violation${check.violations === 1 ? '' : 's'}`
  const would = check.wouldHaveCalled.length > 0 ? `; would have called ${check.wouldHaveCalled.join(', ')}` : ''
  const failed = check.repairFailures > 0 ? `; ${check.repairFailures} repair${check.repairFailures === 1 ? '' : 's'} failed` : ''
  return `${found}${would}${failed}.`
}

/** The highest stage any routine actually fires at: what the agent is doing, in one pill. */
export function firingOf(agent: Agent): AgentStage {
  if (agent.routines.some((r) => r.firing === 'on')) return 'on'
  if (agent.routines.some((r) => r.firing === 'observing')) return 'observing'
  return 'off'
}

export function StagePill({ stage }: { stage: AgentStage }) {
  return (
    <span className={`pill ${TONE[stage]}`.trim()}>
      <span className="dot" aria-hidden="true" />
      {STAGE_WORDS[stage]}
    </span>
  )
}

export function AgentsSurface({ services, host, initialAgent }: AgentsSurfaceProps) {
  const [agents, setAgents] = useState<Agent[]>([])
  const [loaded, setLoaded] = useState(false)
  const [absent, setAbsent] = useState(false)
  const [problem, setProblem] = useState('')
  const [selected, setSelected] = useState<string | null>(initialAgent ?? null)

  const load = useCallback(async () => {
    const result = await services.listAgents()
    setLoaded(true)
    if (!result.ok) {
      setAbsent(result.kind === 'unsupported')
      setProblem(failureMessage(result, 'list agents'))
      return
    }
    setAbsent(false)
    setProblem('')
    setAgents(result.value)
    setSelected((current) => current ?? result.value[0]?.name ?? null)
  }, [services])

  useEffect(() => {
    void load()
  }, [load])

  /** Replace one agent with the server's answer after a change, keeping the roster's order. */
  const replace = useCallback((agent: Agent) => {
    setAgents((all) => all.map((a) => (a.name === agent.name ? agent : a)))
  }, [])

  const agent = agents.find((a) => a.name === selected) ?? null

  return (
    <div className="kit-feature kit-feature-agents agentdesk">
      <StudioPanel
        title="Colleagues"
        aside={<button className="btn ghost tiny" onClick={() => void load()}>Refresh</button>}
      >
        {absent ? (
          <Status tone="caution">{problem}</Status>
        ) : (
          <>
            {problem && <Status tone="error">{problem}</Status>}
            {loaded && agents.length === 0 && !problem && (
              <p className="hint">
                No agents yet. An agent is a colleague with a job: write one in the world, or adopt one a
                realm proposes.
              </p>
            )}
            <ul className="agentroster" role="listbox" aria-label="Agents">
              {agents.map((a) => (
                <li key={a.name}>
                  <button
                    role="option"
                    aria-selected={a.name === selected}
                    className={`agentrow${a.name === selected ? ' is-on' : ''}`}
                    onClick={() => setSelected(a.name)}
                  >
                    <span className="agentrow-name">{a.name}</span>
                    <span className="agentrow-job">{a.job}</span>
                    <span className="agentrow-meta">
                      <StagePill stage={firingOf(a)} />
                      {a.origin === 'migrated' && <span className="agentrow-tag">gathered from existing routines</span>}
                      {a.origin !== 'world' && a.origin !== 'migrated' && <span className="agentrow-tag">from {a.origin}</span>}
                      {a.needs.length > 0 && <span className="agentrow-needs">needs {a.needs.length === 1 ? 'one thing' : `${a.needs.length} things`}</span>}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </StudioPanel>

      {agent && <AgentDetail key={agent.name} agent={agent} services={services} host={host} onChanged={replace} />}
    </div>
  )
}

function AgentDetail({
  agent,
  services,
  host,
  onChanged,
}: {
  agent: Agent
  services: AgentsSurfaceProps['services']
  host: AgentsSurfaceProps['host']
  onChanged: (agent: Agent) => void
}) {
  const [refusal, setRefusal] = useState('')
  const [busy, setBusy] = useState(false)
  const [history, setHistory] = useState<AgentVersion[] | null>(null)
  const [checked, setChecked] = useState<Record<string, DutyCheck>>({})

  async function move(stage: AgentStage, routine?: string) {
    if (busy) return
    setBusy(true)
    const result = await services.setStage(agent.name, stage, routine)
    setBusy(false)
    if (!result.ok) {
      setRefusal(failureMessage(result, `change the stage of ${agent.name}`))
      return
    }
    setRefusal('')
    onChanged(result.value)
  }

  async function sign() {
    if (busy) return
    if (host?.confirmSign && !(await host.confirmSign(agent))) return
    setBusy(true)
    const result = await services.sign(agent.name)
    setBusy(false)
    if (!result.ok) {
      setRefusal(failureMessage(result, `sign ${agent.name}`))
      return
    }
    setRefusal('')
    setHistory(null)
    onChanged(result.value)
  }

  /*
   * A TEST RUN from the card: the duty's check, now. Off duty it only observes, so it is safe to try,
   * and it is what going on duty asks for. The card is re-read afterwards, since the check moves its
   * status and, when it passes, what it was tested on.
   */
  async function testRun(duty: AgentDuty) {
    if (busy || !services.checkDuty) return
    setBusy(true)
    const result = await services.checkDuty(agent.name, duty.name)
    if (result.ok) {
      setChecked((prior) => ({ ...prior, [duty.name]: result.value }))
      const fresh = await services.listAgents()
      const now = fresh.ok ? fresh.value.find((a) => a.name === agent.name) : undefined
      if (now) onChanged(now)
      setRefusal('')
    } else {
      setRefusal(failureMessage(result, `check ${agent.name}'s duty ${duty.name}`))
    }
    setBusy(false)
  }

  async function showHistory() {
    const result = await services.versions(agent.name)
    if (!result.ok) {
      setRefusal(failureMessage(result, `list earlier versions of ${agent.name}`))
      return
    }
    setHistory(result.value)
  }

  const declared = agent.origin !== 'migrated'
  const signable = declared && (agent.version === 0 || agent.unsignedChanges.length > 0)

  return (
    <StudioPanel title={agent.name} aside={<StagePill stage={firingOf(agent)} />}>
      <p className="agent-job">{agent.job}</p>

      <div className="row agent-stage">
        <div className="stageladder" role="group" aria-label={`Stage for ${agent.name}`}>
          {STAGES.map(({ stage, label }) => (
            <button
              key={stage}
              className={`stagebtn${agent.stage === stage ? ' is-on' : ''}`}
              aria-pressed={agent.stage === stage}
              disabled={busy}
              onClick={() => void move(stage)}
            >
              {label}
            </button>
          ))}
        </div>
        <span className="hint">Off never runs. Observing runs and writes nothing. On duty may write.</span>
      </div>
      {refusal && <Status tone="error">{refusal}</Status>}

      {agent.needs.length > 0 && (
        <div className="agent-needs">
          <span className="caption">Before it can go on duty, it needs</span>
          <ul>{agent.needs.map((n) => <li key={n}>{n}</li>)}</ul>
        </div>
      )}

      <dl className="agent-facts">
        {agent.routing && (<><dt>Ask it about</dt><dd>{agent.routing}</dd></>)}
        <dt>Sponsor</dt>
        <dd>{agent.sponsor ?? <span className="hint">nobody yet</span>}</dd>
        {agent.owners.length > 0 && (<><dt>Owners</dt><dd>{agent.owners.join(', ')}</dd></>)}
        {agent.operators.length > 0 && (<><dt>Operators</dt><dd>{agent.operators.join(', ')}</dd></>)}
        {agent.persona && (<><dt>Persona</dt><dd>{agent.persona}</dd></>)}
        <dt>State</dt>
        <dd>{agent.state}</dd>
      </dl>

      <h3 className="caption">Routines</h3>
      {agent.routines.length === 0 ? (
        <p className="hint">No routines.</p>
      ) : (
        <div className="tablewrap">
          <table className="results-table agent-routines">
            <thead>
              <tr><th>Routine</th><th>When</th><th>Chosen</th><th>Runs</th><th aria-label="actions" /></tr>
            </thead>
            <tbody>
              {agent.routines.map((r) => (
                <tr key={r.name} className={r.missing ? 'is-missing' : undefined}>
                  <td><code>{r.name}</code>{r.description && <div className="hint">{r.description}</div>}</td>
                  <td>{r.trigger}</td>
                  <td>
                    <select
                      aria-label={`Stage for routine ${r.name}`}
                      value={r.stage}
                      disabled={busy || r.missing}
                      onChange={(event) => void move(event.target.value as AgentStage, r.name)}
                    >
                      {STAGES.map(({ stage, label }) => <option key={stage} value={stage}>{label}</option>)}
                    </select>
                  </td>
                  <td><StagePill stage={r.firing} /></td>
                  <td>
                    {host?.editRoutine && !r.missing && (
                      <button className="btn ghost tiny" onClick={() => host.editRoutine?.(r.name)}>Edit</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {agent.duties.length > 0 && (
        <>
          <h3 className="caption">Duties</h3>
          <ul className="agent-duties">
            {agent.duties.map((d) => (
              <li key={d.name}>
                <strong>{d.text || d.name}</strong>
                <span className="hint"> · {d.holds}{d.every ? ` · ${d.every}` : ''}{d.timezone ? ` · ${d.timezone}` : ''} · {d.status}</span>
                <div className="row">
                  <span className="hint" title={d.testedAt ?? undefined}>{testedWords(d, agent.version)}</span>
                  {services.checkDuty && (
                    <button className="btn ghost tiny" disabled={busy} onClick={() => void testRun(d)}>Test run</button>
                  )}
                </div>
                <CheckFound check={checked[d.name]} />
              </li>
            ))}
          </ul>
        </>
      )}

      {declared && (
        <div className="agent-version">
          <h3 className="caption">Version</h3>
          {agent.version === 0 ? (
            <p className="hint">Never signed. It runs nothing until its sponsor signs version 1.</p>
          ) : (
            <p title={agent.signedAt ?? undefined}>
              Running version {agent.version}, signed by {agent.signedBy} {agent.signedAt ? `on ${when(agent.signedAt)}` : ''}.
            </p>
          )}
          {agent.unsignedChanges.length > 0 && (
            <div className="agent-unsigned">
              <span className="caption">Not yet in effect</span>
              <ul>{agent.unsignedChanges.map((c) => <li key={c}>{c}</li>)}</ul>
            </div>
          )}
          <div className="row">
            <button className="btn primary" disabled={!signable || busy} onClick={() => void sign()}>
              Sign version {agent.version + 1}
            </button>
            <button className="btn ghost" onClick={() => void showHistory()}>Earlier versions</button>
          </div>
          {history && (
            history.length === 0 ? <p className="hint">No signed versions yet.</p> : (
              <ul className="agent-history">
                {history.map((v) => (
                  <li key={v.version} title={v.digest}>
                    Version {v.version} · {v.signedBy} · {when(v.signedAt)} · {v.routines.length} routine{v.routines.length === 1 ? '' : 's'}
                  </li>
                ))}
              </ul>
            )
          )}
        </div>
      )}
    </StudioPanel>
  )
}
