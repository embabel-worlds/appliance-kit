/*
 * RECORDING — the inverse of the resolver, and cheap only because the dictionary exists.
 *
 * A surface that can turn `field.domain` into a widget can also turn that widget back into
 * `field.domain`, so recording is a few lines on top of work already done. That is the whole reason
 * this comes AFTER the vocabulary rather than before it: a recorder built first has nothing to name
 * things with, so it records positions and selectors, and produces the brittle scripts that made
 * macro recorders a byword for rot.
 *
 * A RECORDED TOUR IS A DRAFT, and this module says so in the file it writes. Four verbs can be
 * observed — open, set, invoke, run — and the two that make a tour worth running cannot:
 *
 *  - `say`, the narration. Nobody can watch a click and know why it mattered.
 *  - `doneWhen`, the precondition. It is a claim about the world, not an event in it, and it is
 *    what makes a tour resumable.
 *
 * Pretending otherwise would ship tours that re-run steps on resume and explain nothing, and the
 * author would not know why. So: record the skeleton, hand it back with the gaps marked, and let a
 * human — or a coding agent with the tour-authoring skill — write the half that teaches.
 */

import { stringify } from 'yaml'
import type { TourActor, TourVerb } from './tour.ts'

export interface RecordedAction {
  verb: Extract<TourVerb, 'open' | 'set' | 'invoke' | 'run' | 'say'>
  /** `panel.documents`, `field.domain` … absent for `say`. */
  target?: string
  /** The value typed, for `set`; the narration, for `say`. */
  value?: string
  params?: Record<string, string>
  /** Recorded as the user's own step, so the draft hands it back to them rather than performing it. */
  by?: TourActor
}

export interface TourDraftMeta {
  id: string
  name: string
  description?: string
}

const HEADER = `# RECORDED, AND THEREFORE A DRAFT.
#
# What a recorder can see is what was clicked. What it cannot see is why any of it mattered, or
# when a step is already done — and those are the two things that make a tour worth running:
#
#   say:      narration. Add one before each step that teaches something.
#   doneWhen: Cypher that is true when a step need not run again. Without it, a user who pauses
#             and resumes re-runs work they have already done.
#
# Both are marked TODO below. Delete the markers as you fill them in.`

const TODO_SAY = 'TODO: say what this step is for.'

/**
 * Collects what a user did and hands back the skeleton of a tour.
 *
 * Coalescing is deliberate and minimal: typing into a field emits one action per keystroke in most
 * UIs, and a tour with forty `set` steps for one field is not a draft anybody would edit. Anything
 * cleverer than "the last value wins" would be guessing at intent.
 */
export class TourRecorder {
  private readonly recorded: RecordedAction[] = []

  observe(action: RecordedAction): void {
    const previous = this.recorded.at(-1)
    if (previous && sameTarget(previous, action)) {
      // The same field typed into twice, or the same panel opened twice: keep the later one.
      if (action.verb === 'set' || action.verb === 'open') {
        this.recorded[this.recorded.length - 1] = action
        return
      }
    }
    this.recorded.push(action)
  }

  /** Narration the author typed while recording — the one thing worth capturing that is not a click. */
  narrate(markdown: string): void {
    this.recorded.push({ verb: 'say', value: markdown })
  }

  undo(): void {
    this.recorded.pop()
  }

  get actions(): readonly RecordedAction[] {
    return this.recorded
  }

  /** The draft as the object a tour file holds. */
  draft(meta: TourDraftMeta): Record<string, unknown> {
    return {
      id: meta.id,
      name: meta.name,
      ...(meta.description ? { description: meta.description } : {}),
      steps: this.recorded.map((action) => step(action)),
    }
  }

  /** The draft as the FILE — importable as it stands, and readable enough to edit. */
  toYaml(meta: TourDraftMeta): string {
    return `${HEADER}\n\n${stringify([this.draft(meta)], { lineWidth: 96 })}`
  }
}

const sameTarget = (a: RecordedAction, b: RecordedAction): boolean =>
  a.verb === b.verb && a.target !== undefined && a.target === b.target

function step(action: RecordedAction): Record<string, unknown> {
  if (action.verb === 'say') return { say: action.value ?? '' }
  const out: Record<string, unknown> = { [action.verb]: action.target }
  if (action.verb === 'set') out.to = action.value ?? ''
  if (action.verb === 'run' && action.params) out.with = action.params
  if (action.by === 'user') out.by = 'user'
  // The gaps, named where the author will see them rather than in documentation they have to find.
  out.say = TODO_SAY
  if (action.verb === 'invoke' || action.verb === 'run') {
    out.doneWhen = 'TODO: Cypher that returns a row once this step need not run again.'
  }
  return out
}
