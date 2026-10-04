/*
 * SUGGESTED COLLEAGUES, under the roster (#1778): who the scout-agents skill would hire, best first,
 * each with the evidence it counted.
 *
 * Two kinds of answer, and the difference is the point. Where an installed realm already proposes
 * an agent for the work, the suggestion is to adopt THAT one — "Adopt it" opens its card, where it
 * is sponsored, signed and put on duty like any other — and says what it leaves uncovered. Only
 * work nothing covers is drafted, and a draft arrives unsigned and off duty with what its duties
 * would act on today, which is a look at today and not a replay of the past.
 */

import React, { useCallback, useEffect, useState } from 'react'
import type { AgentSuggestion } from '../../../client/agentSuggestions.ts'
import type { AgentsServices } from '../contracts.ts'
import { Status, failureMessage } from '../studio/chrome.tsx'

export function SuggestedColleagues({ services, onOpen, onDrafted }: {
  services: AgentsServices
  /** Open an agent's card, by name. */
  onOpen: (name: string) => void
  /** A draft was written: the roster has a new agent to show. */
  onDrafted: (name: string) => void
}) {
  const [suggestions, setSuggestions] = useState<AgentSuggestion[]>([])
  const [problem, setProblem] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [drafted, setDrafted] = useState<AgentSuggestion | null>(null)

  const load = useCallback(async () => {
    if (!services.listSuggestions) return
    const result = await services.listSuggestions()
    if (!result.ok) {
      // A server without suggestions says nothing here rather than an error under the roster.
      if (result.kind !== 'unsupported') setProblem(failureMessage(result, 'list suggested colleagues'))
      return
    }
    setProblem('')
    setSuggestions(result.value)
  }, [services])

  useEffect(() => {
    void load()
  }, [load])

  async function decide(s: AgentSuggestion, act: 'draft' | 'adopt' | 'dismiss') {
    const call = act === 'draft' ? services.draftSuggestion : act === 'adopt' ? services.markAdopted : services.dismissSuggestion
    if (!call) return
    setBusy(s.id)
    const result = await call(s.id)
    setBusy(null)
    if (!result.ok) {
      setProblem(failureMessage(result, act === 'draft' ? 'create the draft' : act === 'adopt' ? 'start adopting it' : 'dismiss it'))
      return
    }
    setProblem('')
    if (act === 'draft') {
      setDrafted(result.value)
      onDrafted(result.value.name)
    }
    if (act === 'adopt') onOpen(result.value.name)
    await load()
  }

  const open = suggestions.filter((s) => s.status === 'OPEN')
  if (!services.listSuggestions || (open.length === 0 && !problem && !drafted)) return null

  return (
    <section className="suggested" aria-label="Suggested colleagues">
      <h3 className="suggested-title">Suggested colleagues</h3>
      {problem && <Status tone="error">{problem}</Status>}
      {drafted && (
        <Status tone="ok">
          Drafted {drafted.name}, unsigned and off duty. {drafted.preview.length > 0 ? `Today it would: ${drafted.preview.join(' ')}` : ''}
        </Status>
      )}
      <ol className="suggestedlist">
        {open.map((s) => (
          <li key={s.id} className="suggestion">
            <div className="row suggestion-head">
              <strong>{s.adopt ? `Adopt ${s.adopt}` : s.name}</strong>
              {s.kind === 'TALKS' && <span className="agentrow-tag">to talk to</span>}
              {s.adopt && <span className="agentrow-tag">already proposed by a realm</span>}
            </div>
            <p className="suggestion-job">{s.job}</p>
            <ul className="suggestion-evidence">
              {s.evidence.map((e, i) => (
                <li key={i}>
                  <details>
                    <summary><strong>{e.count}</strong> {e.summary}{e.period ? ` (${e.period})` : ''}</summary>
                    {e.query && <pre className="suggestion-query">{e.query}</pre>}
                  </details>
                </li>
              ))}
            </ul>
            {s.uncovered && <p className="hint">Not covered: {s.uncovered}</p>}
            {s.feasibility && <p className="hint">{s.feasibility}</p>}
            <div className="row">
              {s.adopt
                ? <button className="btn" disabled={busy === s.id} onClick={() => void decide(s, 'adopt')}>Adopt it</button>
                : <button className="btn" disabled={busy === s.id} onClick={() => void decide(s, 'draft')}>{busy === s.id ? 'Drafting…' : 'Draft it'}</button>}
              <button className="btn ghost tiny" disabled={busy === s.id} onClick={() => void decide(s, 'dismiss')}>Dismiss</button>
            </div>
          </li>
        ))}
      </ol>
    </section>
  )
}
