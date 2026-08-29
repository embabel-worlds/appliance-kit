/*
 * RUNNING A TOUR — the step machine, shared by every surface so that pausing, resuming, skipping
 * and stopping mean the same thing in the console as in the Me app.
 *
 * The host does the doing. This owns only the ORDER and the CONTROL: which step is next, whether it
 * is already satisfied, whose turn it is to act, and what happens when somebody walks away in the
 * middle. All of that is identical on both front ends and none of it is worth writing twice.
 *
 * PAUSE HAPPENS BETWEEN STEPS, never inside one. A pause that could land mid-`invoke` would have to
 * define what half a button press means, and there is no useful answer; a step is the unit that is
 * either done or not. So `pause()` is a request, honoured at the next boundary, and the UI says
 * "pausing…" for as long as the current step takes.
 *
 * AND EVERY STEP ASKS FIRST. Before running a step, the runner asks the server whether that step's
 * precondition already holds, and skips it if so. That is what makes leaving and coming back work:
 * a user who did steps one to three by hand, or yesterday, is walked from four. The direction of
 * the fail-soft matters and is decided server-side — UNKNOWN means run it, because repeating a step
 * is visible and recoverable while silently skipping one is neither.
 */

import type { Tour, TourStep, TourTarget } from './tour.ts'

export type TourStepStatus = 'DONE' | 'TODO' | 'UNKNOWN'

/**
 * How often a handed-over step asks the world whether the user has done it yet, backing off.
 *
 * Every poll is a Cypher query run as the user. Somebody who has gone to a terminal may be ten
 * minutes, and a fixed four-second poll would spend a hundred and fifty queries waiting for them —
 * so it starts responsive, because most people come back quickly, and slackens for the ones who do
 * not. It never stops: the whole point is that they need not come back and press anything.
 */
const WATCH_MS = 4000
const WATCH_MAX_MS = 20_000

/**
 * What a surface must be able to do for a tour to run on it.
 *
 * Every method takes the step, because a host will want its narration and its hint, and threading
 * them through as separate arguments means changing this interface every time the vocabulary grows
 * a modifier.
 */
export interface TourHost {
  /** Go to a panel, tab or page. */
  open(target: TourTarget, step: TourStep): Promise<void> | void
  /** Put [value] in a field. */
  set(target: TourTarget, value: string, step: TourStep): Promise<void> | void
  /** Press a control. */
  invoke(target: TourTarget, step: TourStep): Promise<void> | void
  /** Run a saved view or verb. */
  run(target: TourTarget, params: Record<string, string>, step: TourStep): Promise<void> | void
  /** Block until a named state holds. False on timeout — NOT an exception; see `runTour`. */
  waitFor(target: TourTarget, timeoutMs: number | undefined, step: TourStep): Promise<boolean>
  /** Does a named state hold right now? For `expect`. */
  check(target: TourTarget, step: TourStep): Promise<boolean>
  /**
   * Narrate. Markdown; the host owns sanitizing, as it does for every other authored string.
   *
   * MAY RETURN A PROMISE, and a host that shows one caption at a time SHOULD. Narration that
   * returns instantly is narration the next step overwrites before anyone has read it: the tour
   * appears to jump from the first caption to the last, which reads as a bug and leaves the user
   * with no idea what happened. A host that holds until the words have been read — or until the
   * user asks for the next one — is what makes a tour legible rather than a flicker.
   */
  say(markdown: string, step: TourStep | undefined): void | Promise<void>
  /** Collect a parameter. `undefined` means the user declined, which ends the tour. */
  ask(name: string, question: string): Promise<string | undefined>
  /**
   * Hand the step to the user and wait. Resolves `true` when they did it, `false` when they asked
   * to skip. This is the walkthrough half — the tour points and waits rather than performing.
   */
  handOver(step: TourStep): Promise<boolean>
  /**
   * Ask the appliance whether step [index] is already satisfied, given what the tour has collected
   * so far.
   *
   * The parameters matter more than they look: the precondition worth writing is usually ABOUT the
   * thing the user just named — "have we already extracted this domain?" — and without them the
   * only expressible conditions are those that depend on no answer, which excludes every expensive
   * step a tour most wants to skip.
   */
  stepStatus(index: number, params: Record<string, string>): Promise<TourStepStatus>
}

export type TourRunState = 'idle' | 'running' | 'pausing' | 'paused' | 'done' | 'stopped' | 'failed'

export interface TourProgress {
  state: TourRunState
  /** The step about to run, or the one that just failed. */
  index: number
  total: number
  step?: TourStep
  /** Why, when the state is `failed`. */
  error?: string
  /** Steps skipped because their precondition already held. */
  skipped: number
}

export interface TourRunOptions {
  host: TourHost
  /** Called on every state change, for a UI that renders progress. */
  onProgress?: (progress: TourProgress) => void
  /** Start partway in — resuming where somebody left off. */
  from?: number
  /** Parameters already known, so a resumed tour does not re-ask. */
  params?: Record<string, string>
}

