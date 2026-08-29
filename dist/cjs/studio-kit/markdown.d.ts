/** marked's options. `breaks` because chat and answers use a single newline to mean one. */
export declare const MARKDOWN_OPTIONS: {
    readonly gfm: true;
    readonly breaks: true;
};
/**
 * DOMPurify's allow-list. Deliberately narrow, and deliberately not configurable per surface: a
 * tag one front end permits and the other strips is the same answer rendering two ways.
 *
 * No `target`/`rel` here because no anchor is trusted to carry them — each surface rewires links
 * after sanitizing, from the href that survived.
 */
export declare const MARKDOWN_SANITIZE: {
    ALLOWED_TAGS: string[];
    ALLOWED_ATTR: string[];
    ALLOWED_URI_REGEXP: RegExp;
};
/** What a caller injects: their own `marked` and `DOMPurify`, however they were loaded. */
export interface MarkdownLibraries {
    parse(text: string, options: typeof MARKDOWN_OPTIONS): string;
    sanitize(html: string, config: unknown): unknown;
}
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
export declare function toSafeHtml(libs: MarkdownLibraries, text: string | null | undefined): string;
/**
 * The same policy, plus IMAGES — for tour narration only.
 *
 * A tour sometimes explains something that happens outside the app, and a picture of the terminal
 * you are about to open carries further than a paragraph describing it. Nothing else here wants
 * images: a document answer that could render one would be a model deciding to put a picture in
 * front of you, which is a different feature with a different conversation attached.
 */
export declare const TOUR_SANITIZE: {
    ALLOWED_TAGS: string[];
    ALLOWED_ATTR: string[];
    ALLOWED_URI_REGEXP: RegExp;
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
export declare function resolveTourImages(root: ParentNode, assetBase?: string): void;
/**
 * Tour narration: markdown in, sanitized HTML out, with same-origin images kept.
 *
 * The string form, for the console. A surface that needs nodes — the Me app, which rewires links
 * for Electron — uses [TOUR_SANITIZE] and [resolveTourImages] directly, so both run one policy.
 */
export declare function tourHtml(libs: MarkdownLibraries, text: string | null | undefined, assetBase?: string): string;
//# sourceMappingURL=markdown.d.ts.map