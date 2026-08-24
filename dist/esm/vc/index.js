/*
 * @embabel/vc — the virtual-Cypher semantics, once.
 *
 * Lifted out of me-app's Query Studio, where it was entangled with the DOM
 * controls that rendered it. Pure functions: no DOM, no transport, no framework,
 * so the Worlds console, the Electron app and a test can all use the same
 * understanding of what the engine offers.
 */
export { TARGETS, VIA_VALUES, AI_KEYS, esc } from "./targets.js";
export { compose, TIPS } from "./compose.js";
export { aliasMap, propertiesOf, labelNames, anchorLabels, relationshipTypes, relationshipTypesFor, connectedLabels, edgeContext, nodeContext, propertyMapContext } from "./schema.js";
export { declaredParams, RESERVED_PARAMS } from "./params.js";
export { rowColumns, rowsToMarkdown, rowsToCsv } from "./rows.js";
export { describeVcEvent, isTerminal, isFailure } from "./events.js";
export { SCOPE_NAME, scopeLabel, scopeReference, referencedScopeNames } from "./scopes.js";
//# sourceMappingURL=index.js.map