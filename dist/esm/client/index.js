/*
 * @embabel/appliance-client — the one place the appliance's REST surface is written down.
 *
 * Consumed by the Worlds console (browser, same-origin fetch) and by the Me app's MAIN process
 * (Node, configured baseUrl, credential held out of the renderer). No DOM, no framework, so it can
 * load in either.
 */
export { HttpTransport, basicAuth } from "./transport.js";
export { createSseParser } from "./sse.js";
export { isOk, expect, ok } from "./outcome.js";
export { KgClient, isBackgroundHandle } from "./kg.js";
export { DEFAULT_INGEST_TIMEOUT_MS, DocumentsClient, newOperationId } from "./documents.js";
export { DEFAULT_INGEST_POLL_MS, DEFAULT_INGEST_STALLED_AFTER_MS, followIngest } from "./ingests.js";
export { HintsClient } from "./hints.js";
export { ToursClient } from "./tours.js";
export { classifySource } from "./citations.js";
export { CronClient } from "./cron.js";
export { AgentsClient } from "./agents.js";
export { RequestsClient } from "./requests.js";
export { ThreadsClient } from "./threads.js";
export { HandlersClient } from "./handlers.js";
import { AgentsClient as AgentsClientImpl } from "./agents.js";
import { RequestsClient as RequestsClientImpl } from "./requests.js";
import { ThreadsClient as ThreadsClientImpl } from "./threads.js";
import { CronClient as CronClientImpl } from "./cron.js";
import { DocumentsClient } from "./documents.js";
import { HandlersClient } from "./handlers.js";
import { HintsClient } from "./hints.js";
import { KgClient } from "./kg.js";
import { ToursClient } from "./tours.js";
import { HttpTransport } from "./transport.js";
/** Everything the appliance offers, per connection. One more sub-client lands here per surface. */
export class ApplianceClient {
    transport;
    kg;
    agents;
    requests;
    threads;
    cron;
    handlers;
    documents;
    hints;
    tours;
    constructor(transport, options = {}) {
        this.transport = transport;
        this.kg = new KgClient(transport);
        this.agents = new AgentsClientImpl(transport);
        this.requests = new RequestsClientImpl(transport);
        this.threads = new ThreadsClientImpl(transport);
        this.cron = new CronClientImpl(transport);
        this.handlers = new HandlersClient(transport);
        this.documents = new DocumentsClient(transport, options.documents);
        this.hints = new HintsClient(transport);
        this.tours = new ToursClient(transport);
    }
    /** The console's configuration: relative URLs, same origin, ambient credentials. */
    static sameOrigin(config = {}, options = {}) {
        return new ApplianceClient(new HttpTransport({ ...config, baseUrl: '' }), options);
    }
    /** The Me main process's configuration: an explicit appliance URL and its credential. */
    static forAppliance(config, options = {}) {
        return new ApplianceClient(new HttpTransport(config), options);
    }
}
//# sourceMappingURL=index.js.map