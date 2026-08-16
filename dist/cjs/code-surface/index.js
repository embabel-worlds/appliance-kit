"use strict";
/*
 * @embabel/code-surface — reading the appliance's generated gateway surface, once.
 *
 * The sibling of @embabel/vc: that package understands the engine's virtual-Cypher
 * semantics; this one understands the typed `gateway.*` surface the appliance
 * generates per user (`interfaces.ts`). Pure functions — no DOM, no transport —
 * so the Handler Studio, the Worlds console and a test all complete against the
 * same reading of the same file.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.gatewayPathAt = exports.methodAt = exports.membersOf = exports.parseSurface = void 0;
var surface_ts_1 = require("./surface.js");
Object.defineProperty(exports, "parseSurface", { enumerable: true, get: function () { return surface_ts_1.parseSurface; } });
Object.defineProperty(exports, "membersOf", { enumerable: true, get: function () { return surface_ts_1.membersOf; } });
Object.defineProperty(exports, "methodAt", { enumerable: true, get: function () { return surface_ts_1.methodAt; } });
Object.defineProperty(exports, "gatewayPathAt", { enumerable: true, get: function () { return surface_ts_1.gatewayPathAt; } });
//# sourceMappingURL=index.js.map