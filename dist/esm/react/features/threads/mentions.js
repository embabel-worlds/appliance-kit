/*
 * THE @MENTION TOKEN: finding it, and replacing it.
 *
 * Pure, and separate from the menu, because the fiddly part is not the list — it is knowing when
 * the caret is inside a mention and what to put back when one is chosen. Both are decided by the
 * text and the caret alone, so both are testable without a DOM.
 *
 * A mention is being typed when the text immediately before the caret is an `@` followed by name
 * characters and nothing else: `@ste|` is one, `@steward is|` is not, and `a@b` is not either —
 * an `@` mid-word is an email address or a handle, not the start of a name.
 */
/** A name as the host writes it: letters, digits, dashes and underscores. */
const MENTION = /(^|[\s(])@([A-Za-z0-9_-]*)$/;
/** The mention being typed at [caret], or null when the caret is not in one. */
export function activeMention(text, caret) {
    const before = text.slice(0, caret);
    const found = MENTION.exec(before);
    if (!found)
        return null;
    const query = found[2] ?? '';
    return { query, at: caret - query.length - 1 };
}
/**
 * [text] with the mention at [caret] replaced by [name].
 *
 * A trailing space is part of the replacement: the next thing a person types is a word, not more
 * of the name, and without it the menu reopens on the name just chosen.
 */
export function applyMention(text, caret, name) {
    const active = activeMention(text, caret);
    if (!active)
        return { text, caret };
    const head = `${text.slice(0, active.at)}@${name} `;
    return { text: head + text.slice(caret), caret: head.length };
}
/**
 * The names worth offering for [query], best first.
 *
 * A prefix match comes before a match inside the name, so typing `st` offers `steward` before
 * `chess-coach`'s `t`... and an exact prefix is never buried under a longer name that merely
 * contains the letters. Case is ignored: nobody types a capital after an `@`.
 */
export function matching(agents, query) {
    const q = query.toLowerCase();
    if (!q)
        return [...agents];
    const starts = agents.filter((a) => a.name.toLowerCase().startsWith(q));
    const contains = agents.filter((a) => !a.name.toLowerCase().startsWith(q) && a.name.toLowerCase().includes(q));
    return [...starts, ...contains];
}
//# sourceMappingURL=mentions.js.map