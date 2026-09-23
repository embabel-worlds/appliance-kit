/*
 * SAVING A VIEW YOU DO NOT OWN — as a copy, under a name of your own.
 *
 * A realm's view, or one shipped with the world, cannot be saved over: the appliance refuses the
 * name, because the saved copy would load after the original and never be seen. So the edit is
 * kept as a new view in the user's world. The dialog exists because a copy needs a NAME, and it is
 * the natural place to say why a copy at all, and that the original will carry on without it.
 */

import React, { useEffect, useRef, useState } from 'react'

/** The appliance's rule for a view name: it is used as a label in a query. */
const VIEW_NAME = /^[A-Za-z_][A-Za-z0-9_]*$/

/** Why this view cannot be saved in place — the dialog's opening sentence. */
export type CopyReason = { kind: 'realm'; realm: string } | { kind: 'world' } | { kind: 'contract' }

export function suggestedCopyName(name: string): string {
  const base = name.replace(/\W+/g, '_').replace(/^(\d)/, '_$1')
  return `${base}_copy`
}

export function SaveCopyDialog({ viewName, reason, taken, onSave, onCancel }: {
  viewName: string
  reason: CopyReason
  /** Names already in use; checked here so the common clash never costs a round trip. */
  taken: ReadonlySet<string>
  /** Resolves to an error message to show, or null once saved. */
  onSave(name: string): Promise<string | null>
  onCancel(): void
}) {
  const [name, setName] = useState(() => suggestedCopyName(viewName))
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  useEffect(() => { input.current?.select() }, [])

  async function submit(event: React.FormEvent): Promise<void> {
    event.preventDefault()
    const wanted = name.trim()
    const problem = !VIEW_NAME.test(wanted)
      ? 'Use letters, digits and underscores, not starting with a digit.'
      : taken.has(wanted) ? `A view named ${wanted} already exists. Choose another name.` : ''
    if (problem) {
      setError(problem)
      input.current?.focus()
      return
    }
    setBusy(true)
    const refused = await onSave(wanted)
    setBusy(false)
    if (refused) {
      setError(refused)
      input.current?.focus()
    }
  }

  return (
    <div className="viewcopy-scrim" onKeyDown={(event) => { if (event.key === 'Escape') onCancel() }}>
      <form className="viewcopy" role="dialog" aria-modal="true" aria-labelledby="viewcopy-title" onSubmit={(event) => void submit(event)} noValidate>
        <h3 id="viewcopy-title">Save a copy of {viewName}</h3>
        <p>
          {reason.kind === 'realm' && <>This view comes from the <strong>{reason.realm}</strong> realm, so it can't be changed here.</>}
          {reason.kind === 'world' && <>This view ships with this world, so it can't be changed here.</>}
          {reason.kind === 'contract' && <>This view is bound to a data contract, which saving over it would drop.</>}
          {' '}Your edited query will be saved as a new view in your world.
        </p>
        <p className="hint">
          {reason.kind === 'realm'
            ? `The original stays as it is, and later updates to the ${reason.realm} realm won't reach your copy.`
            : 'The original stays as it is.'}
        </p>
        <label className="paramrow">
          <span className="paramname">name</span>
          <input
            ref={input}
            autoFocus
            value={name}
            spellCheck={false}
            autoComplete="off"
            aria-invalid={error ? true : undefined}
            aria-describedby="viewcopy-help"
            onChange={(event) => { setName(event.target.value); setError('') }}
          />
          <small id="viewcopy-help" className={error ? 'viewcopy-error' : undefined}>
            {error || 'Letters, digits and underscores; it is used as a label in queries.'}
          </small>
        </label>
        <div className="row viewcopy-actions">
          <button type="button" className="btn ghost" onClick={onCancel}>Cancel</button>
          <button type="submit" className="btn primary" disabled={busy}>{busy ? 'saving…' : 'Save copy'}</button>
        </div>
      </form>
    </div>
  )
}
