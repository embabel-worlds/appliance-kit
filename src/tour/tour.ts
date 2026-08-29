/*
 * THE TOUR VOCABULARY — small, closed, and the same on every surface.
 *
 * A tour is a script the UI runs against a vocabulary the UI itself publishes. Nothing here
 * addresses a widget by CSS selector, by position or by pixel: a step names something the surface
 * has declared in its dictionary, and a surface that has not declared it refuses the tour up front
 * rather than failing at step seven with the user half-onboarded.
 *
 * WHY THE VOCABULARY IS CLOSED, since it is the constraint everything else rests on. Tours are
 * meant to be exchanged — a realm ships one, a user exports one and sends it to a colleague — and
 * a file that types into someone's UI and runs queries against their own graph is `curl | sh` with
 * a friendlier icon. Eight verbs over declared names can be rendered back as prose and READ before
 * it runs (see `describe`). Arbitrary code cannot, which is the whole argument against writing
 * tours in TypeScript.
 *
 * The server neither knows nor validates any of this — see the note on `Tour` in the assistant.
 * Everything in this file is parsed out of the passthrough map it carries.
 */

/** What a step does. One verb per step; the key that is present decides. */
export type TourVerb =
  /** Narrate. The half of a tour that teaches; markdown, rendered by the host. */
  | 'say'
  /** Collect a parameter from the user before the walk can continue. */
  | 'ask'
  /** Go to a named panel, tab or page. */
  | 'open'
  /** Put a value in a named field. */
  | 'set'
  /** Press a named control. */
  | 'invoke'
  /** Run a named saved view or verb — a SEMANTIC action, not a click on whatever runs it. */
  | 'run'
  /** Block until the surface reports a named state. */
  | 'wait'
  /** Assert a named state, and say something useful when it does not hold. */
  | 'expect'

export const TOUR_VERBS: readonly TourVerb[] = ['say', 'ask', 'open', 'set', 'invoke', 'run', 'wait', 'expect']

/** Everything except `say`, which is also a modifier — see the note in [parseStep]. */
const ACTION_VERBS: readonly TourVerb[] = ['ask', 'open', 'set', 'invoke', 'run', 'wait', 'expect']

/**
 * Who performs a step.
 *
 * `user` is the walkthrough half, and it is what separates a lesson from a macro: the tour points,
 * explains, and WAITS while the person does it themselves. A tour that only ever performs is a
 * demo the user watched.
 */
export type TourActor = 'tour' | 'user'

/**
 * A target is `kind.name` — `panel.documents`, `field.domain`, `button.populate`,
 * `view.EsgCoverage`, `state.ingest.idle`.
 *
 * The kind is what a dictionary is indexed by, so an unknown target is detectable without knowing
 * anything about the surface. Names may contain dots (`ingest.idle`); the FIRST segment is the kind.
 */
export interface TourTarget {
  kind: string
  name: string
  /** As written, for messages — reconstructing it from the parts loses nothing but reads worse. */
  text: string
}

export interface TourStep {
  verb: TourVerb
  /** Absent for `say` and `ask`, which name no widget. */
  target?: TourTarget
  by: TourActor
  /** `ask`: the parameter being collected. `set`: the value to put in the field. */
  value?: string
  /** `run`: parameters for the view or verb, values possibly containing `{{ param }}`. */
  params?: Record<string, string>
  /** Narration attached to any step, shown as it runs. */
  say?: string
  /** What to tell the user when the step is theirs to do. */
  hint?: string
  /** Shown while a `wait` is outstanding, so a slow step narrates itself instead of hanging mute. */
  meanwhile?: string
  /** `wait`: how long before giving up. */
  timeoutMs?: number
  /** `expect`: what to say when the assertion does not hold. */
  otherwise?: string
  /** The question the step asks, for `ask`. */
  question?: string
  /** Everything the file declared, for a host that wants a field this kit has not heard of. */
  raw: Readonly<Record<string, unknown>>
}

export interface Tour {
  id: string
  declaredId: string
  /** Imported or recorded by this user, rather than shipped by a realm or the world. */
  userSaved: boolean
  /**
   * The appliance can REMOVE it — narrower than [userSaved], and the distinction a UI must respect.
   *
   * A tour hand-written into a user's own config is theirs, but the server did not write that file
   * and will not rewrite it, so a Delete button for it would do nothing at all. Offer Delete on
   * this, never on ownership.
   */
  deletable: boolean
  /**
   * The realm that shipped it, or undefined for a world's own and a user's own.
   *
   * Carried by the server rather than split out of the id, so a UI can group a realm's tours under
   * its name and offer them on that realm's own card — which is where somebody is standing at the
   * moment a tour matters most, just after installing it.
   */
  source?: string
  name: string
  description?: string
  /** Parameters the tour collects before it starts, in declaration order. */
  params: TourParam[]
  steps: TourStep[]
  /** What the file said it needs, over and above what its steps imply. */
  requires: string[]
  raw: Readonly<Record<string, unknown>>
}

export interface TourParam {
  name: string
  question: string
}

/** One tour as the wire delivers it: presentation maps the server carried through uninterpreted. */
export interface WireTour {
  id: string
  declaredId: string
  userSaved: boolean
  deletable?: boolean
  source?: string
  presentation: Record<string, unknown>
  steps: { presentation: Record<string, unknown> }[]
}

