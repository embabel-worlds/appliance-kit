import type { Tour, TourTarget } from './tour.ts';
export interface TourPanelEntry {
    /** Fields a tour may `set` while this panel is open. */
    fields?: string[];
    /** Controls a tour may `invoke` while this panel is open. */
    controls?: string[];
}
export interface TourDictionary {
    /** Which surface this is — `me`, `console`, or whatever a future front end calls itself. */
    surface: string;
    /** Bumped when a KIND is added or removed, never for adding names. */
    version: number;
    panels: Record<string, TourPanelEntry>;
    /** Named conditions a tour may `wait` for or `expect` — `ingest.idle`, `connection.ok`. */
    states?: string[];
    /**
     * Kinds whose names come from the world rather than from the layout, and so cannot be checked
     * before the tour starts. `view` and `verb` are the two that exist today.
     */
    dynamic?: string[];
}
export type TourSupport = 
/** The surface declares it. */
'declared'
/** A kind this surface handles, with a name only the world can confirm — checked when reached. */
 | 'deferred'
/** Not in this dictionary. */
 | 'missing';
/** Does [dictionary] declare [target]? */
export declare function supports(dictionary: TourDictionary, target: TourTarget): TourSupport;
export interface TourFitness {
    /** Nothing is missing — the tour may run here. `deferred` targets do not count against it. */
    ok: boolean;
    /** Targets this surface does not have, in the order the tour would reach them. */
    missing: TourTarget[];
    /** Targets whose names only the world can confirm, checked as the tour runs. */
    deferred: TourTarget[];
}
/**
 * Can this surface run this tour?
 *
 * CHECKED FROM THE STEPS, not only from the file's `requires:`. An author who forgets to declare a
 * requirement should not thereby get a tour that dies halfway — the steps are the truth, and
 * `requires:` is an extra assertion layered on top for things a tour needs but does not visibly
 * touch. This is the whole reason a tour can be refused WHOLE rather than abandoned in the middle,
 * which is the difference between "your console cannot run this" and a user stranded at step four.
 */
export declare function fitness(tour: Tour, dictionary: TourDictionary): TourFitness;
/** The refusal, in a sentence a user can act on. Empty when the tour fits. */
export declare function refusal(tour: Tour, dictionary: TourDictionary): string;
//# sourceMappingURL=dictionary.d.ts.map