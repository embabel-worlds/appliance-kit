"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.TourRecorder = exports.interpolate = exports.TourRun = exports.describe = exports.refusal = exports.fitness = exports.supports = exports.TOUR_VERBS = exports.TourFormatError = exports.parseDuration = exports.parseTarget = exports.parseStep = exports.parseTour = void 0;
var tour_ts_1 = require("./tour.js");
Object.defineProperty(exports, "parseTour", { enumerable: true, get: function () { return tour_ts_1.parseTour; } });
Object.defineProperty(exports, "parseStep", { enumerable: true, get: function () { return tour_ts_1.parseStep; } });
Object.defineProperty(exports, "parseTarget", { enumerable: true, get: function () { return tour_ts_1.parseTarget; } });
Object.defineProperty(exports, "parseDuration", { enumerable: true, get: function () { return tour_ts_1.parseDuration; } });
Object.defineProperty(exports, "TourFormatError", { enumerable: true, get: function () { return tour_ts_1.TourFormatError; } });
Object.defineProperty(exports, "TOUR_VERBS", { enumerable: true, get: function () { return tour_ts_1.TOUR_VERBS; } });
var dictionary_ts_1 = require("./dictionary.js");
Object.defineProperty(exports, "supports", { enumerable: true, get: function () { return dictionary_ts_1.supports; } });
Object.defineProperty(exports, "fitness", { enumerable: true, get: function () { return dictionary_ts_1.fitness; } });
Object.defineProperty(exports, "refusal", { enumerable: true, get: function () { return dictionary_ts_1.refusal; } });
var prose_ts_1 = require("./prose.js");
Object.defineProperty(exports, "describe", { enumerable: true, get: function () { return prose_ts_1.describe; } });
var runner_ts_1 = require("./runner.js");
Object.defineProperty(exports, "TourRun", { enumerable: true, get: function () { return runner_ts_1.TourRun; } });
Object.defineProperty(exports, "interpolate", { enumerable: true, get: function () { return runner_ts_1.interpolate; } });
var record_ts_1 = require("./record.js");
Object.defineProperty(exports, "TourRecorder", { enumerable: true, get: function () { return record_ts_1.TourRecorder; } });
//# sourceMappingURL=index.js.map