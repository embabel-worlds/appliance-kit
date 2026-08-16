export { HttpTransport, basicAuth } from './transport.ts';
export type { Transport, RequestSpec, HttpTransportConfig } from './transport.ts';
export { isOk, expect } from './outcome.ts';
export type { Outcome, Ok, Failure, FailureKind } from './outcome.ts';
export { KgClient, isBackgroundHandle } from './kg.ts';
export type { ExecuteOptions, KgAnswerAccepted, KgBackgroundHandle, KgDeleteViewResult, KgGenerated, KgInFlightRun, KgKillResult, KgPropertyValues, KgQueryResult, KgRefreshViewResult, KgRunChoice, KgRunState, KgSaveViewRequest, KgSaveViewResult, KgSchema, KgValidation, KgView, KgViewInvocation, KgViewParamSpec, } from './kg.ts';
export { HandlersClient } from './handlers.ts';
export type { HandlerAvailable, HandlerDryRunResult, HandlerEnabledResult, HandlerGenerated, HandlerList, HandlerListing, HandlerMutationResult, HandlerRanAgainst, HandlerSaveRequest, HandlerScheduleResult, HandlerSource, HandlerValidation, } from './handlers.ts';
export type { components, paths } from './generated/openapi.ts';
import { HandlersClient } from './handlers.ts';
import { KgClient } from './kg.ts';
import { type HttpTransportConfig, type Transport } from './transport.ts';
/** Everything the appliance offers, per connection. One more sub-client lands here per surface. */
export declare class ApplianceClient {
    readonly transport: Transport;
    readonly kg: KgClient;
    readonly handlers: HandlersClient;
    constructor(transport: Transport);
    /** The console's configuration: relative URLs, same origin, ambient credentials. */
    static sameOrigin(config?: Omit<HttpTransportConfig, 'baseUrl'>): ApplianceClient;
    /** The Me main process's configuration: an explicit appliance URL and its credential. */
    static forAppliance(config: HttpTransportConfig): ApplianceClient;
}
//# sourceMappingURL=index.d.ts.map