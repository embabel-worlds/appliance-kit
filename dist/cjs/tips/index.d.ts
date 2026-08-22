import type { Hint, HintsClient, HintSurface } from '../client/hints.ts';
export interface TipRotationOptions {
    /** Structurally just `random` — the console hands the kit's HintsClient, the Me app hands a
     *  wrapper over its preload bridge (its renderer cannot make HTTP calls; main does). */
    hints: Pick<HintsClient, 'random'>;
    surface: HintSurface;
    /** Where the seen-set persists; defaults to localStorage, falls back to memory (private windows). */
    storage?: Pick<Storage, 'getItem' | 'setItem'>;
}
/**
 * Hands out tips, avoiding repeats until the pool is exhausted, remembering across visits.
 * All server-side randomness: `next()` is one `/hints/random` call with the seen ids excluded.
 */
export declare class TipRotation {
    private readonly options;
    private readonly storage;
    constructor(options: TipRotationOptions);
    private seen;
    private markSeen;
    /** The next tip, or undefined when the appliance has none (or the call failed — a tip is
     *  never worth an error surface). */
    next(): Promise<Hint | undefined>;
}
export interface TipCardOptions {
    /** Land the tip's `action.chatInput` in the host's input box. No callback = no action button. */
    onAction?: (chatInput: string) => void;
    /** Called when the user asks for another tip. No callback = no next button. */
    onNext?: () => void;
    /** Called when the user dismisses the card. No callback = no dismiss button. */
    onDismiss?: () => void;
    /** Markdown-to-SAFE-html for the body. Absent, the body is painted as text — safe by construction. */
    renderBody?: (markdown: string) => string;
}
/**
 * One tip as a DOM element, kit-styled (`css/tips.css`). The body goes through
 * [TipCardOptions.renderBody] when the host provides one — the host owns sanitization,
 * exactly as it does for every other model-authored or realm-authored string it paints.
 */
export declare function renderTipCard(hint: Hint, options?: TipCardOptions): HTMLElement;
//# sourceMappingURL=index.d.ts.map