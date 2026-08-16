export declare function rowColumns(rows: Array<Record<string, unknown>>): string[];
/**
 * A GitHub-flavoured Markdown table. Pipes are escaped; newlines flatten to a
 * space — a Markdown cell has no way to hold one, and a broken row is worse
 * than a joined line.
 */
export declare function rowsToMarkdown(rows: Array<Record<string, unknown>>): string;
/** RFC 4180-shaped CSV: a field holding comma, quote or newline is quoted, quotes double. */
export declare function rowsToCsv(rows: Array<Record<string, unknown>>): string;
//# sourceMappingURL=rows.d.ts.map