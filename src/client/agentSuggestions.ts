/*
 * SUGGESTED COLLEAGUES (#1778): what the scout-agents skill found worth hiring, with the evidence it
 * counted, and the person's decision on each — draft it, adopt the realm agent that already does the
 * work, or dismiss it.
 *
 * A refusal is the server's own sentence, lifted out of a 409 the way the agents client lifts one.
 */

import { failure, type Outcome } from './outcome.ts'
import type { Transport } from './transport.ts'

export type SuggestionKind = 'WORKS' | 'TALKS'
export type SuggestionStatus = 'OPEN' | 'DRAFTED' | 'ADOPTED' | 'DISMISSED'

/** One piece of evidence, with the query that counted it so it can be run again. */
export interface SuggestionEvidence {
  summary: string
  count: number
  period: string
  query: string | null
  sample: Record<string, unknown>[]
}

export interface AgentSuggestion {
  id: string
  name: string
  job: string
  kind: SuggestionKind
  /** The installed realm agent that already does this work; null when a new one is drafted. */
  adopt: string | null
  /** What [adopt] does not cover; null when it covers all of it. */
  uncovered: string | null
  /** The definition a draft would write, in the agents/ YAML shape; null when adopting. */
  agent: Record<string, unknown> | null
  evidence: SuggestionEvidence[]
  feasibility: string
  rank: number
  status: SuggestionStatus
  createdAt: string
  decidedAt: string | null
  /** What the draft would act on today, one line per duty, once drafted. */
  preview: string[]
}

interface SuggestionResponse {
  suggestion: AgentSuggestion | null
  refused: string | null
}

/* Its own path: under agents it would collide with the agent of that name. */
const SUGGESTIONS = '/api/v1/agent-suggestions'

export class AgentSuggestionsClient {
  constructor(private readonly transport: Transport) {}

  list(): Promise<Outcome<AgentSuggestion[]>> {
    return this.transport.send({ method: 'GET', path: SUGGESTIONS })
  }

  /** Write the suggested agent into the world, unsigned and off duty, and see what it would act on. */
  draft(id: string): Promise<Outcome<AgentSuggestion>> {
    return this.decide(id, 'draft')
  }

  /** The realm agent it names was taken on from its card: the suggestion is settled. */
  adopted(id: string): Promise<Outcome<AgentSuggestion>> {
    return this.decide(id, 'adopted')
  }

  dismiss(id: string): Promise<Outcome<AgentSuggestion>> {
    return this.decide(id, 'dismiss')
  }

  private async decide(id: string, decision: string): Promise<Outcome<AgentSuggestion>> {
    const outcome = await this.transport.send<SuggestionResponse>({
      method: 'POST',
      path: `${SUGGESTIONS}/${encodeURIComponent(id)}/${decision}`,
      body: {},
    })
    if (!outcome.ok) {
      const refused = (outcome.body as Partial<SuggestionResponse> | undefined)?.refused
      return refused ? failure('refused', refused, outcome.status, outcome.body) : outcome
    }
    const suggestion = outcome.value.suggestion
    return suggestion ? { ok: true, value: suggestion } : failure('refused', outcome.value.refused ?? 'Refused', 200, outcome.value)
  }
}
