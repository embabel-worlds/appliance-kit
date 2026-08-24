/**
 * Captured-scope reference semantics — the REPL binding grammar, mirrored from the appliance so
 * every front end spells a reference the same way. A captured scope is referenced as a
 * BACKTICK-QUOTED label whose name starts with `$`: `MATCH (b:` + '`$overdue`' + `) …`. The
 * backticks keep the reference inside Cypher's real grammar; the `$` prefix keeps the namespace
 * disjoint from labels and views. Capture happens on execute (`ExecuteOptions.captureAs`);
 * this module only spells and finds references.
 */
/** A scope name is a plain identifier — same rule the appliance enforces on `captureAs`. */
export declare const SCOPE_NAME: RegExp;
/** The backtick-quoted label form of a scope reference: `` `$name` ``. */
export declare function scopeLabel(name: string): string;
/** A full MATCH-position reference — `(alias:` + backtick + `$name` + backtick + `)`. */
export declare function scopeReference(name: string, alias?: string): string;
/** Every scope name referenced in a statement, first-appearance order, deduplicated. */
export declare function referencedScopeNames(cypher: string): string[];
//# sourceMappingURL=scopes.d.ts.map