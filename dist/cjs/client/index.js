"use strict";
/*
 * @embabel/appliance-client — the one place the appliance's REST surface is written down.
 *
 * Consumed by the Worlds console (browser, same-origin fetch) and by the Me app's MAIN process
 * (Node, configured baseUrl, credential held out of the renderer). No DOM, no framework, so it can
 * load in either.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApplianceClient = exports.HandlersClient = exports.isBackgroundHandle = exports.KgClient = exports.expect = exports.isOk = exports.basicAuth = exports.HttpTransport = void 0;
var transport_ts_1 = require("./transport.js");
Object.defineProperty(exports, "HttpTransport", { enumerable: true, get: function () { return transport_ts_1.HttpTransport; } });
Object.defineProperty(exports, "basicAuth", { enumerable: true, get: function () { return transport_ts_1.basicAuth; } });
var outcome_ts_1 = require("./outcome.js");
Object.defineProperty(exports, "isOk", { enumerable: true, get: function () { return outcome_ts_1.isOk; } });
Object.defineProperty(exports, "expect", { enumerable: true, get: function () { return outcome_ts_1.expect; } });
var kg_ts_1 = require("./kg.js");
Object.defineProperty(exports, "KgClient", { enumerable: true, get: function () { return kg_ts_1.KgClient; } });
Object.defineProperty(exports, "isBackgroundHandle", { enumerable: true, get: function () { return kg_ts_1.isBackgroundHandle; } });
var handlers_ts_1 = require("./handlers.js");
Object.defineProperty(exports, "HandlersClient", { enumerable: true, get: function () { return handlers_ts_1.HandlersClient; } });
const handlers_ts_2 = require("./handlers.js");
const kg_ts_2 = require("./kg.js");
const transport_ts_2 = require("./transport.js");
/** Everything the appliance offers, per connection. One more sub-client lands here per surface. */
class ApplianceClient {
    transport;
    kg;
    handlers;
    constructor(transport) {
        this.transport = transport;
        this.kg = new kg_ts_2.KgClient(transport);
        this.handlers = new handlers_ts_2.HandlersClient(transport);
    }
    /** The console's configuration: relative URLs, same origin, ambient credentials. */
    static sameOrigin(config = {}) {
        return new ApplianceClient(new transport_ts_2.HttpTransport({ ...config, baseUrl: '' }));
    }
    /** The Me main process's configuration: an explicit appliance URL and its credential. */
    static forAppliance(config) {
        return new ApplianceClient(new transport_ts_2.HttpTransport(config));
    }
}
exports.ApplianceClient = ApplianceClient;
//# sourceMappingURL=index.js.map