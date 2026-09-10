/*
 * WHAT BOTH STUDIOS SHOW, AND HOW THEY REPORT AN OUTCOME.
 *
 * The kit's client never throws: every call comes back as an `Outcome`, and the failure that
 * matters most is not an error at all — `unsupported` means this appliance simply predates the
 * endpoint. Both studios must say "your appliance is older than this console" rather than
 * "something went wrong", so the translation happens once, here, instead of at forty call sites.
 */

import React from 'react'
import type { Outcome } from '../../../client/outcome.ts'

/** A status line's tone. Mirrors the kit CSS: `.status.ok`, `.status.error`, plain for neutral. */
export type Tone = 'ok' | 'error' | 'caution' | null

export function Status({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  return <div className={`status${tone ? ` ${tone}` : ''}`}>{children}</div>
}

/**
 * The sentence to show for a failure. `unsupported` gets the version story and everything else
 * gets the SERVER's own words where it sent any — a message invented here would be a guess
 * standing in front of an explanation the appliance already gave.
 */
export function failureMessage(outcome: Extract<Outcome<unknown>, { ok: false }>, what: string): string {
  switch (outcome.kind) {
    case 'unsupported':
      return `This appliance predates ${what} — upgrade it to use this.`
    case 'unauthorized':
      return 'Your session is not authorised for this. Sign in again.'
    case 'unreachable':
      return outcome.message
    default:
      return outcome.message
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
      <header className="panel-head">
        <h2>{title}</h2>
        {aside}
      </header>
      <div className="panel-body">{children}</div>
    </section>
  )
}

/**
 * Copy, with a moment's acknowledgement. The kit's `copyWithNod` does this for a raw DOM button;
 * in React the label is state, so this is the same behaviour expressed the way this app renders.
 */
export function CopyButton({ label, text, disabled }: { label: string; text: string; disabled?: boolean }) {
  const [nodded, setNodded] = React.useState(false)
  return (
    <button
      className="btn"
      disabled={disabled}
      onClick={() => {
        void navigator.clipboard?.writeText(text)
        setNodded(true)
        setTimeout(() => setNodded(false), 1200)
      }}
    >
      {nodded ? 'Copied' : label}
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
    <div className="tablewrap">
      <table className="results-table">
        <thead>
          <tr>{columns.map((c) => <th key={c}>{c}</th>)}</tr>
        </thead>
        <tbody>
          {shown.map((row, i) => (
            <tr key={i}>
              {columns.map((c) => (
                <td key={c}>
                  {row[c] == null ? '' : typeof row[c] === 'object' ? JSON.stringify(row[c]) : String(row[c])}
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
