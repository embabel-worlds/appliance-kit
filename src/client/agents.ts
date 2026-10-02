import { failure, type Outcome } from './outcome.ts'
import type { Transport } from './transport.ts'

/*
 * AGENTS: the colleagues in a world, their stage on the ladder, and their signed versions.
 *
 * HAND-TYPED FOR NOW, AND ON PURPOSE TEMPORARY. Every other client module takes its types from
 * `generated/openapi.ts`, because a hand-written reading of a server's shape is exactly the drift
 * this package exists to end. These endpoints are newer than the published Worlds API document, so
 * until it carries them the shapes below mirror the server's `AgentView` field for field. When the
 * document is regenerated, replace them with `components['schemas'][…]` aliases and delete this
 * note; anything that then fails to typecheck is a real disagreement.
 *
 * A refusal is the server's own sentence. A 409 from `stage` or `sign` carries `refused` rather
 * than `error`, so the transport's generic reading would say only "Request refused (409)"; the
 * sentence is lifted out here, once, so every surface shows what the appliance actually said.
 */

export type AgentStage = 'off' | 'observing' | 'on'
export type AgentState = 'draft' | 'submitted' | 'active' | 'suspended' | 'retired'

export interface AgentRoutine {
  name: string
  description: string
  trigger: string
  /** The stage chosen for this routine, before the agent's standing applies. */
  stage: AgentStage
  /** The stage dispatch honours. Lower than `stage` when the agent still needs something. */
  firing: AgentStage
  /** Named by the agent but absent from the world. */
  missing: boolean
}

export type DutyState = 'upheld' | 'lapsed' | 'neglected' | 'unknown'

export interface AgentDuty {
  name: string
  text: string
  holds: string
  every: string | null
  timezone: string | null
  stage: AgentStage
  /** The latest check, in words: "upheld", "lapsed since …", "unknown: …", or "not checked yet". */
  status: string
  state?: DutyState | null
  lapsedSince?: string | null
  checkedAt?: string | null
  violations?: number
  reason?: string | null
  /** When it last passed a test run, and of which signed version. Going on duty needs the current one. */
  testedAt?: string | null
  testedVersion?: number | null
}

/** What one check of a duty found, and what its repair did or would have done. */
export interface DutyCheck {
  agent: string
  duty: string
  state: DutyState
  lapsedSince: string | null
  checkedAt: string
  violations: number
  reason: string | null
  repaired: number
  repairFailures: number
  wouldHaveCalled: string[]
  onDemand: boolean
  agentVersion: number | null
}

export interface Agent {
  name: string
  job: string
  routing: string
  persona: string | null
  sponsor: string | null
  owners: string[]
  operators: string[]
  state: AgentState
  stage: AgentStage
  /** The latest signed version; 0 when never signed, or gathered from existing routines. */
  version: number
  signedBy: string | null
  signedAt: string | null
  unsignedChanges: string[]
  /** "world", a realm's name, or "migrated" for routines gathered into an agent. */
  origin: string
  routines: AgentRoutine[]
  duties: AgentDuty[]
  /** What it needs before it can go on duty; empty when it can. */
  needs: string[]
}

export interface AgentVersion {
  version: number
  signedBy: string
  signedAt: string
  digest: string
  routines: string[]
}

interface StageResponse {
  agent: Agent | null
  refused: string | null
}

const AGENTS = '/api/v1/agents'

export class AgentsClient {
  constructor(private readonly transport: Transport) {}

  list(): Promise<Outcome<Agent[]>> {
    return this.transport.send({ method: 'GET', path: AGENTS })
  }

  get(name: string): Promise<Outcome<Agent>> {
    return this.transport.send({ method: 'GET', path: `${AGENTS}/${encodeURIComponent(name)}` })
  }

  /** Move an agent, or one routine it holds, on the ladder. Lowering is always allowed. */
  setStage(name: string, stage: AgentStage, routine?: string): Promise<Outcome<Agent>> {
    return this.agentOrRefusal(
      this.transport.send<StageResponse>({
        method: 'POST',
        path: `${AGENTS}/${encodeURIComponent(name)}/stage`,
        body: routine ? { stage, routine } : { stage },
      }),
    )
  }

  /** Sign the agent as it stands now, as its next version. */
  sign(name: string): Promise<Outcome<Agent>> {
    return this.agentOrRefusal(
      this.transport.send<StageResponse>({ method: 'POST', path: `${AGENTS}/${encodeURIComponent(name)}/sign`, body: {} }),
    )
  }

  /**
   * Check one duty now and run its repair on what it finds. Off duty it only observes, so this is
   * the test run a duty must pass before its agent goes on duty.
   */
  checkDuty(name: string, duty: string): Promise<Outcome<DutyCheck>> {
    return this.transport.send({
      method: 'POST',
      path: `${AGENTS}/${encodeURIComponent(name)}/duties/${encodeURIComponent(duty)}/check`,
      body: {},
    })
  }

  versions(name: string): Promise<Outcome<AgentVersion[]>> {
    return this.transport.send({ method: 'GET', path: `${AGENTS}/${encodeURIComponent(name)}/versions` })
  }

  private async agentOrRefusal(pending: Promise<Outcome<StageResponse>>): Promise<Outcome<Agent>> {
    const outcome = await pending
    if (!outcome.ok) {
      const refused = (outcome.body as Partial<StageResponse> | undefined)?.refused
      return refused ? failure('refused', refused, outcome.status, outcome.body) : outcome
    }
    const agent = outcome.value.agent
    return agent ? { ok: true, value: agent } : failure('refused', outcome.value.refused ?? 'Refused', 200, outcome.value)
  }
}
