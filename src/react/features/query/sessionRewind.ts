/*
 * BACKING OUT A ROW — the arithmetic, away from the component so it can be tested.
 *
 * A session's captures are auto-named `_1`, `_2`, …, and backing out to a row has to put that
 * counter back or the next capture is named as though the abandoned rows still existed. Winding
 * it back too far is worse than not winding it at all: a name that is already taken collides with
 * a live scope, and the collision is server-side where it is expensive to notice.
 */

/** Names that carry a number the session allocated. A pinned `$name` was chosen, not counted. */
const AUTO_NAME = /^_(\d+)$/

/**
 * What the auto-name counter should be, given the bindings that SURVIVE a back-out.
 *
 * The highest surviving number, not the count. Those differ whenever a single-row ✕ has left a
 * hole — surviving `_1` and `_3` is two bindings, and handing the next capture `_3` would take a
 * name that is still in use.
 */
export function rewoundCounter(survivingNames: string[]): number {
  return survivingNames.reduce((highest, name) => {
    const auto = AUTO_NAME.exec(name)
    return auto ? Math.max(highest, Number(auto[1])) : highest
  }, 0)
}
