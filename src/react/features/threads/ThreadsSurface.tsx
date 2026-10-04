/*
 * THREADS: the conversations you and your agents share (embabel/me#1779).
 *
 * Shown INSIDE chat, not beside it. A thread is a conversation with more than one participant whose
 * answers may arrive later, which is a property of a conversation and never was a reason for a
 * second place to type. It had one, and the cost was the ordinary one: chat gained markdown, unread
 * and sessions while this rendered `{message.text}` into a `<p>`, so an agent's list arrived as
 * `- item`. Prose now comes from the kit's one renderer, and `chrome: 'pane'` lets the host's own
 * conversation list choose the thread.
 *
 * A person writes, @mentions an agent, and the agent answers in the thread as itself; agents asking
 * each other land here as well, so what colleagues say to each other is never hidden. The
 * attachment is the payload — a record, a view's rows frozen when sent, a request — and it shows as
 * a card that opens to the thing itself, never a paragraph about it. An answer given without one
 * is marked as having had nothing attached.
 *
 * Answers arrive in the background: while the thread is waiting on someone it says who, and looks
 * again every few seconds until they have answered.
 */

import React, { useCallback, useEffect, useState } from 'react'
import type { Attachment, Thread, ThreadMessage, ThreadView } from '../../../client/threads.ts'
import type { ThreadsSurfaceProps } from '../contracts.ts'
import { Status, StudioPanel, failureMessage } from '../studio/chrome.tsx'
import { Prose } from '../prose/Prose.tsx'

const POLL_MS = 2500

function when(iso: string | null): string {
  if (!iso) return ''
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleString()
}

