/*
 * APPROVALS — what agents ask a person to approve before they act (embabel/me#1776).
 *
 * A request is an agent saying "I would do this, and here is why", and most people deciding are not
 * the people who wrote its routine. So the card speaks the business's words: who is asking, what
 * would change, the text it would write, and the rows that made it ask. The routine, the tool and
 * its raw arguments are folded under technical details, there to check, never to read first.
 *
 * Approving calls the verb as the person who approves. Rejecting needs a reason — the appliance
 * refuses one without — so the box for it is part of the reject control, not an afterthought.
 * Pending requests come first; decided, failed and expired ones stay below as the record, because
 * "what did my agents ask, and what did I say" is a question people come back with.
 */

import React, { useCallback, useEffect, useState } from 'react'
import type { AgentRequest, RequestStatus } from '../../../client/requests.ts'
import type { ApprovalsSurfaceProps } from '../contracts.ts'
import { Status, StudioPanel, failureMessage } from '../studio/chrome.tsx'

const STATUS_WORDS: Record<RequestStatus, string> = {
  PENDING: 'waiting for you',
  APPROVED: 'approved',
  FAILED: 'approved, but it failed',
  REJECTED: 'rejected',
  EXPIRED: 'expired unanswered',
}

const TONE: Record<RequestStatus, string> = {
  PENDING: 'caution',
  APPROVED: 'ok',
  FAILED: 'error',
  REJECTED: '',
  EXPIRED: '',
}

function when(iso: string | null): string {
  if (!iso) return ''
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleString()
}

/** An agent or routine name as a person reads it: `chase-failed-payment` is "Chase failed payment". */
export function displayName(slug: string): string {
  const words = slug.replace(/[-_]/g, ' ').trim()
  return words.charAt(0).toUpperCase() + words.slice(1)
}

/** The verb's arguments, indented if they are JSON, as they were if not. */
function pretty(args: string): string {
  try {
    return JSON.stringify(JSON.parse(args), null, 2)
  } catch {
    return args
  }
}

/**
 * @deprecated A host built on desk draws state with desk's `Led` and the words beside it, not this
 * pill: see "Hosts built on desk" in the README. The pill is `display: flex`, so anywhere but a
 * flex row it stretches to the width of its container and reads as a text field.
 */
export function RequestStatusPill({ status }: { status: RequestStatus }) {
  return (
    <span className={`pill ${TONE[status]}`.trim()}>
      <span className="dot" aria-hidden="true" />
      {STATUS_WORDS[status]}
    </span>
  )
}

export function ApprovalsSurface({ services, host }: ApprovalsSurfaceProps) {
  const [requests, setRequests] = useState<AgentRequest[]>([])
  const [loaded, setLoaded] = useState(false)
  const [absent, setAbsent] = useState(false)
  const [problem, setProblem] = useState('')

  const load = useCallback(async () => {
    const result = await services.listRequests()
    setLoaded(true)
    if (!result.ok) {
      setAbsent(result.kind === 'unsupported')
      setProblem(failureMessage(result, 'list requests'))
      return
    }
    setAbsent(false)
    setProblem('')
    setRequests(result.value)
  }, [services])

  useEffect(() => {
    void load()
  }, [load])

  const replace = useCallback((request: AgentRequest) => {
    setRequests((all) => all.map((r) => (r.id === request.id ? request : r)))
  }, [])

  const pending = requests.filter((r) => r.status === 'PENDING')
  const decided = requests.filter((r) => r.status !== 'PENDING')

  return (
    <div className="kit-feature kit-feature-approvals approvals">
      <StudioPanel
        title={pending.length ? `Waiting for you (${pending.length})` : 'Waiting for you'}
        aside={<button className="btn ghost tiny" onClick={() => void load()}>Refresh</button>}
      >
        {absent ? (
          <Status tone="caution">{problem}</Status>
        ) : (
          <>
            {problem && <Status tone="error">{problem}</Status>}
            {loaded && pending.length === 0 && !problem && (
              <p className="hint">Nothing to decide. When an agent wants to do something it should not do alone, it asks here.</p>
            )}
            {pending.map((r) => (
              <RequestCard key={r.id} request={r} services={services} host={host} onDecided={replace} />
            ))}
          </>
        )}
      </StudioPanel>

      {decided.length > 0 && (
        <StudioPanel title="Decided">
          {decided.map((r) => (
            <RequestCard key={r.id} request={r} services={services} host={host} onDecided={replace} />
          ))}
        </StudioPanel>
      )}
    </div>
  )
}

