/*
 * @embabel/studio-kit — the studios' shared EDITOR BEHAVIOR, once.
 *
 * The third layer of the client stack: @embabel/vc and @embabel/code-surface
 * are semantics (no DOM, no transport); this is behavior (DOM, still no
 * transport, no framework); each surface keeps only its own wiring — elements,
 * panels, and however it talks to the appliance. Semantics arrive INJECTED so
 * a page loads exactly one copy of each.
 */
export { formatDuration } from "./format.js";
export { setStatus } from "./status.js";
export { copyWithNod } from "./copy.js";
export { createDefinitionTooltip, definitionTitle } from "./tooltip.js";
export { MARKDOWN_OPTIONS, MARKDOWN_SANITIZE, toSafeHtml } from "./markdown.js";
export { MAX_LOG_LINES, isAtBottom, matchesFilter, pendingBehind, severityOfLevel, severityOfLine } from "./logs.js";
export { createCypherHint, cypherFragmentCompletions } from "./hints.js";
//# sourceMappingURL=index.js.map