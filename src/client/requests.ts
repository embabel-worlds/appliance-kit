import { failure, type Outcome } from './outcome.ts'
import type { Transport } from './transport.ts'

/*
 * REQUESTS: what an agent asks a person to approve before it acts (embabel/me#1776).
 *
 * Hand-typed for the reason agents.ts gives: these endpoints are newer than the published Worlds
 * API document. When it carries them, replace the shapes with `components['schemas'][…]` aliases.
 *
 * A refused decision answers 409 with `refused` — already decided, expired, or a rejection with no
 * reason — and that sentence is lifted out here so a surface shows what the appliance said.
 */

export type RequestStatus = 'PENDING' | 'APPROVED' | 'FAILED' | 'REJECTED' | 'EXPIRED'

export interface AgentRequest {
  id: string
  ownerId: string
  /** The routine that asked, and the run it asked from. */
  routine: string
  runId: string | null
  /** The gateway verb approving it calls, e.g. `odoo_partnerMessagePost`. */
  verb: string
  /** The verb's input, as JSON text. */
  args: string
  /** Why — what an approver reads first. */
  detail: string
  /** The rows the routine saw when it asked. */
  evidence: Record<string, unknown>[]
  status: RequestStatus
  raisedAt: string
  expiresAt: string
  decidedAt: string | null
  decidedBy: string | null
  reason: string | null
  /** What the verb answered, once approved. */
  result: string | null
}

interface DecisionResponse {
  request: AgentRequest | null
  refused: string | null
}

const REQUESTS = '/api/v1/requests'

export class RequestsClient {
  constructor(private readonly transport: Transport) {}

  list(): Promise<Outcome<AgentRequest[]>> {
    return this.transport.send({ method: 'GET', path: REQUESTS })
  }

  get(id: string): Promise<Outcome<AgentRequest>> {
    return this.transport.send({ method: 'GET', path: `${REQUESTS}/${encodeURIComponent(id)}` })
  }

  /** Approve: the appliance calls the request's verb as you. */
  approve(id: string): Promise<Outcome<AgentRequest>> {
    return this.decide(id, { decision: 'approve' })
  }

  /** Reject, saying why. The appliance refuses a rejection without a reason. */
  reject(id: string, reason: string): Promise<Outcome<AgentRequest>> {
    return this.decide(id, { decision: 'reject', reason })
  }

  private async decide(id: string, body: { decision: string; reason?: string }): Promise<Outcome<AgentRequest>> {
    const outcome = await this.transport.send<DecisionResponse>({
      method: 'POST',
      path: `${REQUESTS}/${encodeURIComponent(id)}/decision`,
      body,
    })
    if (!outcome.ok) {
      const refused = (outcome.body as Partial<DecisionResponse> | undefined)?.refused
      return refused ? failure('refused', refused, outcome.status, outcome.body) : outcome
    }
    const request = outcome.value.request
    return request ? { ok: true, value: request } : failure('refused', outcome.value.refused ?? 'Refused', 200, outcome.value)
  }
}
