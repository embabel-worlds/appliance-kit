"use strict";
/*
 * @embabel/vc — the virtual-Cypher semantics, once.
 *
 * Lifted out of me-app's Query Studio, where it was entangled with the DOM
 * controls that rendered it. Pure functions: no DOM, no transport, no framework,
 * so the Worlds console, the Electron app and a test can all use the same
 * understanding of what the engine offers.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.rowsToCsv = exports.rowsToMarkdown = exports.rowColumns = exports.RESERVED_PARAMS = exports.declaredParams = exports.propertyMapContext = exports.nodeContext = exports.edgeContext = exports.connectedLabels = exports.relationshipTypesFor = exports.relationshipTypes = exports.anchorLabels = exports.labelNames = exports.propertiesOf = exports.aliasMap = exports.TIPS = exports.compose = exports.esc = exports.AI_KEYS = exports.VIA_VALUES = exports.TARGETS = void 0;
var targets_ts_1 = require("./targets.js");
Object.defineProperty(exports, "TARGETS", { enumerable: true, get: function () { return targets_ts_1.TARGETS; } });
Object.defineProperty(exports, "VIA_VALUES", { enumerable: true, get: function () { return targets_ts_1.VIA_VALUES; } });
Object.defineProperty(exports, "AI_KEYS", { enumerable: true, get: function () { return targets_ts_1.AI_KEYS; } });
Object.defineProperty(exports, "esc", { enumerable: true, get: function () { return targets_ts_1.esc; } });
var compose_ts_1 = require("./compose.js");
Object.defineProperty(exports, "compose", { enumerable: true, get: function () { return compose_ts_1.compose; } });
Object.defineProperty(exports, "TIPS", { enumerable: true, get: function () { return compose_ts_1.TIPS; } });
var schema_ts_1 = require("./schema.js");
Object.defineProperty(exports, "aliasMap", { enumerable: true, get: function () { return schema_ts_1.aliasMap; } });
Object.defineProperty(exports, "propertiesOf", { enumerable: true, get: function () { return schema_ts_1.propertiesOf; } });
Object.defineProperty(exports, "labelNames", { enumerable: true, get: function () { return schema_ts_1.labelNames; } });
Object.defineProperty(exports, "anchorLabels", { enumerable: true, get: function () { return schema_ts_1.anchorLabels; } });
Object.defineProperty(exports, "relationshipTypes", { enumerable: true, get: function () { return schema_ts_1.relationshipTypes; } });
Object.defineProperty(exports, "relationshipTypesFor", { enumerable: true, get: function () { return schema_ts_1.relationshipTypesFor; } });
Object.defineProperty(exports, "connectedLabels", { enumerable: true, get: function () { return schema_ts_1.connectedLabels; } });
Object.defineProperty(exports, "edgeContext", { enumerable: true, get: function () { return schema_ts_1.edgeContext; } });
Object.defineProperty(exports, "nodeContext", { enumerable: true, get: function () { return schema_ts_1.nodeContext; } });
Object.defineProperty(exports, "propertyMapContext", { enumerable: true, get: function () { return schema_ts_1.propertyMapContext; } });
var params_ts_1 = require("./params.js");
Object.defineProperty(exports, "declaredParams", { enumerable: true, get: function () { return params_ts_1.declaredParams; } });
Object.defineProperty(exports, "RESERVED_PARAMS", { enumerable: true, get: function () { return params_ts_1.RESERVED_PARAMS; } });
var rows_ts_1 = require("./rows.js");
Object.defineProperty(exports, "rowColumns", { enumerable: true, get: function () { return rows_ts_1.rowColumns; } });
Object.defineProperty(exports, "rowsToMarkdown", { enumerable: true, get: function () { return rows_ts_1.rowsToMarkdown; } });
Object.defineProperty(exports, "rowsToCsv", { enumerable: true, get: function () { return rows_ts_1.rowsToCsv; } });
//# sourceMappingURL=index.js.map