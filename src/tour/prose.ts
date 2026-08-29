/*
 * WHAT THIS TOUR WILL DO, IN ENGLISH, BEFORE IT DOES ANY OF IT.
 *
 * This is the payoff for keeping the vocabulary closed, and the reason a tour from a stranger's
 * realm can be offered at all. Every line below is DERIVED from the file — not written by its
 * author — so a tour cannot describe itself as one thing and do another. A tour written in
 * TypeScript could not have this function at all, which is the argument for the constraint stated
 * as code.
 *
 * Deliberately plain text and not markup: the console renders it in React, the Me app paints it as
 * textContent, and a summary that arrives as HTML is a summary somebody has to sanitize before
 * showing it — which is precisely the ceremony this exists to make unnecessary.
 */

import type { Tour } from './tour.ts'
import type { TourDictionary } from './dictionary.ts'
import { fitness } from './dictionary.ts'

export interface TourSynopsis {
  title: string
  /** The tour's own prose, when it declared any. Kept apart from [facts] because it is the only
   *  line an author wrote — everything else is derived, and a card that runs them together as one
   *  block reads as a dump rather than as a claim followed by its evidence. */
  description?: string
  /** What it will do, one derived statement each, in the order they would happen. */
  facts: string[]
  /** [description] and [facts] as one list — the plain-text rendering, for hosts that want it. */
  lines: string[]
  /** Set when this surface cannot run it — see `refusal`. */
  blocked?: string
}

const list = (items: string[]): string =>
  items.length <= 1 ? (items[0] ?? '') : `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`

/**
 * A tour reduced to what a cautious person needs before consenting: what it will ask them, where it
 * will take them, what it will type, what it will run, and what it will never do.
 */
export function describe(tour: Tour, dictionary?: TourDictionary): TourSynopsis {
  const facts: string[] = []
  const lines: string[] = []
  if (tour.description) lines.push(tour.description)

  const asks = tour.params.map((p) => p.name)
  const stepAsks = tour.steps.filter((s) => s.verb === 'ask').map((s) => s.value ?? 'something')
  const asked = [...new Set([...asks, ...stepAsks])]
  if (asked.length) lines.push(`Will ask you for ${list(asked)}.`)

  const panels = unique(tour, 'open')
  if (panels.length) lines.push(`Opens ${list(panels)}.`)

  const fields = unique(tour, 'set')
  if (fields.length) lines.push(`Fills in ${list(fields)}.`)

  const controls = unique(tour, 'invoke')
  if (controls.length) lines.push(`Presses ${list(controls)}.`)

  const runs = unique(tour, 'run')
  if (runs.length) lines.push(`Runs ${list(runs)}.`)

  const yours = tour.steps.filter((s) => s.by === 'user').length
  if (yours) lines.push(`${yours} ${yours === 1 ? 'step is' : 'steps are'} yours to do — it waits for you.`)

  // The two constants, stated every time. A reader deciding whether to trust a file from somebody
  // else should not have to infer the boundary from the absence of alarming lines.
  lines.push('Reads and writes nothing else, and runs no code of its own.')
  lines.push('Pause or stop at any step.')

  facts.push(...lines.slice(tour.description ? 1 : 0))
  const synopsis: TourSynopsis = { title: tour.name, facts, lines }
  if (tour.description) synopsis.description = tour.description
  if (dictionary) {
    const { missing } = fitness(tour, dictionary)
    if (missing.length) {
      synopsis.blocked = `Needs ${list(missing.map((t) => t.text))}, which ${dictionary.surface} does not have.`
    }
  }
  return synopsis
}

/** The distinct human-readable names a verb touches, in first-use order. */
function unique(tour: Tour, verb: string): string[] {
  const seen: string[] = []
  for (const step of tour.steps) {
    if (step.verb !== verb || !step.target) continue
    const name = step.target.name
    if (!seen.includes(name)) seen.push(name)
  }
  return seen
}
