/*
 * REFLECTION (#1782): ask an agent how it would do its job better, read what it proposes with the
 * evidence for each change, and adopt it — never wider than it was signed — or dismiss it.
 *
 * A refusal is the server's own sentence, lifted out of a 409 as the agents client does.
 */

import { failure, type Outcome } from './outcome.ts'
import type { Transport } from './transport.ts'

export interface ProposalChange {
  /** `job`, `routing`, `persona`, `duty:<name>:text`, `duty:<name>:every` or `add-duty`. */
  target: string
  from: string | null
  to: string
  why: string
  evidence: string
  duty: { name: string; text: string; holds: string; every: string | null } | null
}

export interface AgentProposal {
  id: string
  agent: string
  fromVersion: number | null
  summary: string
  changes: ProposalChange[]
  /** What the agent's record said, as the reflection read it. */
  record: string
  status: 'OPEN' | 'ADOPTED' | 'DISMISSED'
  /** False until a battery and a replay can prove it; nothing proves one yet. */
  proven: boolean
  createdAt: string
  decidedAt: string | null
  refused: string | null
}

interface ProposalResponse {
  proposal: AgentProposal | null
  refused: string | null
}

const AGENTS = '/api/v1/agents'

export class AgentReflectionClient {
  constructor(private readonly transport: Transport) {}

  reflect(name: string): Promise<Outcome<AgentProposal>> {
    return this.decide(`${AGENTS}/${encodeURIComponent(name)}/reflect`)
  }

  proposals(name: string): Promise<Outcome<AgentProposal[]>> {
    return this.transport.send({ method: 'GET', path: `${AGENTS}/${encodeURIComponent(name)}/proposals` })
  }

  adopt(name: string, id: string): Promise<Outcome<AgentProposal>> {
    return this.decide(`${AGENTS}/${encodeURIComponent(name)}/proposals/${encodeURIComponent(id)}/adopt`)
  }

  dismiss(name: string, id: string): Promise<Outcome<AgentProposal>> {
    return this.decide(`${AGENTS}/${encodeURIComponent(name)}/proposals/${encodeURIComponent(id)}/dismiss`)
  }

  private async decide(path: string): Promise<Outcome<AgentProposal>> {
    const outcome = await this.transport.send<ProposalResponse>({ method: 'POST', path, body: {} })
    if (!outcome.ok) {
      const refused = (outcome.body as Partial<ProposalResponse> | undefined)?.refused
      return refused ? failure('refused', refused, outcome.status, outcome.body) : outcome
    }
    const proposal = outcome.value.proposal
    return proposal ? { ok: true, value: proposal } : failure('refused', outcome.value.refused ?? 'Refused', 200, outcome.value)
  }
}
