/*
 * THE MARKDOWN POLICY, ONCE — what an assistant's prose is allowed to become.
 *
 * The appliance writes markdown whether or not a surface renders it, so painting the answer as raw
 * text is a choice to show people `**bold**` and `- item`. Both front ends make the other choice,
 * and until now each held its own reading of what that means. This is that reading, stated once.
 *
 * WHAT IS SHARED IS THE POLICY, NOT THE LIBRARIES. `marked` parses and `DOMPurify` sanitizes, and
 * both arrive INJECTED rather than imported — the Me app loads them as vendored browser globals
 * (its renderer has no module system), the console as npm packages. Importing them here would force
 * one of those choices on the other and put a second copy of each on the page.
 *
 * THE POLICY IS THREE RULES:
 *
 *   1. Nothing executable survives. DOMPurify is the boundary, NOT the parser — text from a model,
 *      or from a document a model quoted, is untrusted, and marked will pass raw HTML through
 *      quite happily if allowed to. Never build this markup by concatenation.
 *   2. Only what written prose needs: no forms, no media, no ids, no styles. And only http(s)
 *      links, so a `javascript:` href never reaches an anchor in the first place.
 *   3. Links leave. Where they go is the surface's business — Electron must not navigate its own
 *      window, a browser tab wants `target="_blank"` — so each applies its own step afterwards.
 */
/** marked's options. `breaks` because chat and answers use a single newline to mean one. */
export const MARKDOWN_OPTIONS = {
    gfm: true,
    breaks: true,
};
/**
 * DOMPurify's allow-list. Deliberately narrow, and deliberately not configurable per surface: a
 * tag one front end permits and the other strips is the same answer rendering two ways.
 *
 * No `target`/`rel` here because no anchor is trusted to carry them — each surface rewires links
 * after sanitizing, from the href that survived.
 */
export const MARKDOWN_SANITIZE = {
    ALLOWED_TAGS: [
        'p', 'br', 'hr', 'strong', 'em', 'del', 'code', 'pre', 'blockquote',
        'ul', 'ol', 'li', 'a', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
        'table', 'thead', 'tbody', 'tr', 'th', 'td',
    ],
    ALLOWED_ATTR: ['href', 'title', 'start'],
    ALLOWED_URI_REGEXP: /^https?:\/\//i,
};
/**
 * Markdown in, sanitized HTML string out.
 *
 * A STRING, not a fragment, because that is the shape both surfaces can use: the console hands it
 * to React, and a caller wanting nodes parses it once more itself. The output has already been
 * through DOMPurify under the config above — that is what makes it safe to insert, and the only
 * thing that does.
 *
 * A null or undefined input renders as empty rather than as the word "undefined", which is what
 * `String(x)` would have given a surface that forgot to check.
 */
export function toSafeHtml(libs, text) {
    if (text == null || text === '')
        return '';
    const parsed = libs.parse(String(text), MARKDOWN_OPTIONS);
    return String(libs.sanitize(parsed, { ...MARKDOWN_SANITIZE, RETURN_DOM_FRAGMENT: false }));
}
//# sourceMappingURL=markdown.js.map