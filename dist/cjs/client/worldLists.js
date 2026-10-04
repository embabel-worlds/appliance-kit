"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.WorldLists = exports.QUERIES = void 0;
const outcome_ts_1 = require("./outcome.js");
exports.QUERIES = {
    skippedApis: 'MATCH (me:AssistantUser)-[:HAS_CONFIG]->(a:ConfigSkippedApi) ' +
        'RETURN a.name AS name, a.reason AS reason, a.unlockedBy AS unlockedBy ORDER BY name',
    signalTypes: 'MATCH (me:AssistantUser)-[:HAS_CONFIG]->(s:ConfigSignalType) ' +
        'RETURN s.typeName AS typeName, s.fields AS fields, s.count AS count, s.lastSeen AS lastSeen ORDER BY typeName',
    skills: 'MATCH (me:AssistantUser)-[:HAS_CONFIG]->(s:ConfigSkill) ' +
        'RETURN s.name AS name, s.description AS description ORDER BY name',
    watches: 'MATCH (me:AssistantUser)-[:HAS_CONFIG]->(w:ConfigWatch) ' +
        'RETURN w.id AS id, w.name AS name, w.subject AS subject, w.schedule AS schedule, w.channel AS channel, w.enabled AS enabled ORDER BY name',
    documentTags: 'MATCH (d:Document) UNWIND d.tags AS tag RETURN tag, count(DISTINCT d) AS documents ORDER BY documents DESC, tag',
    agentHolding: 'MATCH (me:AssistantUser)-[:HAS_AGENT]->(a:Agent)-[:HOLDS]->(r:Routine) WHERE r.name = $routine ' +
        'RETURN a.name AS agent LIMIT 1',
};
const text = (v) => (typeof v === 'string' ? v : v == null ? '' : String(v));
const count = (v) => Number(v ?? 0) || 0;
/* A list is not worth parking in the background: a run that did not answer here is a failure the
 * host can retry, never an empty list. */
function rowsOf(outcome, what) {
    if (!outcome.ok)
        return outcome;
    const value = outcome.value;
    if (!('rows' in value))
        return (0, outcome_ts_1.failure)('failed', `${what} is still running in the background`, undefined, { background: true });
    if (value.error)
        return (0, outcome_ts_1.failure)('refused', `${what}: ${value.error}`);
    return (0, outcome_ts_1.ok)((value.rows ?? []));
}
class WorldLists {
    run;
    constructor(run) {
        this.run = run;
    }
    async rows(what, cypher, options) {
        return rowsOf(await this.run(cypher, options), what);
    }
    async skippedApis() {
        const r = await this.rows('Listing skipped APIs', exports.QUERIES.skippedApis);
        return r.ok ? (0, outcome_ts_1.ok)(r.value.map((x) => ({ name: text(x['name']), reason: text(x['reason']), unlockedBy: text(x['unlockedBy']) }))) : r;
    }
    async signalTypes() {
        const r = await this.rows('Listing signal types', exports.QUERIES.signalTypes);
        /* The label carries the fields as one comma-joined string; the surface wants the list. */
        const fields = (v) => Array.isArray(v) ? v.map(text).filter(Boolean) : text(v).split(',').map((f) => f.trim()).filter(Boolean);
        return r.ok
            ? (0, outcome_ts_1.ok)(r.value.map((x) => ({ typeName: text(x['typeName']), fields: fields(x['fields']), count: count(x['count']), lastSeen: text(x['lastSeen']) })))
            : r;
    }
    async skills() {
        const r = await this.rows('Listing skills', exports.QUERIES.skills);
        return r.ok ? (0, outcome_ts_1.ok)(r.value.map((x) => ({ name: text(x['name']), description: text(x['description']) }))) : r;
    }
    async watches() {
        const r = await this.rows('Listing watches', exports.QUERIES.watches);
        return r.ok
            ? (0, outcome_ts_1.ok)(r.value.map((x) => ({
                id: text(x['id']),
                lensId: text(x['subject']),
                name: text(x['name']),
                cron: text(x['schedule']) || null,
                enabled: x['enabled'] === true,
                delivery: text(x['channel']) ? { channel: text(x['channel']) } : null,
            })))
            : r;
    }
    async documentTags() {
        const r = await this.rows('Listing document tags', exports.QUERIES.documentTags);
        return r.ok ? (0, outcome_ts_1.ok)(r.value.map((x) => ({ tag: text(x['tag']), documents: count(x['documents']) })).filter((t) => t.tag)) : r;
    }
    /** The agent that holds [routine], or null when none does. */
    async agentHolding(routine) {
        const params = {
            routine: { type: 'string', default: '', description: 'The routine whose agent is wanted' },
        };
        const r = await this.rows('Finding the agent that holds a routine', exports.QUERIES.agentHolding, { params, args: { routine } });
        return r.ok ? (0, outcome_ts_1.ok)(text(r.value[0]?.['agent']) || null) : r;
    }
}
exports.WorldLists = WorldLists;
//# sourceMappingURL=worldLists.js.map