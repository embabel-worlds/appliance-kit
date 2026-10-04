/*
 * THE REALM CATALOGUE, AS A QUERY. Every realm this world can name — installed or on offer — is a
 * `(:Realm)` row in Virtual Cypher, the same rows chat and Query Studio see. A realm list is a query
 * over them, and every facet a person sets is a WHERE on that query rather than a filter the browser
 * applies to a REST payload: which is why "which CRM realms could I install?" in chat and the CRM
 * chip in a list can never disagree.
 *
 * Built here, once, so the console's store and the kit's surface run the same queries. What a person
 * typed or picked is never spliced into the text: each value travels as a declared view parameter,
 * and only the SHAPE of the query varies with which facets are set.
 *
 * Experimental realms are left out unless asked for. An author's `maturity: experimental` says the
 * realm may change or break, so a list does not lead with it — but says how many it left out, since
 * an opt-in nobody can find is not one. Unstated maturity is no claim, and listed.
 */

import type { ExecuteOptions, KgBackgroundHandle, KgQueryResult, KgViewParamSpec } from './kg.ts'
import { failure, ok, type Outcome } from './outcome.ts'

export type RealmShow = 'all' | 'installed' | 'available'

export interface RealmFilter {
  /** Installed, on offer, or both. Default both. */
  show?: RealmShow
  /** One tag every listed realm carries. Empty is any. */
  tag?: string
  /** Include realms their authors call experimental. Default false. */
  experimental?: boolean
  /** Every word must appear in the name, description, author or tags. */
  words?: string
  /** Judged by meaning — a model reads each row — rather than matched by words. Costs a model call per realm. */
  meaning?: string
}

/** A `(:Realm)` row, as RealmCatalogBackend states it. */
export interface CatalogRealm {
  name: string
  description: string
  installed: boolean
  /** The installed version, or the offered one for a realm not installed. */
  version: string
  /** What the directory offers; differs from [version] when an installed realm has moved on. */
  latestVersion: string
  author: string
  /** Where it was offered from: the directory source. */
  provider: string
  /** `experimental`, `beta`, `stable`, `deprecated`, or empty when the author states none. */
  maturity: string
  tags: string[]
  url: string
  /** What to install from: the clone URL. Empty for a realm nobody offers (path-installed, private). */
  source: string
  problems: number
  missingSources: string[]
}

export interface TagCount {
  tag: string
  realms: number
}

/** A query and how to run it: the text, and its declared parameters with their values. */
export interface CatalogQuery {
  cypher: string
  options: ExecuteOptions
}

type Run = (cypher: string, options: ExecuteOptions) => Promise<Outcome<KgQueryResult | KgBackgroundHandle>>

const ROW = `r.name AS name, r.description AS description, r.installed AS installed, r.version AS version,
  r.latestVersion AS latestVersion, r.author AS author, r.provider AS provider, r.maturity AS maturity,
  r.tags AS tags, r.url AS url, r.source AS source, r.problems AS problems, r.missingSources AS missingSources`

/* The text a word must appear in. Tags count: "accounting" finds a realm tagged accounting whose
 * description never says the word. */
const HAYSTACK = "toLower(r.name + ' ' + r.description + ' ' + r.author + ' ' + reduce(s = '', t IN r.tags | s + ' ' + t))"

const string = (description: string): KgViewParamSpec => ({ type: 'string', default: '', description }) as KgViewParamSpec

/**
 * The WHERE for [filter], leaving out the facets named in [except] — a facet's own counts are taken
 * with every OTHER facet applied, so a chip says how many realms choosing it would show.
 */
function where(filter: RealmFilter, except: ReadonlyArray<'tag' | 'experimental'> = []): CatalogQuery['options'] & { clauses: string[] } {
  const clauses: string[] = []
  const params: Record<string, KgViewParamSpec> = {}
  const args: Record<string, unknown> = {}
  if (filter.show === 'installed') clauses.push('r.installed')
  if (filter.show === 'available') clauses.push('NOT r.installed')
  if (!filter.experimental && !except.includes('experimental')) clauses.push("r.maturity <> 'experimental'")
  const tag = filter.tag?.trim()
  if (tag && !except.includes('tag')) {
    clauses.push('$tag IN r.tags')
    params['tag'] = string('A tag every listed realm carries')
    args['tag'] = tag
  }
  const words = filter.words?.trim()
  if (words) {
    clauses.push(`all(w IN split(toLower($words), ' ') WHERE w = '' OR ${HAYSTACK} CONTAINS w)`)
    params['words'] = string('Words every listed realm mentions')
    args['words'] = words
  }
  const meaning = filter.meaning?.trim()
  if (meaning) {
    /* The bare row, not r.description: the judge reads the whole of it — name included — so a realm
     * with a thin manifest can still be found by what its name implies. */
    clauses.push('ai.relevant(r, $meaning)')
    params['meaning'] = string('What the person is looking for, judged by meaning')
    args['meaning'] = meaning
  }
  return { clauses, ...(Object.keys(params).length ? { params, args } : {}) }
}

