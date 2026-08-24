"use strict";
/**
 * Captured-scope reference semantics — the REPL binding grammar, mirrored from the appliance so
 * every front end spells a reference the same way. A captured scope is referenced as a
 * BACKTICK-QUOTED label whose name starts with `$`: `MATCH (b:` + '`$overdue`' + `) …`. The
 * backticks keep the reference inside Cypher's real grammar; the `$` prefix keeps the namespace
 * disjoint from labels and views. Capture happens on execute (`ExecuteOptions.captureAs`);
 * this module only spells and finds references.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SCOPE_NAME = void 0;
exports.scopeLabel = scopeLabel;
exports.scopeReference = scopeReference;
exports.referencedScopeNames = referencedScopeNames;
/** A scope name is a plain identifier — same rule the appliance enforces on `captureAs`. */
exports.SCOPE_NAME = /^[A-Za-z_][A-Za-z0-9_]*$/;
const ANY_REF = /`\$([A-Za-z_]\w*)`/g;
/** The backtick-quoted label form of a scope reference: `` `$name` ``. */
function scopeLabel(name) {
    return '`$' + name + '`';
}
/** A full MATCH-position reference — `(alias:` + backtick + `$name` + backtick + `)`. */
function scopeReference(name, alias = 'x') {
    return `(${alias}:${scopeLabel(name)})`;
}
/** Every scope name referenced in a statement, first-appearance order, deduplicated. */
function referencedScopeNames(cypher) {
    const names = [];
    for (const m of cypher.matchAll(ANY_REF)) {
        const name = m[1];
        if (name !== undefined && !names.includes(name))
            names.push(name);
    }
    return names;
}
//# sourceMappingURL=scopes.js.map