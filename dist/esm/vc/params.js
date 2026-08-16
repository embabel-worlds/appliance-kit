/*
 * VIEW PARAMETERS.
 *
 * A saved view declares bind variables referenced as `$name` in its cypher. This
 * finds them, so a console can render one control per parameter without the user
 * writing a schema by hand.
 */
/**
 * Namespaces the ENGINE owns. They appear as `$name` in a query and are never
 * the user's to supply — offering a control for `$userId` would invite someone
 * to set it, which is a scoping question, not a form field.
 */
export const RESERVED_PARAMS = ['ai', 'realm', 'userId', 'anchors', 'exclude', 'want', 'hint'];
/**
 * The bind variables a query declares, in first-seen order and deduped.
 *
 * Deliberately a regex over the whole text: `$` inside a string literal would be
 * a false positive, but a view whose literal contains `$word` is vanishingly
 * rare next to the cost of carrying a Cypher parser to rule it out.
 */
export function declaredParams(cypher) {
    return [...new Set([...cypher.matchAll(/\$([A-Za-z_][A-Za-z0-9_]*)/g)].map((m) => m[1]))]
        .filter((p) => !RESERVED_PARAMS.includes(p));
}
//# sourceMappingURL=params.js.map