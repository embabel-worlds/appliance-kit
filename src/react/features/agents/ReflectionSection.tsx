/*
 * REFLECTION, on the agent's card (#1782): "how would you do this better?", answered from its own
 * record, with the evidence for every change it proposes.
 *
 * Adopting writes the proposed version for its sponsor to sign, as any change to an agent is signed;
 * the server refuses one that would let the agent do more than it was signed for. Nothing proves a
 * proposal yet — no battery, no replay of last month — and the section says so beside every one.
 */

import React, { useCallback, useEffect, useState } from 'react'
import type { AgentProposal } from '../../../client/agentReflection.ts'
import type { AgentsServices } from '../contracts.ts'
import { Status, failureMessage } from '../studio/chrome.tsx'

export function ReflectionSection({ name, services, onAdopted }: {
  name: string
  services: AgentsServices
  /** A proposal was written into the world: the agent now has unsigned changes to show. */
  onAdopted: () => void
}) {
  const [proposals, setProposals] = useState<AgentProposal[]>([])
  const [problem, setProblem] = useState('')
  const [busy, setBusy] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!services.listProposals) return
    const result = await services.listProposals(name)
    if (result.ok) setProposals(result.value)
    else if (result.kind !== 'unsupported') setProblem(failureMessage(result, 'load its proposals'))
  }, [name, services])

  useEffect(() => {
    void load()
  }, [load])

  async function reflect() {
    setBusy('reflect')
    const result = await services.reflect!(name)
    setBusy(null)
    if (!result.ok) {
      setProblem(failureMessage(result, 'ask how it would do better'))
      return
    }
    setProblem('')
    await load()
  }

  async function decide(p: AgentProposal, adopt: boolean) {
    setBusy(p.id)
    const result = adopt ? await services.adoptProposal!(name, p.id) : await services.dismissProposal!(name, p.id)
    setBusy(null)
    if (!result.ok) {
      setProblem(failureMessage(result, adopt ? 'adopt it' : 'dismiss it'))
      return
    }
    setProblem('')
    if (adopt) onAdopted()
    await load()
  }

  if (!services.reflect || !services.listProposals) return null
  const open = proposals.filter((p) => p.status === 'OPEN')
  return (
    <div className="agent-reflection">
      <div className="row">
        <h3 className="caption">Reflection</h3>
        <button className="btn ghost tiny" disabled={busy === 'reflect'} onClick={() => void reflect()}>
          {busy === 'reflect' ? 'Reading its record…' : 'How would it do better?'}
        </button>
      </div>
      {problem && <Status tone="error">{problem}</Status>}
      {open.length === 0 && proposals.length === 0 && (
        <p className="hint">It proposes changes from its own record: requests people turned down and why, checks that never find anything.</p>
      )}
      {open.map((p) => (
        <div key={p.id} className="proposal">
          <p><strong>{p.summary || 'Nothing to change.'}</strong></p>
          {p.changes.length === 0 ? <p className="hint">The record supports no change.</p> : (
            <ul className="proposal-changes">
              {p.changes.map((c, i) => (
                <li key={i}>
                  <code>{c.target}</code>: {c.from ? <><s>{c.from}</s> → </> : null}{c.duty ? `${c.duty.name}: ${c.duty.text}` : c.to}
                  {c.why && <div className="hint">{c.why}{c.evidence ? ` (${c.evidence})` : ''}</div>}
                </li>
              ))}
            </ul>
          )}
          <details>
            <summary className="hint">What it read</summary>
            <pre className="run-output">{p.record}</pre>
          </details>
          {!p.proven && <p className="hint">Not yet proven: nothing replays a proposal over last month yet.</p>}
          {p.refused && <Status tone="caution">{p.refused}</Status>}
          {p.changes.length > 0 && services.adoptProposal && (
            <div className="row">
              <button className="btn" disabled={busy === p.id} onClick={() => void decide(p, true)}>Adopt, to sign</button>
              <button className="btn ghost tiny" disabled={busy === p.id} onClick={() => void decide(p, false)}>Dismiss</button>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