function query(head: string, filter: RealmFilter, tail: string, except?: ReadonlyArray<'tag' | 'experimental'>, extra: string[] = []): CatalogQuery {
  const { clauses, ...options } = where(filter, except)
  const all = [...clauses, ...extra]
  return { cypher: `${head}${all.length ? ` WHERE ${all.join(' AND ')}` : ''} ${tail}`, options }
}

/** The realms [filter] lets through: installed first, then by name. */
export function realmsQuery(filter: RealmFilter): CatalogQuery {
  return query('MATCH (r:Realm)', filter, `RETURN ${ROW} ORDER BY installed DESC, name`)
}

/** How many realms carry each tag, under every facet but the tag itself. */
export function tagsQuery(filter: RealmFilter): CatalogQuery {
  return query('MATCH (r:Realm)', filter, 'UNWIND r.tags AS tag RETURN tag, count(*) AS realms ORDER BY realms DESC, tag', ['tag'])
}

/** How many experimental realms the other facets would show if they were included. */
export function experimentalQuery(filter: RealmFilter): CatalogQuery {
  return query('MATCH (r:Realm)', filter, 'RETURN count(r) AS hidden', ['experimental'], ["r.maturity = 'experimental'"])
}

const text = (v: unknown): string => (typeof v === 'string' ? v : v == null ? '' : String(v))
const texts = (v: unknown): string[] => (Array.isArray(v) ? v.map(text).filter(Boolean) : [])

export function toRealm(row: Record<string, unknown>): CatalogRealm {
  return {
    name: text(row['name']),
    description: text(row['description']),
    installed: row['installed'] === true,
    version: text(row['version']),
    latestVersion: text(row['latestVersion']),
    author: text(row['author']),
    provider: text(row['provider']),
    maturity: text(row['maturity']).toLowerCase(),
    tags: texts(row['tags']),
    url: text(row['url']),
    source: text(row['source']),
    problems: Number(row['problems'] ?? 0) || 0,
    missingSources: texts(row['missingSources']),
  }
}

/*
 * A run that parked in the background has no rows yet; a catalogue list is not worth waiting on in
 * the background, so it reads as a failure the caller can retry rather than as "no realms".
 */
function rowsOf(outcome: Outcome<KgQueryResult | KgBackgroundHandle>, what: string): Outcome<Record<string, unknown>[]> {
  if (!outcome.ok) return outcome
  const value = outcome.value as KgQueryResult
  if (!('rows' in value)) return failure('failed', `${what} is still running in the background`, undefined, { background: true })
  if (value.error) return failure('refused', `${what}: ${value.error}`)
  return ok((value.rows ?? []) as Record<string, unknown>[])
}

/** The run parked in the background rather than failing: its answer exists, just not here yet. */
export const ranInBackground = (outcome: Outcome<unknown>): boolean =>
  !outcome.ok && (outcome.body as { background?: unknown } | undefined)?.background === true

export class RealmCatalog {
  constructor(private readonly run: Run) {}

  async realms(filter: RealmFilter): Promise<Outcome<CatalogRealm[]>> {
    const q = realmsQuery(filter)
    const rows = rowsOf(await this.run(q.cypher, q.options), 'Listing realms')
    return rows.ok ? ok(rows.value.map(toRealm)) : rows
  }

  async tags(filter: RealmFilter): Promise<Outcome<TagCount[]>> {
    const q = tagsQuery(filter)
    const rows = rowsOf(await this.run(q.cypher, q.options), 'Counting realm tags')
    return rows.ok ? ok(rows.value.map((r) => ({ tag: text(r['tag']), realms: Number(r['realms'] ?? 0) || 0 })).filter((t) => t.tag)) : rows
  }

  async hiddenExperimental(filter: RealmFilter): Promise<Outcome<number>> {
    if (filter.experimental) return ok(0)
    const q = experimentalQuery(filter)
    const rows = rowsOf(await this.run(q.cypher, q.options), 'Counting experimental realms')
    return rows.ok ? ok(Number(rows.value[0]?.['hidden'] ?? 0) || 0) : rows
  }
}
