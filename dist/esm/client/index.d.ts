export { HttpTransport, basicAuth } from './transport.ts';
export type { Transport, RequestSpec, HttpTransportConfig } from './transport.ts';
export { createSseParser } from './sse.ts';
export type { SseEvent, SseParser } from './sse.ts';
export { isOk, expect } from './outcome.ts';
export type { Outcome, Ok, Failure, FailureKind } from './outcome.ts';
export { KgClient, isBackgroundHandle } from './kg.ts';
export type { ExecuteOptions, KgAnswerAccepted, KgBackgroundHandle, KgDeleteViewResult, KgGenerated, KgInFlightRun, KgKillResult, KgPropertyValues, KgQueryResult, KgRefreshViewResult, KgRunChoice, KgRunState, KgSaveViewRequest, KgSaveViewResult, KgSchema, KgValidation, KgView, KgViewInvocation, KgViewParamSpec, } from './kg.ts';
export { DocumentsClient, newOperationId } from './documents.ts';
export type { Answer, AskRequest, Citation, DateField, DocumentList, IngestedDocument, } from './documents.ts';
export { classifySource } from './citations.ts';
export type { CitedSource, SourceKind } from './citations.ts';
export { HandlersClient } from './handlers.ts';
export type { HandlerAvailable, HandlerDryRunResult, HandlerEnabledResult, HandlerGenerated, HandlerList, HandlerListing, HandlerMutationResult, HandlerRanAgainst, HandlerSaveRequest, HandlerScheduleResult, HandlerSource, HandlerValidation, } from './handlers.ts';
export type { components, paths } from './generated/openapi.ts';
import { DocumentsClient } from './documents.ts';
import { HandlersClient } from './handlers.ts';
import { KgClient } from './kg.ts';
import { type HttpTransportConfig, type Transport } from './transport.ts';
/** Everything the appliance offers, per connection. One more sub-client lands here per surface. */
export declare class ApplianceClient {
    readonly transport: Transport;
    readonly kg: KgClient;
    readonly handlers: HandlersClient;
    readonly documents: DocumentsClient;
    constructor(transport: Transport);
    /** The console's configuration: relative URLs, same origin, ambient credentials. */
    static sameOrigin(config?: Omit<HttpTransportConfig, 'baseUrl'>): ApplianceClient;
    /** The Me main process's configuration: an explicit appliance URL and its credential. */
    static forAppliance(config: HttpTransportConfig): ApplianceClient;
}
//# sourceMappingURL=index.d.ts.map