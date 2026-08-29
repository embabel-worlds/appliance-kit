"use strict";
/*
 * THE TOUR VOCABULARY — small, closed, and the same on every surface.
 *
 * A tour is a script the UI runs against a vocabulary the UI itself publishes. Nothing here
 * addresses a widget by CSS selector, by position or by pixel: a step names something the surface
 * has declared in its dictionary, and a surface that has not declared it refuses the tour up front
 * rather than failing at step seven with the user half-onboarded.
 *
 * WHY THE VOCABULARY IS CLOSED, since it is the constraint everything else rests on. Tours are
 * meant to be exchanged — a realm ships one, a user exports one and sends it to a colleague — and
 * a file that types into someone's UI and runs queries against their own graph is `curl | sh` with
 * a friendlier icon. Eight verbs over declared names can be rendered back as prose and READ before
 * it runs (see `describe`). Arbitrary code cannot, which is the whole argument against writing
 * tours in TypeScript.
 *
 * The server neither knows nor validates any of this — see the note on `Tour` in the assistant.
 * Everything in this file is parsed out of the passthrough map it carries.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TourFormatError = exports.TOUR_VERBS = void 0;
exports.parseDuration = parseDuration;
exports.parseTarget = parseTarget;
exports.parseStep = parseStep;
exports.parseTour = parseTour;
exports.TOUR_VERBS = ['say', 'ask', 'open', 'set', 'invoke', 'run', 'wait', 'expect'];
/** Everything except `say`, which is also a modifier — see the note in [parseStep]. */
const ACTION_VERBS = ['ask', 'open', 'set', 'invoke', 'run', 'wait', 'expect'];
class TourFormatError extends Error {
}
exports.TourFormatError = TourFormatError;
const str = (v) => (typeof v === 'string' ? v : undefined);
/** `10m`, `90s`, `500ms`, or a bare number of milliseconds. */
function parseDuration(raw) {
    if (typeof raw === 'number')
        return raw;
    const text = str(raw)?.trim();
    if (!text)
        return undefined;
    const match = /^(\d+(?:\.\d+)?)\s*(ms|s|m|h)?$/.exec(text);
    if (!match)
        return undefined;
    const scale = { ms: 1, s: 1000, m: 60_000, h: 3_600_000 };
    return Number(match[1] ?? '0') * (scale[match[2] ?? 'ms'] ?? 1);
}
function parseTarget(text) {
    const dot = text.indexOf('.');
    if (dot <= 0 || dot === text.length - 1) {
        throw new TourFormatError(`'${text}' is not a target — targets are kind.name, like panel.documents`);
    }
    return { kind: text.slice(0, dot), name: text.slice(dot + 1), text };
}
/**
 * One step, from the map its file declared.
 *
 * A step with no verb this kit knows is an ERROR rather than a no-op. The alternative — skipping
 * quietly — turns a typo into a tour that runs to the end having done less than it said, which is
 * the failure mode hardest to notice and worst to debug.
 */
function parseStep(presentation, watchable = false) {
    // `say` IS BOTH A VERB AND A MODIFIER, and the action wins.
    //
    // `say:` on its own is narration; `say:` beside `invoke:` is the narration for that step. Any
    // other precedence turns every annotated step into a step that only talks — which is exactly what
    // the recorder produces, since it writes a `say: TODO` onto everything it captures. Found by the
    // round-trip test, where a recorded walk read back as three narrations and no actions.
    const verb = ACTION_VERBS.find((v) => presentation[v] !== undefined) ?? (presentation.say !== undefined ? 'say' : undefined);
    if (!verb) {
        const keys = Object.keys(presentation).join(', ') || '(nothing)';
        throw new TourFormatError(`a step must name one of ${exports.TOUR_VERBS.join(', ')} — this one has ${keys}`);
    }
    const subject = presentation[verb];
    const by = str(presentation.by) === 'user' ? 'user' : 'tour';
    const step = {
        verb,
        by,
        watchable,
        raw: presentation,
        say: verb === 'say' ? str(subject) : str(presentation.say),
        hint: str(presentation.hint),
        meanwhile: str(presentation.meanwhile),
        otherwise: str(presentation.else),
        timeoutMs: parseDuration(presentation.timeout),
    };
    if (verb === 'say')
        return step;
    if (verb === 'ask') {
        step.value = str(subject);
        step.question = str(presentation.question) ?? str(presentation.hint);
        return step;
    }
    const text = str(subject);
    if (!text)
        throw new TourFormatError(`'${verb}' needs a target, like ${verb}: panel.documents`);
    step.target = parseTarget(text);
    if (verb === 'set') {
        const to = presentation.to;
        if (to === undefined)
            throw new TourFormatError(`'set: ${text}' needs a 'to:' value`);
        step.value = typeof to === 'string' ? to : String(to);
    }
    if (verb === 'run' && presentation.with && typeof presentation.with === 'object') {
        step.params = Object.fromEntries(Object.entries(presentation.with).map(([k, v]) => [k, String(v)]));
    }
    return step;
}
/** A tour from the wire. Throws [TourFormatError] on a step this kit cannot read. */
function parseTour(wire) {
    const p = wire.presentation ?? {};
    const params = Array.isArray(p.params)
        ? []
        : Object.entries((p.params ?? {})).map(([name, spec]) => ({
            name,
            question: str(spec?.ask) ?? `${name}?`,
        }));
    return {
        id: wire.id,
        declaredId: wire.declaredId,
        userSaved: wire.userSaved,
        deletable: wire.deletable === true,
        ...(wire.source ? { source: wire.source } : {}),
        name: str(p.name) ?? wire.declaredId,
        description: str(p.description),
        params,
        steps: (wire.steps ?? []).map((s, i) => {
            try {
                return parseStep(s.presentation ?? {}, s.watchable === true);
            }
            catch (e) {
                throw new TourFormatError(`step ${i + 1}: ${e.message}`);
            }
        }),
        requires: declaredRequirements(p.requires),
        raw: p,
    };
}
/**
 * `requires:` as a flat list of targets.
 *
 * Two shapes are accepted because both read naturally and neither is worth refusing: a list of
 * targets (`[panel.documents, view.EsgCoverage]`), or the grouped form the issue used
 * (`panels: [documents]`, `views: [EsgCoverage]`). The grouped keys are pluralised kinds.
 */
function declaredRequirements(raw) {
    if (Array.isArray(raw))
        return raw.filter((x) => typeof x === 'string');
    if (!raw || typeof raw !== 'object')
        return [];
    return Object.entries(raw).flatMap(([group, names]) => {
        const kind = group.replace(/s$/, '');
        return Array.isArray(names) ? names.filter((n) => typeof n === 'string').map((n) => `${kind}.${n}`) : [];
    });
}
//# sourceMappingURL=tour.js.map