export class TourFormatError extends Error {}

const str = (v: unknown): string | undefined => (typeof v === 'string' ? v : undefined)

/** `10m`, `90s`, `500ms`, or a bare number of milliseconds. */
export function parseDuration(raw: unknown): number | undefined {
  if (typeof raw === 'number') return raw
  const text = str(raw)?.trim()
  if (!text) return undefined
  const match = /^(\d+(?:\.\d+)?)\s*(ms|s|m|h)?$/.exec(text)
  if (!match) return undefined
  const scale: Record<string, number> = { ms: 1, s: 1000, m: 60_000, h: 3_600_000 }
  return Number(match[1] ?? '0') * (scale[match[2] ?? 'ms'] ?? 1)
}

export function parseTarget(text: string): TourTarget {
  const dot = text.indexOf('.')
  if (dot <= 0 || dot === text.length - 1) {
    throw new TourFormatError(`'${text}' is not a target — targets are kind.name, like panel.documents`)
  }
  return { kind: text.slice(0, dot), name: text.slice(dot + 1), text }
}

/**
 * One step, from the map its file declared.
 *
 * A step with no verb this kit knows is an ERROR rather than a no-op. The alternative — skipping
 * quietly — turns a typo into a tour that runs to the end having done less than it said, which is
 * the failure mode hardest to notice and worst to debug.
 */
export function parseStep(presentation: Record<string, unknown>): TourStep {
  // `say` IS BOTH A VERB AND A MODIFIER, and the action wins.
  //
  // `say:` on its own is narration; `say:` beside `invoke:` is the narration for that step. Any
  // other precedence turns every annotated step into a step that only talks — which is exactly what
  // the recorder produces, since it writes a `say: TODO` onto everything it captures. Found by the
  // round-trip test, where a recorded walk read back as three narrations and no actions.
  const verb = ACTION_VERBS.find((v) => presentation[v] !== undefined) ?? (presentation.say !== undefined ? 'say' : undefined)
  if (!verb) {
    const keys = Object.keys(presentation).join(', ') || '(nothing)'
    throw new TourFormatError(`a step must name one of ${TOUR_VERBS.join(', ')} — this one has ${keys}`)
  }
  const subject = presentation[verb]
  const by: TourActor = str(presentation.by) === 'user' ? 'user' : 'tour'
  const step: TourStep = {
    verb,
    by,
    raw: presentation,
    say: verb === 'say' ? str(subject) : str(presentation.say),
    hint: str(presentation.hint),
    meanwhile: str(presentation.meanwhile),
    otherwise: str(presentation.else),
    timeoutMs: parseDuration(presentation.timeout),
  }
  if (verb === 'say') return step
  if (verb === 'ask') {
    step.value = str(subject)
    step.question = str(presentation.question) ?? str(presentation.hint)
    return step
  }
  const text = str(subject)
  if (!text) throw new TourFormatError(`'${verb}' needs a target, like ${verb}: panel.documents`)
  step.target = parseTarget(text)
  if (verb === 'set') {
    const to = presentation.to
    if (to === undefined) throw new TourFormatError(`'set: ${text}' needs a 'to:' value`)
    step.value = typeof to === 'string' ? to : String(to)
  }
  if (verb === 'run' && presentation.with && typeof presentation.with === 'object') {
    step.params = Object.fromEntries(
      Object.entries(presentation.with as Record<string, unknown>).map(([k, v]) => [k, String(v)]),
    )
  }
  return step
}

/** A tour from the wire. Throws [TourFormatError] on a step this kit cannot read. */
export function parseTour(wire: WireTour): Tour {
  const p = wire.presentation ?? {}
  const params = Array.isArray(p.params)
    ? []
    : Object.entries((p.params ?? {}) as Record<string, unknown>).map(([name, spec]) => ({
        name,
        question: str((spec as Record<string, unknown>)?.ask) ?? `${name}?`,
      }))
  return {
    id: wire.id,
    declaredId: wire.declaredId,
    userSaved: wire.userSaved,
    deletable: wire.deletable === true,
    ...(wire.source ? { source: wire.source } : {}),
    name: str(p.name) ?? wire.declaredId,
    description: str(p.description),
    params,
    steps: (wire.steps ?? []).map((s, i) => {
      try {
        return parseStep(s.presentation ?? {})
      } catch (e) {
        throw new TourFormatError(`step ${i + 1}: ${(e as Error).message}`)
      }
    }),
    requires: declaredRequirements(p.requires),
    raw: p,
  }
}

/**
 * `requires:` as a flat list of targets.
 *
 * Two shapes are accepted because both read naturally and neither is worth refusing: a list of
 * targets (`[panel.documents, view.EsgCoverage]`), or the grouped form the issue used
 * (`panels: [documents]`, `views: [EsgCoverage]`). The grouped keys are pluralised kinds.
 */
function declaredRequirements(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.filter((x): x is string => typeof x === 'string')
  if (!raw || typeof raw !== 'object') return []
  return Object.entries(raw as Record<string, unknown>).flatMap(([group, names]) => {
    const kind = group.replace(/s$/, '')
    return Array.isArray(names) ? names.filter((n): n is string => typeof n === 'string').map((n) => `${kind}.${n}`) : []
  })
}
