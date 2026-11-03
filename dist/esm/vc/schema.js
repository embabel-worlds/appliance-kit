/*
 * READING THE SCHEMA, for an editor that completes against it.
 *
 * The snapshot these work on is the SAME one the engine's preflight validates
 * against (`GET /api/v1/admin/kg/schema`), which is what lets an editor promise
 * that what it offers and what validation accepts cannot disagree. Suggesting
 * from a generic word list would break that promise quietly.
 */
/** alias -> label, parsed from the query's own `(alias:Label` patterns. */
export function aliasMap(cypher) {
    const map = {};
    for (const m of cypher.matchAll(/\(\s*(\w+)\s*:\s*(\w+)/g)) {
        if (m[1] && m[2])
            map[m[1]] = m[2];
    }
    return map;
}
/** The property names recorded for a label, or none if the schema has not seen it. */
export function propertiesOf(schema, label) {
    return propertyDetails(schema, label).map((p) => p.name);
}
/**
 * The properties recorded for a label WITH what the schema says of each — type and declared
 * description — for a completion that shows what a name means, not just the name. None if the
 * schema has not seen the label.
 */
export function propertyDetails(schema, label) {
    return schema?.labels.find((l) => l.label === label)?.properties ?? [];
}
export function labelNames(schema) {
    return schema?.labels.map((l) => l.label) ?? [];
}
/**
 * Labels that may OPEN a pattern — what the FIRST `(x:` of a MATCH offers. The engine rejects a bare
 * read of a reach-only virtual label (`anchor: false`), so offering one there completes a query the
 * preflight refuses; after an edge, every reachable label is fair and {@link connectedLabels} rules.
 * An older appliance sends no flag at all, and everything passes — no opinion, not "nothing".
 */
export function anchorLabels(schema) {
    return (schema?.labels ?? [])
        .filter((l) => l.anchor !== false)
        .map((l) => l.label)
        .sort((a, b) => a.localeCompare(b));
}
/** Relationship types, deduped and sorted — the schema lists one entry per (from, type, to) triple. */
export function relationshipTypes(schema) {
    return [...new Set(schema?.relationships.map((r) => r.type) ?? [])].sort((a, b) => a.localeCompare(b));
}
/*
 * WHICH EDGES TO OFFER after `[:`. The node on the left of the bracket, when
 * the pattern names one, already narrows the answer: `(d:Document)-[:` can only
 * usefully continue with an edge the schema has seen at Document.
 *
 * The offer degrades in tiers, and how far it falls depends on whether the
 * schema KNOWS the label:
 *
 *  - edges in the typed direction; failing that,
 *  - edges touching the label either way — the pattern may be undirected, or
 *    about to be reversed;
 *  - a label the snapshot has never heard of (or no label at all) gets the full
 *    vocabulary — there is nothing to scope BY, and sampled ≠ exhaustive;
 *  - but a KNOWN label with no edges at all offers NOTHING. Some labels really
 *    are edgeless — gov-au's Electorate joins to grants by postcode property,
 *    not by edge — and completing the whole vocabulary there dresses noise up
 *    as knowledge. Silence is the honest answer; typing past it still works,
 *    since a hint offers and never forbids.
 */
export function relationshipTypesFor(schema, label, direction = 'any') {
    if (!label || !schema?.labels.some((l) => l.label === label))
        return relationshipTypes(schema);
    const types = (dir) => dedupeSorted((schema.relationships ?? [])
        .filter((r) => (dir !== 'in' && r.from === label) || (dir !== 'out' && r.to === label))
        .map((r) => r.type));
    const scoped = types(direction);
    return scoped.length ? scoped : types('any');
}
const dedupeSorted = (xs) => [...new Set(xs)].sort((a, b) => a.localeCompare(b));
/*
 * WHICH LABELS TO OFFER at the far end of a pattern. `(n:Document)-[:MENTIONS]-(c:`
 * is not asking for every label under the sun — it is asking what a Document
 * can mention, and the schema's (from, type, to) triples answer exactly that.
 *
 * The same tiers as the edge offer, honest about what the snapshot knows:
 *
 *  - triples matching source label AND type, in the typed direction; failing
 *    that, either direction;
 *  - a typed EDGE the source has no triple for, but the schema knows elsewhere,
 *    scopes by the type alone — the sample may have missed the pairing;
 *  - a known, edgeless source with no type constraint offers nothing, for the
 *    same reason its edge offer is nothing;
 *  - otherwise — unknown source and unknown type — every label: there is
 *    nothing to scope by.
 *
 * `direction` is from the SOURCE node's perspective: 'out' means the edge
 * leaves the source toward the node being typed.
 */
export function connectedLabels(schema, label, type, direction = 'any') {
    const rels = schema?.relationships ?? [];
    const known = !!label && (schema?.labels.some((l) => l.label === label) ?? false);
    const typeKnown = !!type && rels.some((r) => r.type === type);
    const bySource = (dir) => dedupeSorted(rels.flatMap((r) => [
        ...(dir !== 'in' && r.from === label && (!type || r.type === type) ? [r.to] : []),
        ...(dir !== 'out' && r.to === label && (!type || r.type === type) ? [r.from] : []),
    ]));
    const byType = (dir) => dedupeSorted(rels.flatMap((r) => r.type === type ? [...(dir !== 'in' ? [r.to] : []), ...(dir !== 'out' ? [r.from] : [])] : []));
    if (known) {
        const exact = bySource(direction);
        if (exact.length)
            return exact;
        const either = bySource('any');
        if (either.length)
            return either;
    }
    if (typeKnown) {
        const scoped = byType(direction);
        return scoped.length ? scoped : byType('any');
    }
    if (known && !type)
        return [];
    return dedupeSorted(labelNames(schema));
}
/**
 * The node a relationship bracket is being typed against, read from the text
 * before the cursor: `(d:Document)-[` names the label outright, `(d)-[` only an
 * alias (resolved through `aliases`, from {@link aliasMap} over the whole
 * query), and `<-` reverses the direction — the edge arrives rather than
 * leaves. `-[` reads as outgoing: the arrow is not typed yet, but that is where
 * the pattern is overwhelmingly headed. Null when nothing node-shaped precedes
 * the bracket on this line — a pattern started at the `[`, or a node left on an
 * earlier line — which a caller should treat as "no opinion", not "no edges".
 */
export function edgeContext(before, aliases) {
    const m = before.match(/\(\s*(\w*)\s*(?::\s*(\w+))?\s*(?:\{[^{}]*\})?\s*\)\s*(<-|-)\s*\[[^\]]*$/);
    if (!m)
        return null;
    const label = m[2] ?? aliases[m[1] ?? ''] ?? null;
    return { label, direction: m[3] === '<-' ? 'in' : 'out' };
}
/**
 * The pattern a NODE is being typed into, read from the text before the
 * cursor: `(n:Document)-[:MENTIONS]->(c:` reports the source label, the edge
 * type when the bracket names one, and the direction from the source's
 * perspective — `->` is 'out', a leading `<-` is 'in', bare dashes are 'any'.
 * Bare `-->` / `--` connectors count too; a node with no relationship before
 * it (the pattern's first node) is null — no opinion, offer every label.
 */
export function nodeContext(before, aliases) {
    const m = before.match(/\(\s*(\w*)\s*(?::\s*(\w+))?\s*(?:\{[^{}]*\})?\s*\)\s*(<-|-)\s*(?:\[\s*\w*\s*(?::\s*(\w+))?[^\]]*\])?\s*(->|-)\s*\(\s*\w*\s*:?\s*\w*$/);
    if (!m)
        return null;
    const label = m[2] ?? aliases[m[1] ?? ''] ?? null;
    const direction = m[3] === '<-' ? 'in' : m[5] === '->' ? 'out' : 'any';
    return { label, type: m[4] ?? null, direction };
}
/**
 * The node whose property MAP is being typed — `(c:Concept {` names the label
 * outright, `(c {` only an alias — so a completer can offer the KEYS that
 * label actually has. `used` is the keys the map already binds: a map is a
 * conjunction of equalities, and binding the same key twice is never meant.
 *
 * Null when the cursor is not at a key position of a node's map: inside a
 * string value, right after a `:` (that is a VALUE being typed), or in a map
 * that does not belong to a node — an edge's `{via:…}` or `ai:{…}` has its own
 * vocabulary, not the schema's.
 */
export function propertyMapContext(before, aliases) {
    const m = before.match(/\(\s*(\w*)\s*(?::\s*(\w+))?\s*\{([^{}]*?)(\w*)$/);
    if (!m)
        return null;
    const body = m[3] ?? '';
    if ((body.split("'").length - 1) % 2)
        return null;
    if (/:\s*$/.test(body))
        return null;
    const label = m[2] ?? aliases[m[1] ?? ''] ?? null;
    return { label, used: [...body.matchAll(/(\w+)\s*:/g)].flatMap((k) => (k[1] ? [k[1]] : [])) };
}
/*
 * HOW A REACH-ONLY LABEL IS REACHED.
 *
 * A label the engine marks `anchor: false` cannot open a MATCH — `MATCH (r:ConfigRun)` is refused —
 * and the schema already says the way in: an edge to it from a label that CAN open one. For the
 * config catalog that is `(me:AssistantUser)-[:HAS_CONFIG]->(r:ConfigRun)`. These read that answer
 * off the schema so completion can offer the anchored form and hover can say it, rather than leaving
 * a person to learn it from a refusal.
 */
/**
 * The label a person's own anchor carries: the caller, bound by their sign-in, which a pattern
 * writes `(me:AssistantUser)` with no id. The engine's name for it, as the composer writes it.
 */
export const USER_ANCHOR = 'AssistantUser';
/**
 * The doors into [label] — empty for a label that may open a pattern itself (or that the schema
 * does not know), since it needs none. The user anchor's doors come first: it needs no pinning, so
 * it is the way in a person can always write.
 */
export function labelDoors(schema, label) {
    const labels = schema?.labels ?? [];
    const target = labels.find((l) => l.label === label);
    if (!target || target.anchor !== false)
        return [];
    const opens = new Set(labels.filter((l) => l.anchor !== false).map((l) => l.label));
    const seen = new Set();
    const doors = [];
    for (const r of schema?.relationships ?? []) {
        const door = r.to === label && r.from !== label && opens.has(r.from) ? { anchor: r.from, type: r.type, direction: 'out', description: r.description }
            : r.from === label && r.to !== label && opens.has(r.to) ? { anchor: r.to, type: r.type, direction: 'in', description: r.description }
                : null;
        const key = door && `${door.anchor}|${door.type}|${door.direction}`;
        if (door && key && !seen.has(key)) {
            seen.add(key);
            doors.push(door);
        }
    }
    const rank = (d) => (d.anchor === USER_ANCHOR ? 0 : 1);
    return doors.sort((a, b) => rank(a) - rank(b) || a.anchor.localeCompare(b.anchor) || a.type.localeCompare(b.type));
}
/**
 * [door] written as a pattern a person can type: `(me:AssistantUser)-[:HAS_CONFIG]->(r:ConfigRun)`.
 * [variable] is the reach-only node's; the anchor's is `me` for the user anchor (it IS you) and its
 * initial otherwise, never the same as [variable]. An empty [variable] stays empty — `(:ConfigRun)`.
 */
export function anchoredPattern(door, label, variable = '') {
    const preferred = door.anchor === USER_ANCHOR ? 'me' : door.anchor.charAt(0).toLowerCase();
    const anchorVar = preferred === variable ? `${preferred}2` : preferred;
    const anchor = `(${anchorVar}:${door.anchor})`;
    const node = `(${variable}:${label})`;
    return door.direction === 'out' ? `${anchor}-[:${door.type}]->${node}` : `${node}-[:${door.type}]->${anchor}`;
}
/**
 * What a label means, for completion and hover: its declared definition, then — for a reach-only
 * label — how it is reached. Empty when the schema has nothing to say.
 */
export function labelDoc(schema, label) {
    const described = schema?.labels.find((l) => l.label === label)?.description?.trim() ?? '';
    const doors = labelDoors(schema, label);
    if (!doors.length)
        return described;
    const variable = label.charAt(0).toLowerCase();
    const ways = doors.slice(0, 3).map((d) => anchoredPattern(d, label, variable));
    const more = doors.length > 3 ? ` (and ${doors.length - 3} more)` : '';
    const reach = `Reached only from an anchor — MATCH (${variable}:${label}) alone is refused. Write ${ways.join(' or ')}${more}.`;
    return described ? `${described}\n\n${reach}` : reach;
}
/** A property's type and description, as one line for completion and hover: `string — When it ran…`. */
export function propertyDoc(property) {
    const type = property.type && property.type !== 'any' ? property.type : '';
    return [type, propertyDescription(property)].filter(Boolean).join(' — ');
}
/**
 * A property's description when it says something. An appliance before embabel/me#3525 described an
 * undocumented property by its own name — `runId` as "runId" — which reads as documentation and is
 * none, so it is dropped rather than shown.
 */
export function propertyDescription(property) {
    const described = property.description?.trim() ?? '';
    return described.toLowerCase() === property.name.toLowerCase() ? '' : described;
}
/**
 * What a relationship type means. With both ends known, that edge's own declaration; otherwise the
 * ends it joins, and its description when every triple of that type shares one.
 */
export function relationshipDoc(schema, type, from, to) {
    const triples = (schema?.relationships ?? []).filter((r) => r.type === type);
    if (!triples.length)
        return '';
    const exact = triples.find((r) => r.from === from && r.to === to) ?? triples.find((r) => r.to === from && r.from === to);
    if (exact)
        return [`(:${exact.from})-[:${type}]->(:${exact.to})`, exact.description?.trim()].filter(Boolean).join('\n');
    const scoped = from ? triples.filter((r) => r.from === from || r.to === from) : triples;
    const pool = scoped.length ? scoped : triples;
    const ends = dedupeSorted(pool.map((r) => `(:${r.from})-[:${type}]->(:${r.to})`));
    const shown = ends.slice(0, 4).join('\n') + (ends.length > 4 ? `\n… and ${ends.length - 4} more` : '');
    const shared = new Set(pool.map((r) => r.description?.trim() ?? ''));
    const description = shared.size === 1 ? [...shared][0] : '';
    return [shown, description].filter(Boolean).join('\n');
}
/**
 * The documentation for the token under the cursor, or null when it names nothing the schema
 * knows. [word] is the token as the cypher mode cuts it (`r:ConfigRun` is one atom, `:HAS_CONFIG`
 * another), [lineBefore] the line's text before the token, and [cypher] the whole query, which is
 * where aliases are declared.
 *
 * In order: a relationship type (the token sits inside `[…]`), a label or an alias of one, then a
 * property after `alias.`. One function, so every editor that hovers answers the same way.
 */
export function tokenDoc(schema, word, lineBefore, cypher) {
    if (!schema || !word)
        return null;
    const aliases = aliasMap(cypher);
    const name = word.includes(':') ? word.slice(word.lastIndexOf(':') + 1) : word;
    // Inside an open bracket: a relationship type. Its ends are the nodes either side, when written.
    if (/\[[^\]]*$/.test(lineBefore) && schema.relationships.some((r) => r.type === name)) {
        const left = edgeContext(lineBefore + word, aliases);
        const after = cypher.slice(cypher.indexOf(lineBefore + word) + (lineBefore + word).length);
        const right = after.match(/^[^\]]*\]\s*-?>?\s*\(\s*(\w*)\s*(?::\s*(\w+))?/);
        const rightLabel = right ? (right[2] ?? aliases[right[1] ?? ''] ?? null) : null;
        const leftLabel = left?.label ?? null;
        const [from, to] = left?.direction === 'in' ? [rightLabel, leftLabel] : [leftLabel, rightLabel];
        return { title: `:${name}`, text: relationshipDoc(schema, name, from, to) };
    }
    const resolved = schema.labels.some((l) => l.label === name) ? name : aliases[name];
    const label = schema.labels.find((l) => l.label === resolved);
    if (label)
        return { title: label.label, text: labelDoc(schema, label.label), label };
    const owner = lineBefore.match(/(\w+)\.$/);
    const ownerLabel = owner ? aliases[owner[1] ?? ''] : undefined;
    const property = ownerLabel ? propertyDetails(schema, ownerLabel).find((p) => p.name === word) : undefined;
    if (property && ownerLabel) {
        const text = propertyDoc(property);
        return text ? { title: `${ownerLabel}.${property.name}`, text } : null;
    }
    return null;
}
//# sourceMappingURL=schema.js.map