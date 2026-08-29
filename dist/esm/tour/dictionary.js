/*
 * THE DICTIONARY — what a surface declares it understands, and the half that makes "any UI" true.
 *
 * AppleScript's real invention was not its English-like syntax; it was the `.sdef`: an app publishes
 * the vocabulary it can be spoken to in, and a script names only what it finds there. This is that,
 * for the appliance's front ends. The Me app publishes its panels, the console publishes its tabs,
 * and the SAME tour file either runs on both or is refused by one with a sentence naming exactly
 * what is missing.
 *
 * Names are per-surface, not per-panel. `set: field.domain` does not name the panel holding the
 * field, because `open: panel.documents` came before it and a tour that has to repeat the panel on
 * every line reads like machine output. The cost is that a surface must not use one field name for
 * two different things, which is a discipline it wants anyway.
 *
 * SOME KINDS ARE DATA, NOT LAYOUT. `view.EsgCoverage` cannot be declared here: views arrive with
 * realms and change while the app is running. Those kinds are listed in `dynamic` and checked when
 * the step runs rather than before the tour starts — the one place a tour can still fail late, and
 * it is the honest place for it.
 */
import { parseTarget } from "./tour.js";
/** Does [dictionary] declare [target]? */
export function supports(dictionary, target) {
    const { kind, name } = target;
    if (dictionary.dynamic?.includes(kind))
        return 'deferred';
    switch (kind) {
        case 'panel':
            return name in dictionary.panels ? 'declared' : 'missing';
        case 'field':
            return has(dictionary, (p) => p.fields, name);
        case 'button':
        case 'control':
            return has(dictionary, (p) => p.controls, name);
        case 'state':
            return dictionary.states?.includes(name) ? 'declared' : 'missing';
        default:
            return 'missing';
    }
}
const has = (dictionary, pick, name) => (Object.values(dictionary.panels).some((p) => pick(p)?.includes(name)) ? 'declared' : 'missing');
/**
 * Can this surface run this tour?
 *
 * CHECKED FROM THE STEPS, not only from the file's `requires:`. An author who forgets to declare a
 * requirement should not thereby get a tour that dies halfway — the steps are the truth, and
 * `requires:` is an extra assertion layered on top for things a tour needs but does not visibly
 * touch. This is the whole reason a tour can be refused WHOLE rather than abandoned in the middle,
 * which is the difference between "your console cannot run this" and a user stranded at step four.
 */
export function fitness(tour, dictionary) {
    const missing = [];
    const deferred = [];
    const seen = new Set();
    const consider = (target) => {
        if (seen.has(target.text))
            return;
        seen.add(target.text);
        const verdict = supports(dictionary, target);
        if (verdict === 'missing')
            missing.push(target);
        if (verdict === 'deferred')
            deferred.push(target);
    };
    for (const step of tour.steps)
        if (step.target)
            consider(step.target);
    for (const text of tour.requires) {
        try {
            consider(parseTarget(text));
        }
        catch {
            // A `requires:` entry that is not a target is the author's mistake, not a reason to refuse a
            // tour whose STEPS are all supported. It is reported by `describe`, where an author looks.
        }
    }
    return { ok: missing.length === 0, missing, deferred };
}
/** The refusal, in a sentence a user can act on. Empty when the tour fits. */
export function refusal(tour, dictionary) {
    const { missing } = fitness(tour, dictionary);
    if (!missing.length)
        return '';
    const names = missing.map((t) => t.text).join(', ');
    return `“${tour.name}” needs ${names}, which this surface (${dictionary.surface}) does not have.`;
}
//# sourceMappingURL=dictionary.js.map