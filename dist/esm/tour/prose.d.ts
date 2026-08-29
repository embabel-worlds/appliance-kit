import type { Tour } from './tour.ts';
import type { TourDictionary } from './dictionary.ts';
export interface TourSynopsis {
    title: string;
    /** The tour's own prose, when it declared any. Kept apart from [facts] because it is the only
     *  line an author wrote — everything else is derived, and a card that runs them together as one
     *  block reads as a dump rather than as a claim followed by its evidence. */
    description?: string;
    /** What it will do, one derived statement each, in the order they would happen. */
    facts: string[];
    /** [description] and [facts] as one list — the plain-text rendering, for hosts that want it. */
    lines: string[];
    /** Set when this surface cannot run it — see `refusal`. */
    blocked?: string;
}
/**
 * A tour reduced to what a cautious person needs before consenting: what it will ask them, where it
 * will take them, what it will type, what it will run, and what it will never do.
 */
export declare function describe(tour: Tour, dictionary?: TourDictionary): TourSynopsis;
//# sourceMappingURL=prose.d.ts.map