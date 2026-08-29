/** What a step does. One verb per step; the key that is present decides. */
export type TourVerb = 
/** Narrate. The half of a tour that teaches; markdown, rendered by the host. */
'say'
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
 | 'expect';
export declare const TOUR_VERBS: readonly TourVerb[];
/**
 * Who performs a step.
 *
 * `user` is the walkthrough half, and it is what separates a lesson from a macro: the tour points,
 * explains, and WAITS while the person does it themselves. A tour that only ever performs is a
 * demo the user watched.
 */
export type TourActor = 'tour' | 'user';
/**
 * A target is `kind.name` — `panel.documents`, `field.domain`, `button.populate`,
 * `view.EsgCoverage`, `state.ingest.idle`.
 *
 * The kind is what a dictionary is indexed by, so an unknown target is detectable without knowing
 * anything about the surface. Names may contain dots (`ingest.idle`); the FIRST segment is the kind.
 */
export interface TourTarget {
    kind: string;
    name: string;
    /** As written, for messages — reconstructing it from the parts loses nothing but reads worse. */
    text: string;
}
export interface TourStep {
    verb: TourVerb;
    /** Absent for `say` and `ask`, which name no widget. */
    target?: TourTarget;
    by: TourActor;
    /** `ask`: the parameter being collected. `set`: the value to put in the field. */
    value?: string;
    /** `run`: parameters for the view or verb, values possibly containing `{{ param }}`. */
    params?: Record<string, string>;
    /** Narration attached to any step, shown as it runs. */
    say?: string;
    /** What to tell the user when the step is theirs to do. */
    hint?: string;
    /** Shown while a `wait` is outstanding, so a slow step narrates itself instead of hanging mute. */
    meanwhile?: string;
    /** `wait`: how long before giving up. */
    timeoutMs?: number;
    /** `expect`: what to say when the assertion does not hold. */
    otherwise?: string;
    /** The question the step asks, for `ask`. */
    question?: string;
    /** Everything the file declared, for a host that wants a field this kit has not heard of. */
    raw: Readonly<Record<string, unknown>>;
}
export interface Tour {
    id: string;
    declaredId: string;
    /** Imported or recorded by this user, rather than shipped by a realm or the world. */
    userSaved: boolean;
    /**
     * The appliance can REMOVE it — narrower than [userSaved], and the distinction a UI must respect.
     *
     * A tour hand-written into a user's own config is theirs, but the server did not write that file
     * and will not rewrite it, so a Delete button for it would do nothing at all. Offer Delete on
     * this, never on ownership.
     */
    deletable: boolean;
    /**
     * The realm that shipped it, or undefined for a world's own and a user's own.
     *
     * Carried by the server rather than split out of the id, so a UI can group a realm's tours under
     * its name and offer them on that realm's own card — which is where somebody is standing at the
     * moment a tour matters most, just after installing it.
     */
    source?: string;
    name: string;
    description?: string;
    /** Parameters the tour collects before it starts, in declaration order. */
    params: TourParam[];
    steps: TourStep[];
    /** What the file said it needs, over and above what its steps imply. */
    requires: string[];
    raw: Readonly<Record<string, unknown>>;
}
export interface TourParam {
    name: string;
    question: string;
}
/** One tour as the wire delivers it: presentation maps the server carried through uninterpreted. */
export interface WireTour {
    id: string;
    declaredId: string;
    userSaved: boolean;
    deletable?: boolean;
    source?: string;
    presentation: Record<string, unknown>;
    steps: {
        presentation: Record<string, unknown>;
    }[];
}
export declare class TourFormatError extends Error {
}
/** `10m`, `90s`, `500ms`, or a bare number of milliseconds. */
export declare function parseDuration(raw: unknown): number | undefined;
export declare function parseTarget(text: string): TourTarget;
/**
 * One step, from the map its file declared.
 *
 * A step with no verb this kit knows is an ERROR rather than a no-op. The alternative — skipping
 * quietly — turns a typo into a tour that runs to the end having done less than it said, which is
 * the failure mode hardest to notice and worst to debug.
 */
export declare function parseStep(presentation: Record<string, unknown>): TourStep;
/** A tour from the wire. Throws [TourFormatError] on a step this kit cannot read. */
export declare function parseTour(wire: WireTour): Tour;
//# sourceMappingURL=tour.d.ts.map