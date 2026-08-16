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
    readonly ALLOWED_TAGS: readonly ["p", "br", "hr", "strong", "em", "del", "code", "pre", "blockquote", "ul", "ol", "li", "a", "h1", "h2", "h3", "h4", "h5", "h6", "table", "thead", "tbody", "tr", "th", "td"];
    readonly ALLOWED_ATTR: readonly ["href", "title", "start"];
    readonly ALLOWED_URI_REGEXP: RegExp;
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
//# sourceMappingURL=markdown.d.ts.map