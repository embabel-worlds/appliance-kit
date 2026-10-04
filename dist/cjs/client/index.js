"use strict";
/*
 * @embabel/appliance-client — the one place the appliance's REST surface is written down.
 *
 * Consumed by the Worlds console (browser, same-origin fetch) and by the Me app's MAIN process
 * (Node, configured baseUrl, credential held out of the renderer). No DOM, no framework, so it can
 * load in either.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApplianceClient = exports.HandlersClient = exports.toRealm = exports.experimentalQuery = exports.tagsQuery = exports.realmsQuery = exports.ranInBackground = exports.RealmCatalog = exports.WORLD_LIST_QUERIES = exports.WorldLists = exports.AgentAccountsClient = exports.AgentReflectionClient = exports.AgentRunsClient = exports.AgentSuggestionsClient = exports.ThreadsClient = exports.RequestsClient = exports.AgentsClient = exports.CronClient = exports.classifySource = exports.ToursClient = exports.HintsClient = exports.followIngest = exports.DEFAULT_INGEST_STALLED_AFTER_MS = exports.DEFAULT_INGEST_POLL_MS = exports.newOperationId = exports.DocumentsClient = exports.DEFAULT_INGEST_TIMEOUT_MS = exports.isBackgroundHandle = exports.KgClient = exports.ok = exports.expect = exports.isOk = exports.createSseParser = exports.basicAuth = exports.HttpTransport = void 0;
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
var cron_ts_1 = require("./cron.js");
Object.defineProperty(exports, "CronClient", { enumerable: true, get: function () { return cron_ts_1.CronClient; } });
var agents_ts_1 = require("./agents.js");
Object.defineProperty(exports, "AgentsClient", { enumerable: true, get: function () { return agents_ts_1.AgentsClient; } });
var requests_ts_1 = require("./requests.js");
Object.defineProperty(exports, "RequestsClient", { enumerable: true, get: function () { return requests_ts_1.RequestsClient; } });
var threads_ts_1 = require("./threads.js");
Object.defineProperty(exports, "ThreadsClient", { enumerable: true, get: function () { return threads_ts_1.ThreadsClient; } });
var agentSuggestions_ts_1 = require("./agentSuggestions.js");
Object.defineProperty(exports, "AgentSuggestionsClient", { enumerable: true, get: function () { return agentSuggestions_ts_1.AgentSuggestionsClient; } });
var agentRuns_ts_1 = require("./agentRuns.js");
Object.defineProperty(exports, "AgentRunsClient", { enumerable: true, get: function () { return agentRuns_ts_1.AgentRunsClient; } });
var agentReflection_ts_1 = require("./agentReflection.js");
Object.defineProperty(exports, "AgentReflectionClient", { enumerable: true, get: function () { return agentReflection_ts_1.AgentReflectionClient; } });
var agentAccounts_ts_1 = require("./agentAccounts.js");
Object.defineProperty(exports, "AgentAccountsClient", { enumerable: true, get: function () { return agentAccounts_ts_1.AgentAccountsClient; } });
var worldLists_ts_1 = require("./worldLists.js");
Object.defineProperty(exports, "WorldLists", { enumerable: true, get: function () { return worldLists_ts_1.WorldLists; } });
Object.defineProperty(exports, "WORLD_LIST_QUERIES", { enumerable: true, get: function () { return worldLists_ts_1.QUERIES; } });
var realmCatalog_ts_1 = require("./realmCatalog.js");
Object.defineProperty(exports, "RealmCatalog", { enumerable: true, get: function () { return realmCatalog_ts_1.RealmCatalog; } });
Object.defineProperty(exports, "ranInBackground", { enumerable: true, get: function () { return realmCatalog_ts_1.ranInBackground; } });
Object.defineProperty(exports, "realmsQuery", { enumerable: true, get: function () { return realmCatalog_ts_1.realmsQuery; } });
Object.defineProperty(exports, "tagsQuery", { enumerable: true, get: function () { return realmCatalog_ts_1.tagsQuery; } });
Object.defineProperty(exports, "experimentalQuery", { enumerable: true, get: function () { return realmCatalog_ts_1.experimentalQuery; } });
Object.defineProperty(exports, "toRealm", { enumerable: true, get: function () { return realmCatalog_ts_1.toRealm; } });
var handlers_ts_1 = require("./handlers.js");
Object.defineProperty(exports, "HandlersClient", { enumerable: true, get: function () { return handlers_ts_1.HandlersClient; } });
const agents_ts_2 = require("./agents.js");
const requests_ts_2 = require("./requests.js");
const threads_ts_2 = require("./threads.js");
const agentSuggestions_ts_2 = require("./agentSuggestions.js");
const agentRuns_ts_2 = require("./agentRuns.js");
const agentReflection_ts_2 = require("./agentReflection.js");
const agentAccounts_ts_2 = require("./agentAccounts.js");
const cron_ts_2 = require("./cron.js");
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
    agents;
    requests;
    threads;
    agentSuggestions;
    agentRuns;
    agentReflection;
    agentAccounts;
    cron;
    handlers;
    documents;
    hints;
    tours;
    constructor(transport, options = {}) {
        this.transport = transport;
        this.kg = new kg_ts_2.KgClient(transport);
        this.agents = new agents_ts_2.AgentsClient(transport);
        this.requests = new requests_ts_2.RequestsClient(transport);
        this.threads = new threads_ts_2.ThreadsClient(transport);
        this.agentSuggestions = new agentSuggestions_ts_2.AgentSuggestionsClient(transport);
        this.agentRuns = new agentRuns_ts_2.AgentRunsClient(transport);
        this.agentReflection = new agentReflection_ts_2.AgentReflectionClient(transport);
        this.agentAccounts = new agentAccounts_ts_2.AgentAccountsClient(transport);
        this.cron = new cron_ts_2.CronClient(transport);
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