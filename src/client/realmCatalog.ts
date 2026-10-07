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
 * Experimental realms on offer are left out unless asked for. An author's `maturity: experimental`
 * says the realm may change or break, so a list does not lead with it — but says how many it left
 * out, since an opt-in nobody can find is not one. An INSTALLED experimental realm is never left
 * out: it is part of this world whatever its author thinks of it (realm-spec, Maturity). Unstated
 * maturity is no claim, and listed.
 *
 * What a realm is FOR is its `category`: one id from a published list, which the appliance has
 * already judged, so a row carries it with its label and icon or carries none (realm-spec,
 * Category). It is the facet to browse by. Tags are free text and stay a way of searching.
 */

import type { ExecuteOptions, KgBackgroundHandle, KgQueryResult, KgViewParamSpec } from './kg.ts'
import { failure, ok, type Outcome } from './outcome.ts'

export type RealmShow = 'all' | 'installed' | 'available'

export interface RealmFilter {
  /** Installed, on offer, or both. Default both. */
  show?: RealmShow
  /** The category every listed realm is in, as its id. Empty is any. */
  category?: string
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
  /** What the realm is for, as an id from the published list. Empty when it states none the list has. */
  category: string
  /** The category's name for people. Empty when [category] is. */
  categoryLabel: string
  /** The category's Phosphor icon name. Empty when it has none. */
  categoryIcon: string
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

/** A category and how many realms are in it. An empty [id] is the realms that state none. */
export interface CategoryCount {
  id: string
  label: string
  icon: string
  realms: number
}

type Facet = 'category' | 'tag' | 'experimental'

/** A query and how to run it: the text, and its declared parameters with their values. */
export interface CatalogQuery {
  cypher: string
  options: ExecuteOptions
}

type Run = (cypher: string, options: ExecuteOptions) => Promise<Outcome<KgQueryResult | KgBackgroundHandle>>

const ROW = `r.name AS name, r.description AS description, r.installed AS installed, r.version AS version,
  r.latestVersion AS latestVersion, r.author AS author, r.provider AS provider, r.maturity AS maturity,
  r.tags AS tags, r.url AS url, r.source AS source, r.problems AS problems, r.missingSources AS missingSources,
  r.category AS category, r.categoryLabel AS categoryLabel, r.categoryIcon AS categoryIcon`

/* The text a word must appear in. Tags count: "accounting" finds a realm tagged accounting whose
 * description never says the word. */
const HAYSTACK = "toLower(r.name + ' ' + r.description + ' ' + r.author + ' ' + reduce(s = '', t IN r.tags | s + ' ' + t))"

const string = (description: string): KgViewParamSpec => ({ type: 'string', default: '', description }) as KgViewParamSpec

/**
 * The WHERE for [filter], leaving out the facets named in [except] — a facet's own counts are taken
 * with every OTHER facet applied, so a chip says how many realms choosing it would show.
 */
function where(filter: RealmFilter, except: ReadonlyArray<Facet> = []): CatalogQuery['options'] & { clauses: string[] } {
  const clauses: string[] = []
  const params: Record<string, KgViewParamSpec> = {}
  const args: Record<string, unknown> = {}
  if (filter.show === 'installed') clauses.push('r.installed')
  if (filter.show === 'available') clauses.push('NOT r.installed')
  if (!filter.experimental && !except.includes('experimental')) clauses.push("(r.installed OR r.maturity <> 'experimental')")
  const category = filter.category?.trim()
  if (category && !except.includes('category')) {
    clauses.push('r.category = $category')
    params['category'] = string('The category every listed realm is in')
    args['category'] = category
  }
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

function query(head: string, filter: RealmFilter, tail: string, except?: ReadonlyArray<Facet>, extra: string[] = []): CatalogQuery {
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

/**
 * How many realms are in each category, under every facet but the category itself. The realms that
 * state none come back too, as the row whose category is empty: how many there are is part of the answer.
 */
export function categoriesQuery(filter: RealmFilter): CatalogQuery {
  return query(
    'MATCH (r:Realm)',
    filter,
    'RETURN r.category AS category, r.categoryLabel AS label, r.categoryIcon AS icon, count(*) AS realms ORDER BY realms DESC, label',
    ['category'],
  )
}

/** How many experimental realms the other facets would show if they were included. */
export function experimentalQuery(filter: RealmFilter): CatalogQuery {
  return query('MATCH (r:Realm)', filter, 'RETURN count(r) AS hidden', ['experimental'], ['NOT r.installed', "r.maturity = 'experimental'"])
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
    category: text(row['category']),
    categoryLabel: text(row['categoryLabel']),
    categoryIcon: text(row['categoryIcon']),
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

  async categories(filter: RealmFilter): Promise<Outcome<CategoryCount[]>> {
    const q = categoriesQuery(filter)
    const rows = rowsOf(await this.run(q.cypher, q.options), 'Counting realm categories')
    if (!rows.ok) return rows
    return ok(rows.value.map((r) => ({
      id: text(r['category']),
      label: text(r['label']),
      icon: text(r['icon']),
      realms: Number(r['realms'] ?? 0) || 0,
    })))
  }

  async hiddenExperimental(filter: RealmFilter): Promise<Outcome<number>> {
    if (filter.experimental) return ok(0)
    const q = experimentalQuery(filter)
    const rows = rowsOf(await this.run(q.cypher, q.options), 'Counting experimental realms')
    return rows.ok ? ok(Number(rows.value[0]?.['hidden'] ?? 0) || 0) : rows
  }
}
