/*
 * TOURS — a constrained script that any surface can implement, and a realm can ship.
 *
 * Four pieces, and the order they matter in:
 *
 *   dictionary.ts  what a surface declares it understands. The half that makes "any UI" true.
 *   tour.ts        the vocabulary, parsed out of the passthrough maps the server carries.
 *   prose.ts       what a tour will do, in English, derived from the file rather than asserted
 *                  by its author — which is what makes a stranger's tour safe to be offered.
 *   runner.ts      the order and the control: pause, resume, stop, skip what is already done.
 *   record.ts      the inverse of the resolver, and a draft rather than a finished tour.
 *
 * Everything here is DOM-free and framework-free, like the rest of the kit: the console mounts it
 * in React, the Me app calls it from a click handler, and neither has to adopt the other's idea of
 * how a UI updates. The one dependency is a YAML writer, for the recorder — a real library for a
 * solved problem, per the house rule.
 */

export { parseTour, parseStep, parseTarget, parseDuration, TourFormatError, TOUR_VERBS } from './tour.ts'
export type { Tour, TourStep, TourTarget, TourParam, TourVerb, TourActor, WireTour } from './tour.ts'

export { supports, fitness, refusal } from './dictionary.ts'
export type { TourDictionary, TourPanelEntry, TourSupport, TourFitness } from './dictionary.ts'

export { describe } from './prose.ts'
export type { TourSynopsis } from './prose.ts'

export { TourRun, interpolate } from './runner.ts'
export type { TourHost, TourRunState, TourRunOptions, TourProgress, TourStepStatus } from './runner.ts'

export { TourRecorder } from './record.ts'
export type { RecordedAction, TourDraftMeta } from './record.ts'
