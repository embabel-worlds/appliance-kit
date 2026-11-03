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
exports.planLine = exports.pipelineText = exports.completeQuery = exports.PEEK_LIMIT = exports.referencedScopeNames = exports.scopeReference = exports.scopeLabel = exports.SCOPE_NAME = exports.isFailure = exports.isTerminal = exports.describeVcEvent = exports.shownValue = exports.entityProperties = exports.isEntity = exports.isInternalProperty = exports.LABEL_INTERNAL_PROPERTIES = exports.INTERNAL_PROPERTIES = exports.rowGraph = exports.rowsToCsv = exports.rowsToMarkdown = exports.rowColumns = exports.RESERVED_PARAMS = exports.declaredParams = exports.tokenDoc = exports.relationshipDoc = exports.propertyDescription = exports.propertyDoc = exports.labelDoc = exports.anchoredPattern = exports.labelDoors = exports.USER_ANCHOR = exports.propertyMapContext = exports.nodeContext = exports.edgeContext = exports.connectedLabels = exports.relationshipTypesFor = exports.relationshipTypes = exports.anchorLabels = exports.labelNames = exports.propertyDetails = exports.propertiesOf = exports.aliasMap = exports.TIPS = exports.compose = exports.esc = exports.AI_KEYS = exports.VIA_VALUES = exports.TARGETS = void 0;
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
Object.defineProperty(exports, "propertyDetails", { enumerable: true, get: function () { return schema_ts_1.propertyDetails; } });
Object.defineProperty(exports, "labelNames", { enumerable: true, get: function () { return schema_ts_1.labelNames; } });
Object.defineProperty(exports, "anchorLabels", { enumerable: true, get: function () { return schema_ts_1.anchorLabels; } });
Object.defineProperty(exports, "relationshipTypes", { enumerable: true, get: function () { return schema_ts_1.relationshipTypes; } });
Object.defineProperty(exports, "relationshipTypesFor", { enumerable: true, get: function () { return schema_ts_1.relationshipTypesFor; } });
Object.defineProperty(exports, "connectedLabels", { enumerable: true, get: function () { return schema_ts_1.connectedLabels; } });
Object.defineProperty(exports, "edgeContext", { enumerable: true, get: function () { return schema_ts_1.edgeContext; } });
Object.defineProperty(exports, "nodeContext", { enumerable: true, get: function () { return schema_ts_1.nodeContext; } });
Object.defineProperty(exports, "propertyMapContext", { enumerable: true, get: function () { return schema_ts_1.propertyMapContext; } });
Object.defineProperty(exports, "USER_ANCHOR", { enumerable: true, get: function () { return schema_ts_1.USER_ANCHOR; } });
Object.defineProperty(exports, "labelDoors", { enumerable: true, get: function () { return schema_ts_1.labelDoors; } });
Object.defineProperty(exports, "anchoredPattern", { enumerable: true, get: function () { return schema_ts_1.anchoredPattern; } });
Object.defineProperty(exports, "labelDoc", { enumerable: true, get: function () { return schema_ts_1.labelDoc; } });
Object.defineProperty(exports, "propertyDoc", { enumerable: true, get: function () { return schema_ts_1.propertyDoc; } });
Object.defineProperty(exports, "propertyDescription", { enumerable: true, get: function () { return schema_ts_1.propertyDescription; } });
Object.defineProperty(exports, "relationshipDoc", { enumerable: true, get: function () { return schema_ts_1.relationshipDoc; } });
Object.defineProperty(exports, "tokenDoc", { enumerable: true, get: function () { return schema_ts_1.tokenDoc; } });
var params_ts_1 = require("./params.js");
Object.defineProperty(exports, "declaredParams", { enumerable: true, get: function () { return params_ts_1.declaredParams; } });
Object.defineProperty(exports, "RESERVED_PARAMS", { enumerable: true, get: function () { return params_ts_1.RESERVED_PARAMS; } });
var rows_ts_1 = require("./rows.js");
Object.defineProperty(exports, "rowColumns", { enumerable: true, get: function () { return rows_ts_1.rowColumns; } });
Object.defineProperty(exports, "rowsToMarkdown", { enumerable: true, get: function () { return rows_ts_1.rowsToMarkdown; } });
Object.defineProperty(exports, "rowsToCsv", { enumerable: true, get: function () { return rows_ts_1.rowsToCsv; } });
Object.defineProperty(exports, "rowGraph", { enumerable: true, get: function () { return rows_ts_1.rowGraph; } });
Object.defineProperty(exports, "INTERNAL_PROPERTIES", { enumerable: true, get: function () { return rows_ts_1.INTERNAL_PROPERTIES; } });
Object.defineProperty(exports, "LABEL_INTERNAL_PROPERTIES", { enumerable: true, get: function () { return rows_ts_1.LABEL_INTERNAL_PROPERTIES; } });
Object.defineProperty(exports, "isInternalProperty", { enumerable: true, get: function () { return rows_ts_1.isInternalProperty; } });
Object.defineProperty(exports, "isEntity", { enumerable: true, get: function () { return rows_ts_1.isEntity; } });
Object.defineProperty(exports, "entityProperties", { enumerable: true, get: function () { return rows_ts_1.entityProperties; } });
Object.defineProperty(exports, "shownValue", { enumerable: true, get: function () { return rows_ts_1.shownValue; } });
var events_ts_1 = require("./events.js");
Object.defineProperty(exports, "describeVcEvent", { enumerable: true, get: function () { return events_ts_1.describeVcEvent; } });
Object.defineProperty(exports, "isTerminal", { enumerable: true, get: function () { return events_ts_1.isTerminal; } });
Object.defineProperty(exports, "isFailure", { enumerable: true, get: function () { return events_ts_1.isFailure; } });
var scopes_ts_1 = require("./scopes.js");
Object.defineProperty(exports, "SCOPE_NAME", { enumerable: true, get: function () { return scopes_ts_1.SCOPE_NAME; } });
Object.defineProperty(exports, "scopeLabel", { enumerable: true, get: function () { return scopes_ts_1.scopeLabel; } });
Object.defineProperty(exports, "scopeReference", { enumerable: true, get: function () { return scopes_ts_1.scopeReference; } });
Object.defineProperty(exports, "referencedScopeNames", { enumerable: true, get: function () { return scopes_ts_1.referencedScopeNames; } });
var session_ts_1 = require("./session.js");
Object.defineProperty(exports, "PEEK_LIMIT", { enumerable: true, get: function () { return session_ts_1.PEEK_LIMIT; } });
Object.defineProperty(exports, "completeQuery", { enumerable: true, get: function () { return session_ts_1.completeQuery; } });
Object.defineProperty(exports, "pipelineText", { enumerable: true, get: function () { return session_ts_1.pipelineText; } });
Object.defineProperty(exports, "planLine", { enumerable: true, get: function () { return session_ts_1.planLine; } });
//# sourceMappingURL=index.js.map