function RequestCard({
  request,
  services,
  host,
  onDecided,
}: {
  request: AgentRequest
  services: ApprovalsSurfaceProps['services']
  host: ApprovalsSurfaceProps['host']
  onDecided: (request: AgentRequest) => void
}) {
  const [busy, setBusy] = useState(false)
  const [refusal, setRefusal] = useState('')
  const [rejecting, setRejecting] = useState(false)
  const [reason, setReason] = useState('')
  const open = request.status === 'PENDING'

  async function decide(approve: boolean) {
    if (busy) return
    setBusy(true)
    const result = approve ? await services.approve(request.id) : await services.reject(request.id, reason.trim())
    setBusy(false)
    if (!result.ok) {
      setRefusal(failureMessage(result, approve ? 'approve this request' : 'reject this request'))
      return
    }
    setRefusal('')
    setRejecting(false)
    onDecided(result.value)
  }

  const asker = displayName(request.agent ?? request.routine)
  const first = request.evidence[0]
  const columns = first ? Object.keys(first) : []

  return (
    <article className="request">
      <header className="request-head">
        <span className="request-who">
          {host?.openAgent ? (
            <button className="request-agentlink" onClick={() => host.openAgent?.(request.routine)}>{asker}</button>
          ) : (
            asker
          )}{' '}
          asks your OK
        </span>
        <RequestStatusPill status={request.status} />
      </header>
      <p className="request-detail">{request.detail}</p>
      {request.quote && <blockquote className="request-quote">{request.quote}</blockquote>}
      {request.untrusted && request.untrusted.length > 0 && (
        <p className="request-untrusted">
          Drafted after reading text from outside the business ({request.untrusted.join('; ')}). Such text can
          carry instructions meant for whoever reads it: read the draft with that in mind.
        </p>
      )}

      {columns.length > 0 && (
        <div className="request-evidence">
          <table>
            <thead>
              <tr>{columns.map((c) => <th key={c}>{c}</th>)}</tr>
            </thead>
            <tbody>
              {request.evidence.map((row, i) => (
                <tr key={i}>{columns.map((c) => <td key={c}>{String(row[c] ?? '')}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <details className="request-call">
        <summary>Technical details</summary>
        <p className="hint">
          Routine <code>{request.routine}</code> would call <code>{request.verb}</code> with:
        </p>
        <pre>{pretty(request.args)}</pre>
      </details>

      <p className="request-when hint">
        Asked {when(request.raisedAt)}
        {open && <> · expires {when(request.expiresAt)}</>}
        {request.decidedBy && <> · {request.status === 'REJECTED' ? 'rejected' : 'approved'} by {request.decidedBy} {when(request.decidedAt)}</>}
      </p>
      {request.reason && <p className="request-reason">Why not: {request.reason}</p>}
      {request.status === 'FAILED' && request.result && <Status tone="error">{request.result}</Status>}

      {refusal && <Status tone="error">{refusal}</Status>}
      {open && !rejecting && (
        <div className="row request-actions">
          <button className="btn" disabled={busy} onClick={() => void decide(true)}>Approve</button>
          <button className="btn ghost" disabled={busy} onClick={() => setRejecting(true)}>Reject…</button>
        </div>
      )}
      {open && rejecting && (
        <div className="row request-actions">
          <input
            aria-label="Why reject"
            placeholder="Why not? The agent learns from this."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <button className="btn" disabled={busy || !reason.trim()} onClick={() => void decide(false)}>Reject</button>
          <button className="btn ghost" disabled={busy} onClick={() => setRejecting(false)}>Cancel</button>
        </div>
      )}
    </article>
  )
}
