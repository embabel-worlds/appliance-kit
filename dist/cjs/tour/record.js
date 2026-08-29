"use strict";
/*
 * RECORDING — the inverse of the resolver, and cheap only because the dictionary exists.
 *
 * A surface that can turn `field.domain` into a widget can also turn that widget back into
 * `field.domain`, so recording is a few lines on top of work already done. That is the whole reason
 * this comes AFTER the vocabulary rather than before it: a recorder built first has nothing to name
 * things with, so it records positions and selectors, and produces the brittle scripts that made
 * macro recorders a byword for rot.
 *
 * A RECORDED TOUR IS A DRAFT, and this module says so in the file it writes. Four verbs can be
 * observed — open, set, invoke, run — and the two that make a tour worth running cannot:
 *
 *  - `say`, the narration. Nobody can watch a click and know why it mattered.
 *  - `doneWhen`, the precondition. It is a claim about the world, not an event in it, and it is
 *    what makes a tour resumable.
 *
 * Pretending otherwise would ship tours that re-run steps on resume and explain nothing, and the
 * author would not know why. So: record the skeleton, hand it back with the gaps marked, and let a
 * human — or a coding agent with the tour-authoring skill — write the half that teaches.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TourRecorder = void 0;
const yaml_1 = require("yaml");
const HEADER = `# RECORDED, AND THEREFORE A DRAFT.
#
# What a recorder can see is what was clicked. What it cannot see is why any of it mattered, or
# when a step is already done — and those are the two things that make a tour worth running:
#
#   say:      narration. Add one before each step that teaches something.
#   doneWhen: Cypher that is true when a step need not run again. Without it, a user who pauses
#             and resumes re-runs work they have already done.
#
# Both are marked TODO below. Delete the markers as you fill them in.`;
const TODO_SAY = 'TODO: say what this step is for.';
/**
 * Collects what a user did and hands back the skeleton of a tour.
 *
 * Coalescing is deliberate and minimal: typing into a field emits one action per keystroke in most
 * UIs, and a tour with forty `set` steps for one field is not a draft anybody would edit. Anything
 * cleverer than "the last value wins" would be guessing at intent.
 */
class TourRecorder {
    recorded = [];
    observe(action) {
        const previous = this.recorded.at(-1);
        if (previous && sameTarget(previous, action)) {
            // The same field typed into twice, or the same panel opened twice: keep the later one.
            if (action.verb === 'set' || action.verb === 'open') {
                this.recorded[this.recorded.length - 1] = action;
                return;
            }
        }
        this.recorded.push(action);
    }
    /** Narration the author typed while recording — the one thing worth capturing that is not a click. */
    narrate(markdown) {
        this.recorded.push({ verb: 'say', value: markdown });
    }
    undo() {
        this.recorded.pop();
    }
    get actions() {
        return this.recorded;
    }
    /** The draft as the object a tour file holds. */
    draft(meta) {
        return {
            id: meta.id,
            name: meta.name,
            ...(meta.description ? { description: meta.description } : {}),
            steps: this.recorded.map((action) => step(action)),
        };
    }
    /** The draft as the FILE — importable as it stands, and readable enough to edit. */
    toYaml(meta) {
        return `${HEADER}\n\n${(0, yaml_1.stringify)([this.draft(meta)], { lineWidth: 96 })}`;
    }
}
exports.TourRecorder = TourRecorder;
const sameTarget = (a, b) => a.verb === b.verb && a.target !== undefined && a.target === b.target;
function step(action) {
    if (action.verb === 'say')
        return { say: action.value ?? '' };
    const out = { [action.verb]: action.target };
    if (action.verb === 'set')
        out.to = action.value ?? '';
    if (action.verb === 'run' && action.params)
        out.with = action.params;
    if (action.by === 'user')
        out.by = 'user';
    // The gaps, named where the author will see them rather than in documentation they have to find.
    out.say = TODO_SAY;
    if (action.verb === 'invoke' || action.verb === 'run') {
        out.doneWhen = 'TODO: Cypher that returns a row once this step need not run again.';
    }
    return out;
}
//# sourceMappingURL=record.js.map