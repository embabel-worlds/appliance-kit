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
export { DocumentsClient, newOperationId } from "./documents.js";
export { HintsClient } from "./hints.js";
export { ToursClient } from "./tours.js";
export { classifySource } from "./citations.js";
export { HandlersClient } from "./handlers.js";
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
    handlers;
    documents;
    hints;
    tours;
    constructor(transport) {
        this.transport = transport;
        this.kg = new KgClient(transport);
        this.handlers = new HandlersClient(transport);
        this.documents = new DocumentsClient(transport);
        this.hints = new HintsClient(transport);
        this.tours = new ToursClient(transport);
    }
    /** The console's configuration: relative URLs, same origin, ambient credentials. */
    static sameOrigin(config = {}) {
        return new ApplianceClient(new HttpTransport({ ...config, baseUrl: '' }));
    }
    /** The Me main process's configuration: an explicit appliance URL and its credential. */
    static forAppliance(config) {
        return new ApplianceClient(new HttpTransport(config));
    }
}
//# sourceMappingURL=index.js.map