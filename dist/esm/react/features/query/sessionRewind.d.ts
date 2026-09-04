/**
 * What the auto-name counter should be, given the bindings that SURVIVE a back-out.
 *
 * The highest surviving number, not the count. Those differ whenever a single-row ✕ has left a
 * hole — surviving `_1` and `_3` is two bindings, and handing the next capture `_3` would take a
 * name that is still in use.
 */
export declare function rewoundCounter(survivingNames: string[]): number;
//# sourceMappingURL=sessionRewind.d.ts.map