import type { Tour, TourStep, TourTarget } from './tour.ts';
export type TourStepStatus = 'DONE' | 'TODO' | 'UNKNOWN';
/**
 * What a surface must be able to do for a tour to run on it.
 *
 * Every method takes the step, because a host will want its narration and its hint, and threading
 * them through as separate arguments means changing this interface every time the vocabulary grows
 * a modifier.
 */
export interface TourHost {
    /** Go to a panel, tab or page. */
    open(target: TourTarget, step: TourStep): Promise<void> | void;
    /** Put [value] in a field. */
    set(target: TourTarget, value: string, step: TourStep): Promise<void> | void;
    /** Press a control. */
    invoke(target: TourTarget, step: TourStep): Promise<void> | void;
    /** Run a saved view or verb. */
    run(target: TourTarget, params: Record<string, string>, step: TourStep): Promise<void> | void;
    /** Block until a named state holds. False on timeout — NOT an exception; see `runTour`. */
    waitFor(target: TourTarget, timeoutMs: number | undefined, step: TourStep): Promise<boolean>;
    /** Does a named state hold right now? For `expect`. */
    check(target: TourTarget, step: TourStep): Promise<boolean>;
    /**
     * Narrate. Markdown; the host owns sanitizing, as it does for every other authored string.
     *
     * MAY RETURN A PROMISE, and a host that shows one caption at a time SHOULD. Narration that
     * returns instantly is narration the next step overwrites before anyone has read it: the tour
     * appears to jump from the first caption to the last, which reads as a bug and leaves the user
     * with no idea what happened. A host that holds until the words have been read — or until the
     * user asks for the next one — is what makes a tour legible rather than a flicker.
     */
    say(markdown: string, step: TourStep | undefined): void | Promise<void>;
    /** Collect a parameter. `undefined` means the user declined, which ends the tour. */
    ask(name: string, question: string): Promise<string | undefined>;
    /**
     * Hand the step to the user and wait. Resolves `true` when they did it, `false` when they asked
     * to skip. This is the walkthrough half — the tour points and waits rather than performing.
     */
    handOver(step: TourStep): Promise<boolean>;
    /**
     * Ask the appliance whether step [index] is already satisfied, given what the tour has collected
     * so far.
     *
     * The parameters matter more than they look: the precondition worth writing is usually ABOUT the
     * thing the user just named — "have we already extracted this domain?" — and without them the
     * only expressible conditions are those that depend on no answer, which excludes every expensive
     * step a tour most wants to skip.
     */
    stepStatus(index: number, params: Record<string, string>): Promise<TourStepStatus>;
}
export type TourRunState = 'idle' | 'running' | 'pausing' | 'paused' | 'done' | 'stopped' | 'failed';
export interface TourProgress {
    state: TourRunState;
    /** The step about to run, or the one that just failed. */
    index: number;
    total: number;
    step?: TourStep;
    /** Why, when the state is `failed`. */
    error?: string;
    /** Steps skipped because their precondition already held. */
    skipped: number;
}
export interface TourRunOptions {
    host: TourHost;
    /** Called on every state change, for a UI that renders progress. */
    onProgress?: (progress: TourProgress) => void;
    /** Start partway in — resuming where somebody left off. */
    from?: number;
    /** Parameters already known, so a resumed tour does not re-ask. */
    params?: Record<string, string>;
}
/** `{{ name }}` — the only interpolation there is. */
export declare function interpolate(text: string, params: Record<string, string>): string;
/**
 * One run of one tour.
 *
 * Not an event emitter and not a framework: a class with three controls and a promise. The console
 * wraps it in React state, the Me app calls it from a click handler, and neither has to adopt the
 * other's idea of how a UI updates.
 */
export declare class TourRun {
    readonly tour: Tour;
    private runState;
    private cursor;
    private skipped;
    private readonly host;
    private readonly onProgress?;
    private readonly params;
    private resumeGate?;
    /** Set by [back]; consumed at the next step boundary. */
    private rewind;
    /** Indices the user asked to see again, which run whatever their precondition says. */
    private readonly forced;
    /**
     * Lets [back] interrupt a host that is holding — a caption waiting on Next, say. Without it,
     * pressing Back during a hold does nothing until the hold ends, which reads as a dead button.
     */
    skipHold?: () => void;
    constructor(tour: Tour, options: TourRunOptions);
    get state(): TourRunState;
    /** Read through a predicate rather than comparing the field: the loop below reads it either
     *  side of an `await`, and narrowing does not survive one. */
    private is;
    /** Where the tour got to — what a host persists so "continue where I left off" is possible. */
    get index(): number;
    get collected(): Readonly<Record<string, string>>;
    /**
     * Go back a step.
     *
     * Honoured at the next boundary, like pause, and the step it returns to is RUN AGAIN even if its
     * precondition says it is already done — somebody pressing Back is asking to see it, and a
     * `doneWhen` that skipped them straight forward again would make the button look broken. That
     * exemption is the only place a precondition is ignored, and it is the one place a human has
     * overruled it on purpose.
     */
    back(): void;
    /** Honoured at the next step boundary. */
    pause(): void;
    resume(): void;
    /**
     * Leave, for good.
     *
     * Nothing is unwound. A tour makes real changes to a real world — documents were fetched, a view
     * was run — and pretending otherwise by rolling back would be both impossible and a lie. Stopping
     * means the walking stops; what the world learned on the way is the user's to keep.
     */
    stop(): void;
    /** Run to the end, or until stopped. Resolves with the final progress rather than throwing. */
    start(): Promise<TourProgress>;
    /** False means the tour should stop here — an unmet `expect`, or a user who declined. */
    private perform;
    /**
     * Resolve once step [index]'s precondition holds.
     *
     * Polled rather than pushed, because the appliance has no channel for "this Cypher became true"
     * — and the interval is deliberately slack: each poll is a query run as the user, and a step
     * somebody has walked away from could be outstanding for minutes.
     */
    private watchFor;
    private transition;
    private progress;
}
//# sourceMappingURL=runner.d.ts.map