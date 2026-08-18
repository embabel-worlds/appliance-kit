/*
 * READING A LOG, as policy rather than as two implementations.
 *
 * The Me app's log window and the Worlds console's Logs tab show different SOURCES — Me follows
 * `docker logs -f` for any container in the compose project, the console reads this appliance's own
 * recent lines over REST — but they are looking at the same thing, and they should agree about what
 * an ERROR looks like, how many lines are worth keeping, and what "paused" means. That agreement is
 * here; the transports and the elements stay in each app.
 *
 * Pure: no DOM, no fetch, no framework.
 */
/**
 * A line's severity from its TEXT, for a source that hands over formatted lines and nothing else
 * (`docker logs`). A structured source should use its own level and never come through here —
 * see [severityOfLevel].
 *
 * Word boundaries matter: a message mentioning "no errors" must not paint itself red, and this is
 * the difference between colour that means something and colour that becomes wallpaper.
 */
export function severityOfLine(line) {
    if (/\b(ERROR|FATAL|SEVERE)\b/.test(line))
        return 'error';
    if (/\bWARN(ING)?\b/.test(line))
        return 'warn';
    return '';
}
/** A line's severity from a structured level (`WARN`, `ERROR`, …) — no guessing required. */
export function severityOfLevel(level) {
    const upper = (level ?? '').toUpperCase();
    if (upper === 'ERROR' || upper === 'FATAL' || upper === 'SEVERE')
        return 'error';
    if (upper === 'WARN' || upper === 'WARNING')
        return 'warn';
    return '';
}
/**
 * HOW MANY LINES A VIEW KEEPS.
 *
 * The DOM is not an archive — the log itself is. A chatty container emits megabytes nobody scrolls
 * back through, and an unbounded view takes the window down with it. This is the number both
 * surfaces cap at, so "it stopped showing me things" happens at one place rather than two.
 */
export const MAX_LOG_LINES = 5000;
/** Case-insensitive substring match, the whole filter contract. An empty needle matches everything. */
export function matchesFilter(line, needle) {
    const trimmed = needle.trim().toLowerCase();
    return !trimmed || line.toLowerCase().includes(trimmed);
}
/**
 * Should the view chase the newest line?
 *
 * ONLY when it was already at the bottom. Someone who has scrolled up is reading something, and
 * yanking them back to the tail every time a line arrives makes a busy log unreadable. The 40px
 * tolerance is for sub-pixel scroll positions, which never land exactly on the end.
 */
export function isAtBottom(view) {
    return view.scrollHeight - view.scrollTop - view.clientHeight < 40;
}
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
export function pendingBehind(total, shownUpTo) {
    return Math.max(0, total - shownUpTo);
}
//# sourceMappingURL=logs.js.map