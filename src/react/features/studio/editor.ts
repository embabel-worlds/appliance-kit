/*
 * THE EDITOR, ONCE, FOR BOTH STUDIOS.
 *
 * CodeMirror 5, not 6, and that is a decision rather than an oversight. The completion behaviour
 * both studios stand on — `createCypherHint` in `@embabel/appliance-kit/studio-kit` — is written
 * against CM5's `registerHelper`/`showHint` API and is already in production in the Me app. Taking
 * CM6 here would mean a second hint implementation, and the two front ends would then complete
 * differently on the same keystroke, which is precisely the drift the shared kit exists to end.
 * When Me moves, this moves with it.
 *
 * CM5 owns a DOM node and React must not re-render into it, so the editor is created once against
 * a ref and everything after that goes through the returned handle. React never sees the text.
 */

import { useEffect, useRef, useState } from 'react'
import CodeMirror from 'codemirror'
import 'codemirror/addon/hint/show-hint.js'
// In-box placeholder text — how an empty prompt says it is the place to type.
import 'codemirror/addon/display/placeholder.js'
import 'codemirror/mode/cypher/cypher.js'
import 'codemirror/mode/javascript/javascript.js'

/* CM5 ships no types for the addons and only loose ones for the core; the surface used here is
 * small and stated explicitly rather than pulled in as `any` at every call site. */
export interface Editor {
  getValue(): string
  setValue(text: string): void
  getCursor(): { line: number; ch: number }
  getLine(line: number): string
  getTokenAt(pos: { line: number; ch: number }): { string: string; start: number; end: number }
  coordsChar(coords: { left: number; top: number }, mode: string): { line: number; ch: number }
  charCoords(pos: { line: number; ch: number }, mode: string): { left: number; right: number; top: number; bottom: number }
  getWrapperElement(): HTMLElement
  addLineClass(line: number, where: string, cls: string): void
  removeLineClass(line: number, where: string, cls: string): void
  setCursor(pos: { line: number; ch: number }): void
  focus(): void
  refresh(): void
  on(event: string, handler: (...args: any[]) => void): void
  showHint(options: { completeSingle: boolean }): void
}

export interface EditorOptions {
  /** `application/x-cypher-query` or `text/typescript`. */
  mode: string
  /** ⌘⏎ / ⌃⏎ — the studio's primary verb. */
  onRun(): void
  /** Fires on every change the USER made; programmatic `setText` never triggers it. */
  onEdit?(): void
}

export interface EditorHandle {
  /** Null until the editor has mounted. */
  editor: Editor | null
  /** Set the text WITHOUT reporting it as a hand edit — how composed and generated text lands. */
  setText(text: string): void
  /** The current text. Safe to call before mount; empty until then. */
  getText(): string
  /** True once the user has typed into it — the composer stops overwriting at that point. */
  handEdited: boolean
}

export function useEditor(options: EditorOptions): { ref: React.RefObject<HTMLDivElement | null>; handle: EditorHandle } {
  const ref = useRef<HTMLDivElement>(null)
  const editorRef = useRef<Editor | null>(null)
  const programmatic = useRef(false)
  const [handEdited, setHandEdited] = useState(false)
  // Held in a ref so recreating the editor is never needed just because a callback identity moved.
  const callbacks = useRef(options)
  callbacks.current = options

  const [, forceRender] = useState(0)

  useEffect(() => {
    if (!ref.current || editorRef.current) return
    const run = () => callbacks.current.onRun()
    const cm = (CodeMirror as any)(ref.current, {
      mode: options.mode,
      lineNumbers: true,
      viewportMargin: Infinity,
      extraKeys: { 'Cmd-Enter': run, 'Ctrl-Enter': run, 'Ctrl-Space': 'autocomplete' },
    }) as Editor

    cm.on('change', () => {
      if (programmatic.current) return
      setHandEdited(true)
      callbacks.current.onEdit?.()
    })

    // Completion opens as you type the characters that BEGIN a completable thing — a label after
    // `(x:`, a relationship after `[:`, a property after `alias.`. Waiting for ⌃Space means most
    // people never discover the schema is there at all.
    cm.on('inputRead', (_cm: unknown, change: { origin: string; text: string[] }) => {
      if (change.origin !== '+input') return
      const ch = change.text[change.text.length - 1] ?? ''
      if (!/[:.'{\w]/.test(ch)) return
      const cursor = cm.getCursor()
      const before = cm.getLine(cursor.line).slice(0, cursor.ch)
      if (/(\(\s*\w*:\w*|\[\s*\w*:\w*|\w+\.\w*|via:\s*'\w*|ai:\s*\{\s*\w*|\(\s*\w*\s*(?::\s*\w+)?\s*\{[^{}]*)$/.test(before)) {
        cm.showHint({ completeSingle: false })
      }
    })

    editorRef.current = cm
    forceRender((n) => n + 1)
    return () => {
      cm.getWrapperElement().remove()
      editorRef.current = null
    }
    // Created once for the life of the component: `mode` is fixed per studio, and re-running this
    // would drop the user's text on the floor.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return {
    ref,
    handle: {
      editor: editorRef.current,
      handEdited,
      getText: () => editorRef.current?.getValue() ?? '',
      setText: (text: string) => {
        const cm = editorRef.current
        if (!cm) return
        programmatic.current = true
        cm.setValue(text)
        programmatic.current = false
      },
    },
  }
}

/** The CodeMirror constructor, for `registerHelper` and `Pos` at a studio's module scope. */
export { CodeMirror }
