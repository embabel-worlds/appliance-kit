export interface ActiveMention {
    /** What has been typed after the `@`, possibly empty right after the `@` itself. */
    query: string;
    /** Index of the `@`, so a replacement knows what to cut. */
    at: number;
}
/** The mention being typed at [caret], or null when the caret is not in one. */
export declare function activeMention(text: string, caret: number): ActiveMention | null;
export interface Replacement {
    text: string;
    /** Where the caret belongs afterwards: past the name and the space that follows it. */
    caret: number;
}
/**
 * [text] with the mention at [caret] replaced by [name].
 *
 * A trailing space is part of the replacement: the next thing a person types is a word, not more
 * of the name, and without it the menu reopens on the name just chosen.
 */
export declare function applyMention(text: string, caret: number, name: string): Replacement;
/**
 * The names worth offering for [query], best first.
 *
 * A prefix match comes before a match inside the name, so typing `st` offers `steward` before
 * `chess-coach`'s `t`... and an exact prefix is never buried under a longer name that merely
 * contains the letters. Case is ignored: nobody types a capital after an `@`.
 */
export declare function matching<T extends {
    name: string;
}>(agents: readonly T[], query: string): T[];
//# sourceMappingURL=mentions.d.ts.map