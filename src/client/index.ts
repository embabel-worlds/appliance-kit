/*
 * @embabel/appliance-client — the one place the appliance's REST surface is written down.
 *
 * Consumed by the Worlds console (browser, same-origin fetch) and by the Me app's MAIN process
 * (Node, configured baseUrl, credential held out of the renderer). No DOM, no framework, so it can
 * load in either.
 */

export { HttpTransport, basicAuth } from './transport.ts'
export type { Transport, RequestSpec, HttpTransportConfig } from './transport.ts'

export { createSseParser } from './sse.ts'
export type { SseEvent, SseParser } from './sse.ts'

export { isOk, expect, ok } from './outcome.ts'
export type { Outcome, Ok, Failure, FailureKind } from './outcome.ts'

export { KgClient, isBackgroundHandle } from './kg.ts'
export type {
  ExecuteOptions,
  KgAnswerAccepted,
  KgBackgroundHandle,
  KgDeleteViewResult,
  KgGenerated,
  KgInFlightRun,
  KgKillResult,
  KgPropertyValues,
  KgQueryResult,
  KgRefreshViewResult,
  KgRunChoice,
  KgRunState,
  KgSaveViewRequest,
  KgSaveViewResult,
  KgSchema,
  KgScopeDeleteResult,
  KgScopeInfo,
  KgScopeList,
  KgValidation,
  KgView,
  KgViewInvocation,
  KgViewParamSpec,
} from './kg.ts'

export { DocumentsClient, newOperationId } from './documents.ts'
export type {
  Answer,
  AskRequest,
  Citation,
  DateField,
  DocumentList,
  IngestedDocument,
} from './documents.ts'

export { HintsClient } from './hints.ts'
export type { Hint, HintAction, HintSurface } from './hints.ts'

export { ToursClient } from './tours.ts'
export type {
  TourSummary,
  TourStepView,
  TourListResponse,
  TourStepStatusResponse,
  TourDeletedResponse,
} from './tours.ts'

export { classifySource } from './citations.ts'
export type { CitedSource, SourceKind } from './citations.ts'

export { HandlersClient } from './handlers.ts'
export type {
  HandlerAvailable,
  HandlerDryRunResult,
  HandlerEnabledResult,
  HandlerGenerated,
  HandlerList,
  HandlerListing,
  HandlerMutationResult,
  HandlerRanAgainst,
  HandlerSaveRequest,
  HandlerScheduleResult,
  HandlerSource,
  HandlerValidation,
} from './handlers.ts'

export type { components, paths } from './generated/openapi.ts'

import { DocumentsClient } from './documents.ts'
import { HandlersClient } from './handlers.ts'
import { HintsClient } from './hints.ts'
import { KgClient } from './kg.ts'
import { ToursClient } from './tours.ts'
import { HttpTransport, type HttpTransportConfig, type Transport } from './transport.ts'

/** Everything the appliance offers, per connection. One more sub-client lands here per surface. */
export class ApplianceClient {
  readonly kg: KgClient
  readonly handlers: HandlersClient
  readonly documents: DocumentsClient
  readonly hints: HintsClient
  readonly tours: ToursClient

  constructor(readonly transport: Transport) {
    this.kg = new KgClient(transport)
    this.handlers = new HandlersClient(transport)
    this.documents = new DocumentsClient(transport)
    this.hints = new HintsClient(transport)
    this.tours = new ToursClient(transport)
  }

  /** The console's configuration: relative URLs, same origin, ambient credentials. */
  static sameOrigin(config: Omit<HttpTransportConfig, 'baseUrl'> = {}): ApplianceClient {
    return new ApplianceClient(new HttpTransport({ ...config, baseUrl: '' }))
  }

  /** The Me main process's configuration: an explicit appliance URL and its credential. */
  static forAppliance(config: HttpTransportConfig): ApplianceClient {
    return new ApplianceClient(new HttpTransport(config))
  }
}
