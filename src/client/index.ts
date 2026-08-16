/*
 * @embabel/appliance-client — the one place the appliance's REST surface is written down.
 *
 * Consumed by the Worlds console (browser, same-origin fetch) and by the Me app's MAIN process
 * (Node, configured baseUrl, credential held out of the renderer). No DOM, no framework, so it can
 * load in either.
 */

export { HttpTransport, basicAuth } from './transport.ts'
export type { Transport, RequestSpec, HttpTransportConfig } from './transport.ts'

export { isOk, expect } from './outcome.ts'
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
  KgValidation,
  KgView,
  KgViewInvocation,
  KgViewParamSpec,
} from './kg.ts'

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

import { HandlersClient } from './handlers.ts'
import { KgClient } from './kg.ts'
import { HttpTransport, type HttpTransportConfig, type Transport } from './transport.ts'

/** Everything the appliance offers, per connection. One more sub-client lands here per surface. */
export class ApplianceClient {
  readonly kg: KgClient
  readonly handlers: HandlersClient

  constructor(readonly transport: Transport) {
    this.kg = new KgClient(transport)
    this.handlers = new HandlersClient(transport)
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
