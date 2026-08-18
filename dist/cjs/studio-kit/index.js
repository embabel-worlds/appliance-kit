"use strict";
/*
 * @embabel/studio-kit — the studios' shared EDITOR BEHAVIOR, once.
 *
 * The third layer of the client stack: @embabel/vc and @embabel/code-surface
 * are semantics (no DOM, no transport); this is behavior (DOM, still no
 * transport, no framework); each surface keeps only its own wiring — elements,
 * panels, and however it talks to the appliance. Semantics arrive INJECTED so
 * a page loads exactly one copy of each.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.cypherFragmentCompletions = exports.createCypherHint = exports.severityOfLine = exports.severityOfLevel = exports.pendingBehind = exports.matchesFilter = exports.isAtBottom = exports.MAX_LOG_LINES = exports.toSafeHtml = exports.MARKDOWN_SANITIZE = exports.MARKDOWN_OPTIONS = exports.definitionTitle = exports.createDefinitionTooltip = exports.copyWithNod = exports.setStatus = exports.formatDuration = void 0;
var format_ts_1 = require("./format.js");
Object.defineProperty(exports, "formatDuration", { enumerable: true, get: function () { return format_ts_1.formatDuration; } });
var status_ts_1 = require("./status.js");
Object.defineProperty(exports, "setStatus", { enumerable: true, get: function () { return status_ts_1.setStatus; } });
var copy_ts_1 = require("./copy.js");
Object.defineProperty(exports, "copyWithNod", { enumerable: true, get: function () { return copy_ts_1.copyWithNod; } });
var tooltip_ts_1 = require("./tooltip.js");
Object.defineProperty(exports, "createDefinitionTooltip", { enumerable: true, get: function () { return tooltip_ts_1.createDefinitionTooltip; } });
Object.defineProperty(exports, "definitionTitle", { enumerable: true, get: function () { return tooltip_ts_1.definitionTitle; } });
var markdown_ts_1 = require("./markdown.js");
Object.defineProperty(exports, "MARKDOWN_OPTIONS", { enumerable: true, get: function () { return markdown_ts_1.MARKDOWN_OPTIONS; } });
Object.defineProperty(exports, "MARKDOWN_SANITIZE", { enumerable: true, get: function () { return markdown_ts_1.MARKDOWN_SANITIZE; } });
Object.defineProperty(exports, "toSafeHtml", { enumerable: true, get: function () { return markdown_ts_1.toSafeHtml; } });
var logs_ts_1 = require("./logs.js");
Object.defineProperty(exports, "MAX_LOG_LINES", { enumerable: true, get: function () { return logs_ts_1.MAX_LOG_LINES; } });
Object.defineProperty(exports, "isAtBottom", { enumerable: true, get: function () { return logs_ts_1.isAtBottom; } });
Object.defineProperty(exports, "matchesFilter", { enumerable: true, get: function () { return logs_ts_1.matchesFilter; } });
Object.defineProperty(exports, "pendingBehind", { enumerable: true, get: function () { return logs_ts_1.pendingBehind; } });
Object.defineProperty(exports, "severityOfLevel", { enumerable: true, get: function () { return logs_ts_1.severityOfLevel; } });
Object.defineProperty(exports, "severityOfLine", { enumerable: true, get: function () { return logs_ts_1.severityOfLine; } });
var hints_ts_1 = require("./hints.js");
Object.defineProperty(exports, "createCypherHint", { enumerable: true, get: function () { return hints_ts_1.createCypherHint; } });
Object.defineProperty(exports, "cypherFragmentCompletions", { enumerable: true, get: function () { return hints_ts_1.cypherFragmentCompletions; } });
//# sourceMappingURL=index.js.map