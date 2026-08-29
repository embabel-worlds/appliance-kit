"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOUR_SANITIZE = exports.MARKDOWN_SANITIZE = exports.MARKDOWN_OPTIONS = void 0;
exports.toSafeHtml = toSafeHtml;
exports.resolveTourImages = resolveTourImages;
exports.tourHtml = tourHtml;
/** marked's options. `breaks` because chat and answers use a single newline to mean one. */
exports.MARKDOWN_OPTIONS = {
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
exports.MARKDOWN_SANITIZE = {
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
function toSafeHtml(libs, text) {
    if (text == null || text === '')
        return '';
    const parsed = libs.parse(String(text), exports.MARKDOWN_OPTIONS);
    return String(libs.sanitize(parsed, { ...exports.MARKDOWN_SANITIZE, RETURN_DOM_FRAGMENT: false }));
}
/**
 * The same policy, plus IMAGES — for tour narration only.
 *
 * A tour sometimes explains something that happens outside the app, and a picture of the terminal
 * you are about to open carries further than a paragraph describing it. Nothing else here wants
 * images: a document answer that could render one would be a model deciding to put a picture in
 * front of you, which is a different feature with a different conversation attached.
 */
exports.TOUR_SANITIZE = {
    ...exports.MARKDOWN_SANITIZE,
    ALLOWED_TAGS: [...exports.MARKDOWN_SANITIZE.ALLOWED_TAGS, 'img'],
    ALLOWED_ATTR: [...exports.MARKDOWN_SANITIZE.ALLOWED_ATTR, 'src', 'alt'],
    /*
     * ROOTED RELATIVE URIS, as well as http(s). The shared policy allows `^https?://` and nothing
     * else, which is right for prose full of links — and it silently defeated the first version of
     * this: `/apps/world/x.svg` failed the pattern, DOMPurify dropped the `src`, and an image the
     * appliance was serving perfectly well vanished along with the beacons.
     *
     * `\/(?!\/)` is one slash and not two, so `//evil.example/x.png` is still refused here rather
     * than only by the pass below. This does NOT weaken the image rule — it is what lets the image
     * rule be the thing that decides, instead of a regexp that cannot tell an `<img>` from an `<a>`.
     */
    ALLOWED_URI_REGEXP: /^(?:https?:\/\/|\/(?!\/))/i,
};
/**
 * Point every tour image at [assetBase] and DELETE the ones that were not ours to serve.
 *
 * THIS IS THE ANTI-BEACON RULE, and it is why tours get their own policy rather than a widened
 * shared one. Tours are FILES PEOPLE EXCHANGE — a realm ships them, users export and import them.
 * An `<img>` pointing at a host somebody else controls reports that a tour was opened, when, and
 * from which address, to whoever wrote it, silently, before the reader agreed to anything. So a
 * tour may show an asset THIS APPLIANCE serves and nothing else.
 *
 * DOMPurify cannot express it — `ALLOWED_URI_REGEXP` applies to every URI attribute alike, and
 * links legitimately go anywhere — so the rule is enforced here, after sanitizing, and fails
 * closed: anything that is not a rooted relative path is removed rather than rewritten.
 *
 * [assetBase] exists because the two surfaces disagree about what "same origin" resolves to. The
 * console is served by the appliance, so '' is right. The Me app's windows load over `file://`,
 * where `/apps/world/x.png` is a path on the user's disk — it passes the appliance's base URL.
 */
function resolveTourImages(root, assetBase = '') {
    for (const img of Array.from(root.querySelectorAll('img'))) {
        const src = img.getAttribute('src') ?? '';
        // Rooted and single-slashed: `//host/x.png` is a remote host wearing a relative path.
        if (!src.startsWith('/') || src.startsWith('//'))
            img.remove();
        else
            img.setAttribute('src', assetBase.replace(/\/$/, '') + src);
    }
}
/**
 * Tour narration: markdown in, sanitized HTML out, with same-origin images kept.
 *
 * The string form, for the console. A surface that needs nodes — the Me app, which rewires links
 * for Electron — uses [TOUR_SANITIZE] and [resolveTourImages] directly, so both run one policy.
 */
function tourHtml(libs, text, assetBase = '') {
    if (text == null || text === '')
        return '';
    const parsed = libs.parse(String(text), exports.MARKDOWN_OPTIONS);
    const html = String(libs.sanitize(parsed, { ...exports.TOUR_SANITIZE, RETURN_DOM_FRAGMENT: false }));
    if (typeof document === 'undefined' || !html.includes('<img'))
        return html;
    const holder = document.createElement('div');
    holder.innerHTML = html;
    resolveTourImages(holder, assetBase);
    return holder.innerHTML;
}
//# sourceMappingURL=markdown.js.map