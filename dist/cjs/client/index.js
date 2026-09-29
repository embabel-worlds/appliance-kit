"use strict";
/*
 * @embabel/appliance-client — the one place the appliance's REST surface is written down.
 *
 * Consumed by the Worlds console (browser, same-origin fetch) and by the Me app's MAIN process
 * (Node, configured baseUrl, credential held out of the renderer). No DOM, no framework, so it can
 * load in either.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApplianceClient = exports.HandlersClient = exports.classifySource = exports.ToursClient = exports.HintsClient = exports.followIngest = exports.DEFAULT_INGEST_STALLED_AFTER_MS = exports.DEFAULT_INGEST_POLL_MS = exports.newOperationId = exports.DocumentsClient = exports.DEFAULT_INGEST_TIMEOUT_MS = exports.isBackgroundHandle = exports.KgClient = exports.ok = exports.expect = exports.isOk = exports.createSseParser = exports.basicAuth = exports.HttpTransport = void 0;
var transport_ts_1 = require("./transport.js");
Object.defineProperty(exports, "HttpTransport", { enumerable: true, get: function () { return transport_ts_1.HttpTransport; } });
Object.defineProperty(exports, "basicAuth", { enumerable: true, get: function () { return transport_ts_1.basicAuth; } });
var sse_ts_1 = require("./sse.js");
Object.defineProperty(exports, "createSseParser", { enumerable: true, get: function () { return sse_ts_1.createSseParser; } });
var outcome_ts_1 = require("./outcome.js");
Object.defineProperty(exports, "isOk", { enumerable: true, get: function () { return outcome_ts_1.isOk; } });
Object.defineProperty(exports, "expect", { enumerable: true, get: function () { return outcome_ts_1.expect; } });
Object.defineProperty(exports, "ok", { enumerable: true, get: function () { return outcome_ts_1.ok; } });
var kg_ts_1 = require("./kg.js");
Object.defineProperty(exports, "KgClient", { enumerable: true, get: function () { return kg_ts_1.KgClient; } });
Object.defineProperty(exports, "isBackgroundHandle", { enumerable: true, get: function () { return kg_ts_1.isBackgroundHandle; } });
var documents_ts_1 = require("./documents.js");
Object.defineProperty(exports, "DEFAULT_INGEST_TIMEOUT_MS", { enumerable: true, get: function () { return documents_ts_1.DEFAULT_INGEST_TIMEOUT_MS; } });
Object.defineProperty(exports, "DocumentsClient", { enumerable: true, get: function () { return documents_ts_1.DocumentsClient; } });
Object.defineProperty(exports, "newOperationId", { enumerable: true, get: function () { return documents_ts_1.newOperationId; } });
var ingests_ts_1 = require("./ingests.js");
Object.defineProperty(exports, "DEFAULT_INGEST_POLL_MS", { enumerable: true, get: function () { return ingests_ts_1.DEFAULT_INGEST_POLL_MS; } });
Object.defineProperty(exports, "DEFAULT_INGEST_STALLED_AFTER_MS", { enumerable: true, get: function () { return ingests_ts_1.DEFAULT_INGEST_STALLED_AFTER_MS; } });
Object.defineProperty(exports, "followIngest", { enumerable: true, get: function () { return ingests_ts_1.followIngest; } });
var hints_ts_1 = require("./hints.js");
Object.defineProperty(exports, "HintsClient", { enumerable: true, get: function () { return hints_ts_1.HintsClient; } });
var tours_ts_1 = require("./tours.js");
Object.defineProperty(exports, "ToursClient", { enumerable: true, get: function () { return tours_ts_1.ToursClient; } });
var citations_ts_1 = require("./citations.js");
Object.defineProperty(exports, "classifySource", { enumerable: true, get: function () { return citations_ts_1.classifySource; } });
var handlers_ts_1 = require("./handlers.js");
Object.defineProperty(exports, "HandlersClient", { enumerable: true, get: function () { return handlers_ts_1.HandlersClient; } });
const documents_ts_2 = require("./documents.js");
const handlers_ts_2 = require("./handlers.js");
const hints_ts_2 = require("./hints.js");
const kg_ts_2 = require("./kg.js");
const tours_ts_2 = require("./tours.js");
const transport_ts_2 = require("./transport.js");
/** Everything the appliance offers, per connection. One more sub-client lands here per surface. */
class ApplianceClient {
    transport;
    kg;
    handlers;
    documents;
    hints;
    tours;
    constructor(transport, options = {}) {
        this.transport = transport;
        this.kg = new kg_ts_2.KgClient(transport);
        this.handlers = new handlers_ts_2.HandlersClient(transport);
        this.documents = new documents_ts_2.DocumentsClient(transport, options.documents);
        this.hints = new hints_ts_2.HintsClient(transport);
        this.tours = new tours_ts_2.ToursClient(transport);
    }
    /** The console's configuration: relative URLs, same origin, ambient credentials. */
    static sameOrigin(config = {}, options = {}) {
        return new ApplianceClient(new transport_ts_2.HttpTransport({ ...config, baseUrl: '' }), options);
    }
    /** The Me main process's configuration: an explicit appliance URL and its credential. */
    static forAppliance(config, options = {}) {
        return new ApplianceClient(new transport_ts_2.HttpTransport(config), options);
    }
}
exports.ApplianceClient = ApplianceClient;
//# sourceMappingURL=index.js.map