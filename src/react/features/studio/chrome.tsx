/*
 * WHAT BOTH STUDIOS SHOW, AND HOW THEY REPORT AN OUTCOME.
 *
 * Every call returns an Outcome. A missing endpoint, rejected session and unreachable appliance
 * need different recovery instructions; a missing route alone does not establish the cause.
 */

import React from 'react'
import type { Outcome } from '../../../client/outcome.ts'

/** A status line's tone. Mirrors the kit CSS: `.status.ok`, `.status.error`, plain for neutral. */
export type Tone = 'ok' | 'error' | 'caution' | null

export function Status({ tone, children, className = '' }: { tone: Tone; children: React.ReactNode; className?: string }) {
  return <div className={`status${tone ? ` ${tone}` : ''}${className ? ` ${className}` : ''}`} role={tone === 'error' ? 'alert' : 'status'}>{children}</div>
}

/**
 * Keep the action and server detail together. Recovery must not assume a missing endpoint means
 * an old appliance, or that signing in again grants a forbidden permission.
 * action is a lowercase infinitive phrase, e.g. "list documents", never a noun or gerund.
 */
export function failureMessage(outcome: Extract<Outcome<unknown>, { ok: false }>, action: string): string {
  const status = outcome.status === undefined ? '' : ` (HTTP ${outcome.status})`
  const detail = outcome.message ? ` ${outcome.message}` : ''
  switch (outcome.kind) {
    case 'unsupported':
      return `Could not ${action}${status}. This capability is not available on this appliance.${detail}`
    case 'unauthorized':
      return outcome.status === 403
        ? `You are not allowed to ${action}${status}. Ask an administrator for access.${detail}`
        : `Sign in again to ${action}${status}.${detail}`
    case 'unreachable':
      return `Could not ${action}${status}. Check the appliance connection.${detail}`
    default:
      return `Could not ${action}${status}.${detail}`
  }
}

/**
 * A failure a surface should fall SILENT on rather than nag about. As-you-type validation against
 * an appliance without `/validate` would otherwise print the same version complaint on every
 * keystroke; the feature is simply absent, and absent is quiet.
 */
export const isAbsent = (outcome: Extract<Outcome<unknown>, { ok: false }>): boolean =>
  outcome.kind === 'unsupported'

/** A collapsible panel, matching the kit's `.panel` chrome. */
export function StudioPanel({
  title,
  aside,
  children,
}: {
  title: React.ReactNode
  aside?: React.ReactNode
  children?: React.ReactNode
}) {
  return (
    <section className="panel">
      <div className="panel-head">
        <h2>{title}</h2>
        {aside}
      </div>
      <div className="panel-body">{children}</div>
    </section>
  )
}

/**
 * Copy, with a moment's acknowledgement. The kit's `copyWithNod` does this for a raw DOM button;
 * in React the label is state, so this is the same behaviour expressed the way this app renders.
 */
export function CopyButton({ label, text, disabled }: { label: string; text: string; disabled?: boolean }) {
  const [feedback, setFeedback] = React.useState('')
  return (
    <button
      className="btn"
      disabled={disabled}
      aria-live="polite"
      onClick={async () => {
        if (window.isSecureContext === false || !navigator.clipboard?.writeText) {
          setFeedback(window.isSecureContext === false
            ? 'Copy unavailable — open over HTTPS'
            : 'Copy unavailable — use a clipboard-enabled browser')
          return
        }
        try {
          await navigator.clipboard.writeText(text)
          setFeedback('Copied')
          setTimeout(() => setFeedback((current) => current === 'Copied' ? '' : current), 1200)
        } catch {
          setFeedback('Copy failed — check browser clipboard access')
        }
      }}
    >
      {feedback || label}
    </button>
  )
}

/**
 * Results as a table. EVERY CELL IS TEXT: rows come from documents, and documents lie. React
 * escapes by default, which is why this is a component rather than an innerHTML helper — the
 * equivalent in Me needs `textContent` set by hand for the same reason.
 */
export function RowTable({ rows, columns, limit = 200 }: {
  rows: Array<Record<string, unknown>>
  columns: string[]
  limit?: number
}) {
  const shown = rows.slice(0, limit)
  return (
    <div className="tablewrap" role="region" aria-label="Results table" tabIndex={0}>
      <table className="results-table">
        <thead>
          <tr>{columns.map((c) => <th key={c}>{c}</th>)}</tr>
        </thead>
        <tbody>
          {shown.map((row, i) => (
            <tr key={i}>
              {columns.map((c) => (
                <td key={c} data-label={c}>
                  {row[c] == null ? '' : typeof row[c] === 'object'
                    ? <span className="cell-object">{JSON.stringify(row[c], null, 2)}</span>
                    : String(row[c])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length > shown.length && (
        <div className="hint">showing {shown.length} of {rows.length} — copy for the rest</div>
      )}
    </div>
  )
}
