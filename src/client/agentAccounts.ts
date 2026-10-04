/*
 * AN AGENT'S OWN ACCOUNTS, AND RETIRING IT (#1783): the secrets it calls an API with when its identity
 * there is its own account — by name, never by value — and retiring it, which is final: off duty for
 * good, every key that may talk to it revoked, every credential of its own deleted.
 */

import type { Outcome } from './outcome.ts'
import type { Transport } from './transport.ts'

export interface AgentSlots {
  agent: string
  secrets: string[]
}

export interface Retired {
  agent: string
  keysRevoked: number
  slotsDeleted: number
}

const AGENTS = '/api/v1/agents'

export class AgentAccountsClient {
  constructor(private readonly transport: Transport) {}

  list(name: string): Promise<Outcome<AgentSlots>> {
    return this.transport.send({ method: 'GET', path: `${AGENTS}/${encodeURIComponent(name)}/accounts` })
  }

  set(name: string, secret: string, value: string): Promise<Outcome<AgentSlots>> {
    return this.transport.send({
      method: 'PUT', path: `${AGENTS}/${encodeURIComponent(name)}/accounts/${encodeURIComponent(secret)}`, body: { value },
    })
  }

  remove(name: string, secret: string): Promise<Outcome<AgentSlots>> {
    return this.transport.send({ method: 'DELETE', path: `${AGENTS}/${encodeURIComponent(name)}/accounts/${encodeURIComponent(secret)}` })
  }

  retire(name: string, reason: string): Promise<Outcome<Retired>> {
    return this.transport.send({ method: 'POST', path: `${AGENTS}/${encodeURIComponent(name)}/retire`, body: { reason } })
  }
}
