/** What a line is, for colouring. The empty string is "ordinary" — no class, no noise. */
export type LogSeverity = 'error' | 'warn' | '';
/**
 * A line's severity from its TEXT, for a source that hands over formatted lines and nothing else
 * (`docker logs`). A structured source should use its own level and never come through here —
 * see [severityOfLevel].
 *
 * Word boundaries matter: a message mentioning "no errors" must not paint itself red, and this is
 * the difference between colour that means something and colour that becomes wallpaper.
 */
export declare function severityOfLine(line: string): LogSeverity;
/** A line's severity from a structured level (`WARN`, `ERROR`, …) — no guessing required. */
export declare function severityOfLevel(level: string | null | undefined): LogSeverity;
/**
 * HOW MANY LINES A VIEW KEEPS.
 *
 * The DOM is not an archive — the log itself is. A chatty container emits megabytes nobody scrolls
 * back through, and an unbounded view takes the window down with it. This is the number both
 * surfaces cap at, so "it stopped showing me things" happens at one place rather than two.
 */
export declare const MAX_LOG_LINES = 5000;
/** Case-insensitive substring match, the whole filter contract. An empty needle matches everything. */
export declare function matchesFilter(line: string, needle: string): boolean;
/**
 * Should the view chase the newest line?
 *
 * ONLY when it was already at the bottom. Someone who has scrolled up is reading something, and
 * yanking them back to the tail every time a line arrives makes a busy log unreadable. The 40px
 * tolerance is for sub-pixel scroll positions, which never land exactly on the end.
 */
export declare function isAtBottom(view: {
    scrollHeight: number;
    scrollTop: number;
    clientHeight: number;
}): boolean;
/**
 * WHAT PAUSED MEANS, and it is stronger than "stop scrolling".
 *
 * A paused view does not change AT ALL. A selection dies the moment its nodes are appended past or
 * trimmed away, so on a busy log freezing the DOM is the only way to get a stack trace onto the
 * clipboard — which is the reason anyone opens a log viewer in the first place. Lines keep
 * accumulating in the model; the view catches up on resume.
 *
 * Returns how far behind the frozen view has fallen, for a surface that wants to say so.
 */
export declare function pendingBehind(total: number, shownUpTo: number): number;
//# sourceMappingURL=logs.d.ts.map