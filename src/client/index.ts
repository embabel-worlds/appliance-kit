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

export { DEFAULT_INGEST_TIMEOUT_MS, DocumentsClient, newOperationId } from './documents.ts'
export { DEFAULT_INGEST_POLL_MS, DEFAULT_INGEST_STALLED_AFTER_MS, followIngest } from './ingests.ts'
export type { FollowIngestOptions, IngestFollowUpdate, IngestJob, IngestJobList, IngestJobState, IngestResult } from './ingests.ts'
export type {
  Answer,
  AskRequest,
  Citation,
  DateField,
  DocumentList,
  DocumentsClientOptions,
  IngestOptions,
  IngestedDocument,
  TagsResult,
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

export { CronClient } from './cron.ts'
export type { CompiledSchedule } from './cron.ts'
export { AgentsClient } from './agents.ts'
export { RequestsClient } from './requests.ts'
export { ThreadsClient } from './threads.ts'
export type { Attachment, AttachmentKind, AttachmentRequest, Sender, SenderKind, Thread, ThreadMessage, ThreadView } from './threads.ts'
export type { AgentRequest, RequestStatus } from './requests.ts'
export type { Agent, AgentDuty, AgentRoutine, AgentStage, AgentState, AgentVersion, DutyCheck, DutyState, Halt } from './agents.ts'

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

import { AgentsClient as AgentsClientImpl } from './agents.ts'
import { RequestsClient as RequestsClientImpl } from './requests.ts'
import { ThreadsClient as ThreadsClientImpl } from './threads.ts'
import { CronClient as CronClientImpl } from './cron.ts'
import { DocumentsClient, type DocumentsClientOptions } from './documents.ts'
import { HandlersClient } from './handlers.ts'
import { HintsClient } from './hints.ts'
import { KgClient } from './kg.ts'
import { ToursClient } from './tours.ts'
import { HttpTransport, type HttpTransportConfig, type Transport } from './transport.ts'

/** Settings for the sub-clients, as opposed to the transport's. */
export interface ApplianceClientOptions {
  documents?: DocumentsClientOptions
}

/** Everything the appliance offers, per connection. One more sub-client lands here per surface. */
export class ApplianceClient {
  readonly kg: KgClient
  readonly agents: AgentsClientImpl
  readonly requests: RequestsClientImpl
  readonly threads: ThreadsClientImpl
  readonly cron: CronClientImpl
  readonly handlers: HandlersClient
  readonly documents: DocumentsClient
  readonly hints: HintsClient
  readonly tours: ToursClient

  constructor(readonly transport: Transport, options: ApplianceClientOptions = {}) {
    this.kg = new KgClient(transport)
    this.agents = new AgentsClientImpl(transport)
    this.requests = new RequestsClientImpl(transport)
    this.threads = new ThreadsClientImpl(transport)
    this.cron = new CronClientImpl(transport)
    this.handlers = new HandlersClient(transport)
    this.documents = new DocumentsClient(transport, options.documents)
    this.hints = new HintsClient(transport)
    this.tours = new ToursClient(transport)
  }

  /** The console's configuration: relative URLs, same origin, ambient credentials. */
  static sameOrigin(config: Omit<HttpTransportConfig, 'baseUrl'> = {}, options: ApplianceClientOptions = {}): ApplianceClient {
    return new ApplianceClient(new HttpTransport({ ...config, baseUrl: '' }), options)
  }

  /** The Me main process's configuration: an explicit appliance URL and its credential. */
  static forAppliance(config: HttpTransportConfig, options: ApplianceClientOptions = {}): ApplianceClient {
    return new ApplianceClient(new HttpTransport(config), options)
  }
}
