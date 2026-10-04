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
 */
import { failure, ok } from "./outcome.js";
const ROW = `r.name AS name, r.description AS description, r.installed AS installed, r.version AS version,
  r.latestVersion AS latestVersion, r.author AS author, r.provider AS provider, r.maturity AS maturity,
  r.tags AS tags, r.url AS url, r.source AS source, r.problems AS problems, r.missingSources AS missingSources`;
/* The text a word must appear in. Tags count: "accounting" finds a realm tagged accounting whose
 * description never says the word. */
const HAYSTACK = "toLower(r.name + ' ' + r.description + ' ' + r.author + ' ' + reduce(s = '', t IN r.tags | s + ' ' + t))";
const string = (description) => ({ type: 'string', default: '', description });
/**
 * The WHERE for [filter], leaving out the facets named in [except] — a facet's own counts are taken
 * with every OTHER facet applied, so a chip says how many realms choosing it would show.
 */
function where(filter, except = []) {
    const clauses = [];
    const params = {};
    const args = {};
    if (filter.show === 'installed')
        clauses.push('r.installed');
    if (filter.show === 'available')
        clauses.push('NOT r.installed');
    if (!filter.experimental && !except.includes('experimental'))
        clauses.push("(r.installed OR r.maturity <> 'experimental')");
    const tag = filter.tag?.trim();
    if (tag && !except.includes('tag')) {
        clauses.push('$tag IN r.tags');
        params['tag'] = string('A tag every listed realm carries');
        args['tag'] = tag;
    }
    const words = filter.words?.trim();
    if (words) {
        clauses.push(`all(w IN split(toLower($words), ' ') WHERE w = '' OR ${HAYSTACK} CONTAINS w)`);
        params['words'] = string('Words every listed realm mentions');
        args['words'] = words;
    }
    const meaning = filter.meaning?.trim();
    if (meaning) {
        /* The bare row, not r.description: the judge reads the whole of it — name included — so a realm
         * with a thin manifest can still be found by what its name implies. */
        clauses.push('ai.relevant(r, $meaning)');
        params['meaning'] = string('What the person is looking for, judged by meaning');
        args['meaning'] = meaning;
    }
    return { clauses, ...(Object.keys(params).length ? { params, args } : {}) };
}
function query(head, filter, tail, except, extra = []) {
    const { clauses, ...options } = where(filter, except);
    const all = [...clauses, ...extra];
    return { cypher: `${head}${all.length ? ` WHERE ${all.join(' AND ')}` : ''} ${tail}`, options };
}
/** The realms [filter] lets through: installed first, then by name. */
export function realmsQuery(filter) {
    return query('MATCH (r:Realm)', filter, `RETURN ${ROW} ORDER BY installed DESC, name`);
}
/** How many realms carry each tag, under every facet but the tag itself. */
export function tagsQuery(filter) {
    return query('MATCH (r:Realm)', filter, 'UNWIND r.tags AS tag RETURN tag, count(*) AS realms ORDER BY realms DESC, tag', ['tag']);
}
/** How many experimental realms the other facets would show if they were included. */
export function experimentalQuery(filter) {
    return query('MATCH (r:Realm)', filter, 'RETURN count(r) AS hidden', ['experimental'], ['NOT r.installed', "r.maturity = 'experimental'"]);
}
const text = (v) => (typeof v === 'string' ? v : v == null ? '' : String(v));
const texts = (v) => (Array.isArray(v) ? v.map(text).filter(Boolean) : []);
export function toRealm(row) {
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
    };
}
/*
 * A run that parked in the background has no rows yet; a catalogue list is not worth waiting on in
 * the background, so it reads as a failure the caller can retry rather than as "no realms".
 */
function rowsOf(outcome, what) {
    if (!outcome.ok)
        return outcome;
    const value = outcome.value;
    if (!('rows' in value))
        return failure('failed', `${what} is still running in the background`, undefined, { background: true });
    if (value.error)
        return failure('refused', `${what}: ${value.error}`);
    return ok((value.rows ?? []));
}
/** The run parked in the background rather than failing: its answer exists, just not here yet. */
export const ranInBackground = (outcome) => !outcome.ok && outcome.body?.background === true;
export class RealmCatalog {
    run;
    constructor(run) {
        this.run = run;
    }
    async realms(filter) {
        const q = realmsQuery(filter);
        const rows = rowsOf(await this.run(q.cypher, q.options), 'Listing realms');
        return rows.ok ? ok(rows.value.map(toRealm)) : rows;
    }
    async tags(filter) {
        const q = tagsQuery(filter);
        const rows = rowsOf(await this.run(q.cypher, q.options), 'Counting realm tags');
        return rows.ok ? ok(rows.value.map((r) => ({ tag: text(r['tag']), realms: Number(r['realms'] ?? 0) || 0 })).filter((t) => t.tag)) : rows;
    }
    async hiddenExperimental(filter) {
        if (filter.experimental)
            return ok(0);
        const q = experimentalQuery(filter);
        const rows = rowsOf(await this.run(q.cypher, q.options), 'Counting experimental realms');
        return rows.ok ? ok(Number(rows.value[0]?.['hidden'] ?? 0) || 0) : rows;
    }
}
//# sourceMappingURL=realmCatalog.js.map