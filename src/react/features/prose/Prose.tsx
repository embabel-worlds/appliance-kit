/*
 * THE ONE PLACE MODEL PROSE BECOMES DOM.
 *
 * `studio-kit/markdown.ts` states the POLICY once. This states the RENDERING once, which turns out
 * to be the half that drifts: the policy module existed, was correct, and was simply not reached by
 * the next surface to show an agent's words. Threads painted `{message.text}` into a `<p>`, so an
 * agent writing a list or a bold phrase showed people `- item` and `**bold**` — while chat, two
 * windows away, rendered the same prose properly. Nothing was broken; the renderer was absent.
 *
 * So a surface no longer gets to choose. It passes the libraries (injected, as the policy requires —
 * the Me app and the console each load `marked` and `DOMPurify` their own way) and this decides what
 * happens to the text. The `md` class comes with it, because the styles that make rendered markdown
 * readable are keyed on it and a surface that forgot the class got unstyled markup instead.
 *
 * It is `dangerouslySetInnerHTML` in ONE file rather than in each surface, which is the point:
 * [toSafeHtml] is the boundary that makes it safe, and a reviewer has one line to check instead of
 * one per feature.
 */

import React from 'react'
import { toSafeHtml, type MarkdownLibraries } from '../../../studio-kit/markdown.ts'

export interface ProseProps {
  /** `marked` and `DOMPurify`, injected by the front end — see the markdown policy. */
  libs: MarkdownLibraries
  /** Markdown from a model, or from a document a model quoted. Untrusted; null renders nothing. */
  text: string | null | undefined
  /** Extra classes for the surface's own layout. `md` is always present. */
  className?: string
}

export function Prose({ libs, text, className }: ProseProps) {
  return (
    <div
      className={className ? `md ${className}` : 'md'}
      dangerouslySetInnerHTML={{ __html: toSafeHtml(libs, text) }}
    />
  )
}