/** `{{ name }}` — the only interpolation there is. */
export function interpolate(text: string, params: Record<string, string>): string {
  return text.replace(/\{\{\s*([A-Za-z0-9_.-]+)\s*\}\}/g, (whole, name: string) =>
    Object.prototype.hasOwnProperty.call(params, name) ? (params[name] ?? whole) : whole,
  )
}

/**
 * One run of one tour.
 *
 * Not an event emitter and not a framework: a class with three controls and a promise. The console
 * wraps it in React state, the Me app calls it from a click handler, and neither has to adopt the
 * other's idea of how a UI updates.
 */
export class TourRun {
  private runState: TourRunState = 'idle'
  private cursor: number
  private skipped = 0
  private readonly host: TourHost
  private readonly onProgress?: (progress: TourProgress) => void
  private readonly params: Record<string, string>
  private resumeGate?: () => void
  /** Set by [back]; consumed at the next step boundary. */
  private rewind = false
  /** Indices the user asked to see again, which run whatever their precondition says. */
  private readonly forced = new Set<number>()
  /**
   * Lets [back] interrupt a host that is holding — a caption waiting on Next, say. Without it,
   * pressing Back during a hold does nothing until the hold ends, which reads as a dead button.
   */
  skipHold?: () => void

  constructor(
    readonly tour: Tour,
    options: TourRunOptions,
  ) {
    this.host = options.host
    this.onProgress = options.onProgress
    this.cursor = options.from ?? 0
    this.params = { ...(options.params ?? {}) }
  }

  get state(): TourRunState {
    return this.runState
  }

  /** Read through a predicate rather than comparing the field: the loop below reads it either
   *  side of an `await`, and narrowing does not survive one. */
  private is(...states: TourRunState[]): boolean {
    return states.includes(this.runState)
  }

  /** Where the tour got to — what a host persists so "continue where I left off" is possible. */
  get index(): number {
    return this.cursor
  }

  get collected(): Readonly<Record<string, string>> {
    return this.params
  }

  /**
   * Go back a step.
   *
   * Honoured at the next boundary, like pause, and the step it returns to is RUN AGAIN even if its
   * precondition says it is already done — somebody pressing Back is asking to see it, and a
   * `doneWhen` that skipped them straight forward again would make the button look broken. That
   * exemption is the only place a precondition is ignored, and it is the one place a human has
   * overruled it on purpose.
   */
  back(): void {
    if (this.cursor === 0 || this.is('done')) return
    this.rewind = true
    this.skipHold?.()
  }

  /** Honoured at the next step boundary. */
  pause(): void {
    if (this.is('running')) this.transition('pausing')
  }

  resume(): void {
    if (!this.is('paused')) return
    this.transition('running')
    this.resumeGate?.()
    this.resumeGate = undefined
  }

  /**
   * Leave, for good.
   *
   * Nothing is unwound. A tour makes real changes to a real world — documents were fetched, a view
   * was run — and pretending otherwise by rolling back would be both impossible and a lie. Stopping
   * means the walking stops; what the world learned on the way is the user's to keep.
   */
  stop(): void {
    if (this.is('done', 'stopped')) return
    this.transition('stopped')
    this.resumeGate?.()
    this.resumeGate = undefined
  }

  /** Run to the end, or until stopped. Resolves with the final progress rather than throwing. */
  async start(): Promise<TourProgress> {
    if (this.is('running')) return this.progress()
    this.transition('running')

    for (const param of this.tour.params) {
      if (this.params[param.name] !== undefined) continue
      const answer = await this.host.ask(param.name, param.question)
      if (answer === undefined) {
        this.transition('stopped')
        return this.progress()
      }
      this.params[param.name] = answer
    }

    while (this.cursor < this.tour.steps.length) {
      if (this.is('stopped')) return this.progress()
      if (this.is('pausing')) {
        this.transition('paused')
        await new Promise<void>((resolve) => {
          this.resumeGate = resolve
        })
        if (this.is('stopped')) return this.progress()
      }

      const step = this.tour.steps[this.cursor]
      if (!step) break
      this.transition('running')

      // ALREADY DONE? Asked per step, when the step is reached — see the file note. A step the
      // user has just stepped BACK to is never asked about: they said they want to see it.
      let status: TourStepStatus = 'TODO'
      if (!this.forced.has(this.cursor)) {
        try {
          status = await this.host.stepStatus(this.cursor, this.params)
        } catch {
          // A precondition we cannot ask about is one we run. Same direction as the server's.
          status = 'UNKNOWN'
        }
      }
      if (status === 'DONE') {
        this.skipped += 1
        this.cursor += 1
        continue
      }

      try {
        const carryOn = await this.perform(step)
        if (!carryOn) return this.progress()
      } catch (e) {
        this.runState = 'failed'
        return this.progress((e as Error).message)
      }
      if (this.rewind) {
        this.rewind = false
        this.cursor = Math.max(0, this.cursor - 1)
        this.forced.add(this.cursor)
        continue
      }
      this.forced.delete(this.cursor)
      this.cursor += 1
    }

    this.transition('done')
    return this.progress()
  }