export function ThreadsSurface({ services, host, initialThread, markdown, chrome = 'full' }: ThreadsSurfaceProps) {
  const [threads, setThreads] = useState<Thread[]>([])
  const [problem, setProblem] = useState('')
  const [absent, setAbsent] = useState(false)
  const [selected, setSelected] = useState<string | null>(initialThread ?? null)
  const [view, setView] = useState<ThreadView | null>(null)
  const [title, setTitle] = useState('')

  const loadThreads = useCallback(async () => {
    const result = await services.listThreads()
    if (!result.ok) {
      setAbsent(result.kind === 'unsupported')
      setProblem(failureMessage(result, 'list threads'))
      return
    }
    setProblem('')
    setThreads(result.value)
    setSelected((current) => current ?? result.value[0]?.id ?? null)
  }, [services])

  const loadThread = useCallback(async (id: string) => {
    const result = await services.getThread(id)
    if (!result.ok) {
      setProblem(failureMessage(result, 'open the thread'))
      return
    }
    setView(result.value)
  }, [services])

  useEffect(() => {
    void loadThreads()
  }, [loadThreads])

  useEffect(() => {
    if (selected) void loadThread(selected)
    else setView(null)
  }, [selected, loadThread])

  // While someone is still answering, look again until they have.
  useEffect(() => {
    if (!selected || !view || view.waitingOn.length === 0) return
    const timer = setTimeout(() => void loadThread(selected), POLL_MS)
    return () => clearTimeout(timer)
  }, [selected, view, loadThread])

  async function start(event: React.FormEvent) {
    event.preventDefault()
    const result = await services.createThread(title.trim())
    if (!result.ok) {
      setProblem(failureMessage(result, 'start a thread'))
      return
    }
    setTitle('')
    await loadThreads()
    setSelected(result.value.id)
  }

  if (chrome === 'pane') {
    return (
      <div className="kit-feature kit-feature-threads pane">
        {problem && <Status tone={absent ? 'caution' : 'error'}>{problem}</Status>}
        {view && (
          <ThreadPane
            view={view}
            services={services}
            host={host}
            markdown={markdown}
            onPosted={() => void loadThread(view.thread.id)}
            onProblem={setProblem}
          />
        )}
      </div>
    )
  }

  return (
    <div className="kit-feature kit-feature-threads team">
      <StudioPanel title="Threads" aside={<button className="btn ghost tiny" onClick={() => void loadThreads()}>Refresh</button>}>
        {absent ? <Status tone="caution">{problem}</Status> : (
          <>
            {problem && <Status tone="error">{problem}</Status>}
            <form className="row" onSubmit={(event) => void start(event)}>
              <input value={title} placeholder="A new thread about…" onChange={(event) => setTitle(event.target.value)} />
              <button className="btn" type="submit" disabled={!title.trim()}>Start</button>
            </form>
            <ul className="threadlist" role="listbox" aria-label="Threads">
              {threads.map((t) => (
                <li key={t.id}>
                  <button role="option" aria-selected={t.id === selected} onClick={() => setSelected(t.id)}>
                    <strong>{t.title}</strong>
                    <span className="hint">{when(t.updatedAt)}</span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </StudioPanel>
      {view && (
        <ThreadPane
          view={view}
          services={services}
          host={host}
          markdown={markdown}
          onPosted={() => void loadThread(view.thread.id)}
          onProblem={setProblem}
        />
      )}
    </div>
  )
}

function ThreadPane({ view, services, host, markdown, onPosted, onProblem }: {
  view: ThreadView
  services: ThreadsSurfaceProps['services']
  host: ThreadsSurfaceProps['host']
  markdown: ThreadsSurfaceProps['markdown']
  onPosted: () => void
  onProblem: (problem: string) => void
}) {
  const [text, setText] = useState('')
  const [viewName, setViewName] = useState('')
  const [sending, setSending] = useState(false)

  async function send(event?: React.FormEvent) {
    event?.preventDefault()
    if (sending || (!text.trim() && !viewName.trim())) return
    setSending(true)
    const attachments = viewName.trim() ? [{ kind: 'VIEW' as const, label: viewName.trim() }] : []
    const result = await services.post(view.thread.id, text.trim(), attachments)
    setSending(false)
    if (!result.ok) {
      onProblem(failureMessage(result, 'post in the thread'))
      return
    }
    setText('')
    setViewName('')
    onPosted()
  }

  return (
    <StudioPanel title={view.thread.title}>
      <ol className="threadmessages">
        {view.messages.map((m) => <MessageItem key={m.id} message={m} host={host} markdown={markdown} />)}
      </ol>
      {view.waitingOn.length > 0 && (
        <p className="hint threadwaiting">{view.waitingOn.join(', ')} {view.waitingOn.length === 1 ? 'is' : 'are'} answering…</p>
      )}
      <form className="threadcompose" onSubmit={(event) => void send(event)}>
        <textarea
          value={text}
          rows={3}
          placeholder="Write, and @mention an agent to bring it in: @steward is Northwind at risk? Enter sends, Shift+Enter for a new line"
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            // Enter sends, as in any chat; Shift+Enter is a new line, and Enter mid-composition picks an IME candidate.
            if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault()
              void send()
            }
          }}
        />
        <div className="row">
          <input value={viewName} placeholder="Attach a view's rows (its name)" onChange={(event) => setViewName(event.target.value)} />
          <button className="btn primary" type="submit" disabled={sending || (!text.trim() && !viewName.trim())}>
            {sending ? 'Posting…' : 'Post'}
          </button>
        </div>
      </form>
    </StudioPanel>
  )
}

function MessageItem({ message, host, markdown }: {
  message: ThreadMessage
  host: ThreadsSurfaceProps['host']
  markdown: ThreadsSurfaceProps['markdown']
}) {
  const from = message.from
  const name = from.kind === 'AGENT' && host?.openAgent
    ? <button className="request-agentlink" onClick={() => host.openAgent?.(from.name)}>{from.name}</button>
    : from.name
  return (
    <li className={`threadmessage from-${from.kind.toLowerCase()}`}>
      <header className="row">
        <strong>{name}</strong>
        <span className="hint" title={message.createdAt}>{when(message.createdAt)}</span>
        {message.wordsOnly && <span className="hint">nothing attached</span>}
      </header>
      <Prose libs={markdown} text={message.text} className="threadtext" />
      {message.attachments.map((a, i) => <AttachmentCard key={i} attachment={a} />)}
    </li>
  )
}

/* The thing itself, opened: a record's properties, or the rows a view returned when it was sent. */
function AttachmentCard({ attachment }: { attachment: Attachment }) {
  const first = attachment.rows?.[0]
  const columns = first ? Object.keys(first).slice(0, 6) : []
  return (
    <details className="threadattachment">
      <summary>
        <span className="pill">{attachment.kind.toLowerCase()}</span> {attachment.label}{attachment.id ? ` ${attachment.id}` : ''} — {attachment.title}
      </summary>
      {columns.length > 0 ? (
        <div className="tablewrap">
          <table className="results-table">
            <thead><tr>{columns.map((c) => <th key={c}>{c}</th>)}</tr></thead>
            <tbody>
              {attachment.rows.map((row, i) => (
                <tr key={i}>{columns.map((c) => <td key={c}>{String(row[c] ?? '')}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <dl className="threadproperties">
          {Object.entries(attachment.properties ?? {}).map(([k, v]) => (
            <React.Fragment key={k}><dt>{k}</dt><dd>{typeof v === 'object' ? JSON.stringify(v) : String(v)}</dd></React.Fragment>
          ))}
        </dl>
      )}
      {attachment.capturedAt && <p className="hint">as it was {when(attachment.capturedAt)}</p>}
    </details>
  )
}
