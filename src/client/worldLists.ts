/*
 * WORLD LISTS, AS QUERIES. What a world holds about itself — the APIs it skipped, the signal types
 * it has seen, its skills, its watches, the tags on its documents, which agent holds a routine — is
 * already exposed to Virtual Cypher, so a list of it is a query: the same rows chat and Query Studio
 * answer from, not a REST payload a browser reshapes. Built here once so every front end runs the
 * same queries; RealmCatalog does the same for realms.
 *
 * Each method answers in the shape the surface already consumes, so a host swaps its data source
 * without the surface changing. A value a person chose travels as a declared parameter, never text.
 */

import type { ExecuteOptions, KgBackgroundHandle, KgQueryResult, KgViewParamSpec } from './kg.ts'
import { failure, ok, type Outcome } from './outcome.ts'

type Run = (cypher: string, options?: ExecuteOptions) => Promise<Outcome<KgQueryResult | KgBackgroundHandle>>
type Row = Record<string, unknown>

/** An API a realm declared that the world skipped at load, and what would bring it back. */
export interface SkippedApi {
  name: string
  reason: string
  /** The secret or setting that unlocks it, when one does. */
  unlockedBy: string
}

/** A signal type the world has seen, with the fields it carried. */
export interface SeenSignalType {
  typeName: string
  fields: string[]
  count: number
  lastSeen: string
}

export interface WorldSkillRow {
  name: string
  description: string
}

/** A watch, in the shape the views surface lists. */
export interface WatchRow {
  id: string
  lensId: string
  name: string
  cron: string | null
  enabled: boolean
  delivery: { channel: string } | null
}

export interface TagCountRow {
  tag: string
  documents: number
}

export const QUERIES = {
  skippedApis:
    'MATCH (me:AssistantUser)-[:HAS_CONFIG]->(a:ConfigSkippedApi) ' +
    'RETURN a.name AS name, a.reason AS reason, a.unlockedBy AS unlockedBy ORDER BY name',
  signalTypes:
    'MATCH (me:AssistantUser)-[:HAS_CONFIG]->(s:ConfigSignalType) ' +
    'RETURN s.typeName AS typeName, s.fields AS fields, s.count AS count, s.lastSeen AS lastSeen ORDER BY typeName',
  skills:
    'MATCH (me:AssistantUser)-[:HAS_CONFIG]->(s:ConfigSkill) ' +
    'RETURN s.name AS name, s.description AS description ORDER BY name',
  watches:
    'MATCH (me:AssistantUser)-[:HAS_CONFIG]->(w:ConfigWatch) ' +
    'RETURN w.id AS id, w.name AS name, w.subject AS subject, w.schedule AS schedule, w.channel AS channel, w.enabled AS enabled ORDER BY name',
  documentTags:
    'MATCH (d:Document) UNWIND d.tags AS tag RETURN tag, count(DISTINCT d) AS documents ORDER BY documents DESC, tag',
  agentHolding:
    'MATCH (me:AssistantUser)-[:HAS_AGENT]->(a:Agent)-[:HOLDS]->(r:Routine) WHERE r.name = $routine ' +
    'RETURN a.name AS agent LIMIT 1',
} as const

const text = (v: unknown): string => (typeof v === 'string' ? v : v == null ? '' : String(v))
const count = (v: unknown): number => Number(v ?? 0) || 0

/* A list is not worth parking in the background: a run that did not answer here is a failure the
 * host can retry, never an empty list. */
function rowsOf(outcome: Outcome<KgQueryResult | KgBackgroundHandle>, what: string): Outcome<Row[]> {
  if (!outcome.ok) return outcome
  const value = outcome.value as KgQueryResult
  if (!('rows' in value)) return failure('failed', `${what} is still running in the background`, undefined, { background: true })
  if (value.error) return failure('refused', `${what}: ${value.error}`)
  return ok((value.rows ?? []) as Row[])
}

export class WorldLists {
  constructor(private readonly run: Run) {}

  private async rows(what: string, cypher: string, options?: ExecuteOptions): Promise<Outcome<Row[]>> {
    return rowsOf(await this.run(cypher, options), what)
  }

  async skippedApis(): Promise<Outcome<SkippedApi[]>> {
    const r = await this.rows('Listing skipped APIs', QUERIES.skippedApis)
    return r.ok ? ok(r.value.map((x) => ({ name: text(x['name']), reason: text(x['reason']), unlockedBy: text(x['unlockedBy']) }))) : r
  }

  async signalTypes(): Promise<Outcome<SeenSignalType[]>> {
    const r = await this.rows('Listing signal types', QUERIES.signalTypes)
    /* The label carries the fields as one comma-joined string; the surface wants the list. */
    const fields = (v: unknown): string[] =>
      Array.isArray(v) ? v.map(text).filter(Boolean) : text(v).split(',').map((f) => f.trim()).filter(Boolean)
    return r.ok
      ? ok(r.value.map((x) => ({ typeName: text(x['typeName']), fields: fields(x['fields']), count: count(x['count']), lastSeen: text(x['lastSeen']) })))
      : r
  }

  async skills(): Promise<Outcome<WorldSkillRow[]>> {
    const r = await this.rows('Listing skills', QUERIES.skills)
    return r.ok ? ok(r.value.map((x) => ({ name: text(x['name']), description: text(x['description']) }))) : r
  }

  async watches(): Promise<Outcome<WatchRow[]>> {
    const r = await this.rows('Listing watches', QUERIES.watches)
    return r.ok
      ? ok(r.value.map((x) => ({
        id: text(x['id']),
        lensId: text(x['subject']),
        name: text(x['name']),
        cron: text(x['schedule']) || null,
        enabled: x['enabled'] === true,
        delivery: text(x['channel']) ? { channel: text(x['channel']) } : null,
      })))
      : r
  }

  async documentTags(): Promise<Outcome<TagCountRow[]>> {
    const r = await this.rows('Listing document tags', QUERIES.documentTags)
    return r.ok ? ok(r.value.map((x) => ({ tag: text(x['tag']), documents: count(x['documents']) })).filter((t) => t.tag)) : r
  }

  /** The agent that holds [routine], or null when none does. */
  async agentHolding(routine: string): Promise<Outcome<string | null>> {
    const params: Record<string, KgViewParamSpec> = {
      routine: { type: 'string', default: '', description: 'The routine whose agent is wanted' } as KgViewParamSpec,
    }
    const r = await this.rows('Finding the agent that holds a routine', QUERIES.agentHolding, { params, args: { routine } })
    return r.ok ? ok(text(r.value[0]?.['agent']) || null) : r
  }
}