  /** False means the tour should stop here — an unmet `expect`, or a user who declined. */
  private async perform(step: TourStep): Promise<boolean> {
    // WATCH, THEN READ — the narration on an action step lands AFTER the action.
    //
    // It ran the other way first, and watching it made the mistake obvious: the caption described
    // a table while the screen still showed the previous one, so every explanation was about
    // something the user could not see. A pure `say` step is the place to say what is coming; a
    // caption attached to an action is a label for what just happened.
    const narrate = async () => {
      if (step.say && step.verb !== 'say') await this.host.say(interpolate(step.say, this.params), step)
    }

    if (step.by === 'user' && step.verb !== 'say' && step.verb !== 'ask') {
      // THE HINT IS NOT NARRATION — it goes to [TourHost.handOver] with the step, so it appears
      // beside the Done/Skip it is instructing. Narrating it first made the hand-over a two-stage
      // prompt: read the instruction, press Next, and only THEN get the buttons that act on it.
      // Seen in a screenshot; it reads as the tour having stalled.
      //
      // A declined hand-over is a SKIP, not a stop: the user has decided this step is not for them,
      // and the rest of the tour may still be exactly what they wanted.
      //
      // AND THE WORLD CAN ANSWER FOR THEM. A step handed over because it happens OUTSIDE the app —
      // open a terminal, connect a coding agent — cannot be driven and should not be. But when the
      // step declares a precondition, the appliance knows the moment it comes true, so the tour
      // waits for EITHER the button or the world and carries on by itself. That is the difference
      // between "press Done when you have" and a tour that noticed.
      const index = this.cursor
      await Promise.race(
        step.watchable ?
          [this.host.handOver(step), this.watchFor(index)]
        : [this.host.handOver(step)],
      )
      return true
    }

    const target = step.target
    switch (step.verb) {
      case 'say':
        await this.host.say(interpolate(step.say ?? '', this.params), step)
        return true
      case 'ask': {
        const name = step.value ?? ''
        const answer = await this.host.ask(name, step.question ?? `${name}?`)
        if (answer === undefined) {
          this.transition('stopped')
          return false
        }
        this.params[name] = answer
        return true
      }
      case 'open':
        await this.host.open(target!, step)
        await narrate()
        return true
      case 'set':
        await this.host.set(target!, interpolate(step.value ?? '', this.params), step)
        await narrate()
        return true
      case 'invoke':
        await this.host.invoke(target!, step)
        await narrate()
        return true
      case 'run': {
        const params = Object.fromEntries(
          Object.entries(step.params ?? {}).map(([k, v]) => [k, interpolate(v, this.params)]),
        )
        await this.host.run(target!, params, step)
        await narrate()
        return true
      }
      case 'wait': {
        await narrate()
        if (step.meanwhile) await this.host.say(step.meanwhile, step)
        const arrived = await this.host.waitFor(target!, step.timeoutMs, step)
        if (!arrived) {
          // A timeout is not a crash. Say so and stop where the user can see what happened, with
          // the world in whatever state the wait was watching.
          this.host.say(step.otherwise ?? `Gave up waiting for ${target!.text}.`, step)
          this.transition('stopped')
          return false
        }
        return true
      }
      case 'expect': {
        await narrate()
        const held = await this.host.check(target!, step)
        if (!held) {
          this.host.say(interpolate(step.otherwise ?? `Expected ${target!.text}.`, this.params), step)
          this.transition('stopped')
          return false
        }
        return true
      }
    }
  }

  /**
   * Resolve once step [index]'s precondition holds.
   *
   * Polled rather than pushed, because the appliance has no channel for "this Cypher became true"
   * — and the interval is deliberately slack: each poll is a query run as the user, and a step
   * somebody has walked away from could be outstanding for minutes.
   */
  private async watchFor(index: number): Promise<void> {
    let every = WATCH_MS
    while (this.is('running', 'pausing', 'paused')) {
      await new Promise((resolve) => setTimeout(resolve, every))
      if (!this.is('running', 'pausing', 'paused')) return
      const status = await this.host.stepStatus(index, this.params).catch(() => 'UNKNOWN' as const)
      if (status === 'DONE') return
      every = Math.min(Math.round(every * 1.4), WATCH_MAX_MS)
    }
  }

  private transition(state: TourRunState): void {
    this.runState = state
    this.onProgress?.(this.progress())
  }

  private progress(error?: string): TourProgress {
    const progress: TourProgress = {
      state: this.runState,
      index: this.cursor,
      total: this.tour.steps.length,
      step: this.tour.steps[this.cursor],
      skipped: this.skipped,
    }
    if (error) progress.error = error
    this.onProgress?.(progress)
    return progress
  }
}
