import type { TourActor, TourVerb } from './tour.ts';
export interface RecordedAction {
    verb: Extract<TourVerb, 'open' | 'set' | 'invoke' | 'run' | 'say'>;
    /** `panel.documents`, `field.domain` … absent for `say`. */
    target?: string;
    /** The value typed, for `set`; the narration, for `say`. */
    value?: string;
    params?: Record<string, string>;
    /** Recorded as the user's own step, so the draft hands it back to them rather than performing it. */
    by?: TourActor;
}
export interface TourDraftMeta {
    id: string;
    name: string;
    description?: string;
}
/**
 * Collects what a user did and hands back the skeleton of a tour.
 *
 * Coalescing is deliberate and minimal: typing into a field emits one action per keystroke in most
 * UIs, and a tour with forty `set` steps for one field is not a draft anybody would edit. Anything
 * cleverer than "the last value wins" would be guessing at intent.
 */
export declare class TourRecorder {
    private readonly recorded;
    observe(action: RecordedAction): void;
    /** Narration the author typed while recording — the one thing worth capturing that is not a click. */
    narrate(markdown: string): void;
    undo(): void;
    get actions(): readonly RecordedAction[];
    /** The draft as the object a tour file holds. */
    draft(meta: TourDraftMeta): Record<string, unknown>;
    /** The draft as the FILE — importable as it stands, and readable enough to edit. */
    toYaml(meta: TourDraftMeta): string;
}
//# sourceMappingURL=record.d.ts.map