/*
 * A VIEW'S CYPHER, EDITABLE IN PLACE — one editor at two sizes.
 *
 * Small, it hangs under the run bar for a quick tweak. Expanded, it covers the tabs and results for
 * real work, stopping short of the bottom so a strip of what it covers stays visible: the user is
 * never unsure where their results went. It is ONE CodeMirror instance whose container changes
 * size, never two editors sharing text, so the cursor, scroll and undo stack survive the switch and
 * nobody has to be told the two are the same.
 *
 * Run closes it at either size — the point of running is to look at the rows.
 */

import React, { forwardRef, useEffect, useImperativeHandle } from 'react'
import { useEditor } from '../studio/editor.ts'

export type EditorSize = 'closed' | 'mini' | 'full'

export interface ViewCypherEditorHandle {
  getText(): string
  /** Replace the text without reporting it as an edit. */
  setText(text: string): void
}

export interface ViewCypherEditorProps {
  size: EditorSize
  onSize(size: EditorSize): void
  onRun(): void
  /** Every hand edit; the owner compares against the saved body. */
  onEdit(text: string): void
  edited: boolean
  /** The save control, and any note beside it (Saved · Undo, a refusal). */
  saveControls: React.ReactNode
  onRevert(): void
  /** What the expanded editor covers, for the strip left showing underneath. */
  underneath: string
}

export const ViewCypherEditor = forwardRef<ViewCypherEditorHandle, ViewCypherEditorProps>(function ViewCypherEditor(
  { size, onSize, onRun, onEdit, edited, saveControls, onRevert, underneath },
  ref,
) {
  const { ref: hostRef, handle } = useEditor({
    mode: 'application/x-cypher-query',
    onRun,
    onEdit: () => onEdit(handle.getText()),
  })
  useImperativeHandle(ref, () => ({ getText: handle.getText, setText: handle.setText }), [handle.editor])

  // CodeMirror measures itself when it becomes visible or changes size; it cannot notice either.
  useEffect(() => {
    if (size === 'closed') return
    handle.editor?.refresh()
    handle.editor?.focus()
  }, [size, handle.editor])

  /*
   * CAPTURED, before CodeMirror sees the key: CodeMirror binds Escape itself (to collapse a
   * multi-selection) and marks it handled, so a bubbling listener would never step the editor down.
   * An open completion list keeps Escape, to close itself.
   */
  function onKeyDownCapture(event: React.KeyboardEvent): void {
    if (event.key !== 'Escape') return
    if ((handle.editor as { state?: { completionActive?: unknown } } | null)?.state?.completionActive) return
    event.preventDefault()
    onSize(size === 'full' ? 'mini' : 'closed')
  }

  return (
    <>
      <section
        className={`viewcypher viewcypher-${size}`}
        hidden={size === 'closed'}
        role="region"
        aria-label={size === 'full' ? 'Cypher editor, expanded' : 'Cypher editor'}
        onKeyDownCapture={onKeyDownCapture}
      >
        <header className="viewcypher-head">
          <span className="viewnav-label">Cypher</span>
          {edited && <span className="viewtag viewtag-edited">edited</span>}
          {edited && <button className="btn ghost tiny" onClick={onRevert}>Revert</button>}
          <span className="viewcypher-spacer" />
          {saveControls}
          {size === 'full'
            ? <button className="btn ghost tiny" onClick={() => onSize('mini')} title="Back to the small editor">⤡ Shrink</button>
            : <button className="btn ghost tiny" onClick={() => onSize('full')} title="Grow the editor to fill the window">⤢ Expand</button>}
          <button className="btn ghost tiny" onClick={() => onSize('closed')} aria-label="Close the Cypher editor">✕</button>
        </header>
        <div className="editor-host viewcypher-host" ref={hostRef} />
      </section>
      {size === 'full' && (
        <button className="viewcypher-peek" onClick={() => onSize('closed')}>
          {underneath} underneath — Run to return
        </button>
      )}
    </>
  )
})
