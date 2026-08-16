/**
 * Namespaces the ENGINE owns. They appear as `$name` in a query and are never
 * the user's to supply — offering a control for `$userId` would invite someone
 * to set it, which is a scoping question, not a form field.
 */
export declare const RESERVED_PARAMS: readonly ["ai", "realm", "userId", "anchors", "exclude", "want", "hint"];
/**
 * The bind variables a query declares, in first-seen order and deduped.
 *
 * Deliberately a regex over the whole text: `$` inside a string literal would be
 * a false positive, but a view whose literal contains `$word` is vanishingly
 * rare next to the cost of carrying a Cypher parser to rule it out.
 */
export declare function declaredParams(cypher: string): string[];
//# sourceMappingURL=params.d.ts.map