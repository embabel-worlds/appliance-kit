/*
 * RESULT ROWS, SERIALIZED — the copy buttons every results panel grows.
 *
 * Column order is the union of keys in first-seen row order: the SAME rule the
 * results table renders with, so what you copy is what you saw. Values follow
 * the table too — null paints empty, objects paint as JSON, everything else as
 * its string, and a node or relationship as its own properties (see
 * INTERNAL_PROPERTIES and LABEL_INTERNAL_PROPERTIES).
 */
/*
 * PROPERTIES THAT ARE THE APPLIANCE'S BOOKKEEPING, NOT THE ENTITY'S DATA — hidden wherever the kit
 * shows a node's or relationship's properties: the graph view's panel, a results table's entity
 * cell, and what Copy writes from one.
 *
 * `userId`, `worldId`, `workspaceId` and `visibleTo` are the tenancy stamps the scope rewriter
 * filters on; every node a person can see carries their own, so they say nothing about the node.
 * `extractedBy` names the model role that produced an extracted node, which is how the appliance
 * traces it, not what the text said. A key starting `__` describes the entity rather than holding
 * its data: `__elementId`, `__labels`, `__type`, a relationship's ends.
 *
 * A list here because the studio schema does not mark them: its properties say name, type,
 * description and identity, nothing about who reads them. When it does, this should read that
 * marking instead. Only entities are filtered — a column somebody projected by name
 * (`RETURN n.userId AS owner`) is their question, and is shown. The Raw view shows everything.
 */
export const INTERNAL_PROPERTIES = new Set([
    'userId', 'worldId', 'workspaceId', 'visibleTo', 'extractedBy',
]);
/*
 * PROPERTIES THAT ARE BOOKKEEPING ONLY ON NODES OF ONE LABEL — the same rule as INTERNAL_PROPERTIES,
 * for keys that are real data elsewhere and so cannot be hidden on every node.
 *
 * `AssistantUser` is the signed-in person's own node, and most of what it carries is the account's
 * configuration: where its world lives on the host and what it is called, which context is current,
 * whether greetings and hints are on. The list is the server's, not a guess — the MCP surface's
 * sanitizer strips these same keys from a whole AssistantUser node before a model sees it (its
 * "AssistantUser internal config" group, with `currentContextName` and `contextId` from its tenancy
 * group). `id` is added here: on this label it is the account key that every node's `userId` stamp
 * repeats, already hidden above. On most other nodes `id` and `username` are the data (`hobby:tennis`),
 * which is why this is keyed by label rather than added to the global list.
 *
 * A node matches when ANY of its labels is listed: AssistantUser also carries Person and User, and
 * a node that is the account is the account whatever else it is.
 */
export const LABEL_INTERNAL_PROPERTIES = {
    AssistantUser: new Set([
        'id', 'username', 'worldBase', 'worldName', 'workspaceBase', 'workspaceName',
        'currentContextName', 'contextId', 'greetingEnabled', 'hintsEnabled',
    ]),
};
/**
 * Whether [key] is bookkeeping rather than an entity's data, on an entity carrying [labels]. See
 * INTERNAL_PROPERTIES and LABEL_INTERNAL_PROPERTIES; with no labels only the global rule applies.
 */
export function isInternalProperty(key, labels = []) {
    return key.startsWith('__') || INTERNAL_PROPERTIES.has(key)
        || labels.some((label) => LABEL_INTERNAL_PROPERTIES[label]?.has(key) ?? false);
}
/** A node or relationship as the studio returns it: it carries an element id or labels. */
export function isEntity(value) {
    return value != null && typeof value === 'object' && !Array.isArray(value)
        && ('__elementId' in value || Array.isArray(value['__labels']));
}
/** An entity's own properties, without the bookkeeping. */
export function entityProperties(value) {
    const labels = Array.isArray(value['__labels'])
        ? value['__labels'].filter((l) => typeof l === 'string')
        : [];
    return Object.fromEntries(Object.entries(value).filter(([key]) => !isInternalProperty(key, labels)));
}
/**
 * A value as the table shows it: every entity in it — a cell, a list, a path, a map holding one —
 * reduced to its own properties. Anything else is returned as it came.
 */
export function shownValue(value) {
    if (Array.isArray(value))
        return value.map(shownValue);
    if (isEntity(value))
        return entityProperties(value);
    if (value != null && typeof value === 'object') {
        return Object.fromEntries(Object.entries(value).map(([key, inner]) => [key, shownValue(inner)]));
    }
    return value;
}
export function rowColumns(rows) {
    const columns = [];
    for (const row of rows)
        for (const key of Object.keys(row))
            if (!columns.includes(key))
                columns.push(key);
    return columns;
}
const cell = (value) => value == null ? '' : typeof value === 'object' ? JSON.stringify(shownValue(value)) : String(value);
/**
 * A GitHub-flavoured Markdown table. Pipes are escaped; newlines flatten to a
 * space — a Markdown cell has no way to hold one, and a broken row is worse
 * than a joined line.
 */
export function rowsToMarkdown(rows) {
    const columns = rowColumns(rows);
    if (!columns.length)
        return '';
    const md = (value) => cell(value).replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
    return [
        `| ${columns.map(md).join(' | ')} |`,
        `| ${columns.map(() => '---').join(' | ')} |`,
        ...rows.map((row) => `| ${columns.map((column) => md(row[column])).join(' | ')} |`),
    ].join('\n');
}
/** RFC 4180-shaped CSV: a field holding comma, quote or newline is quoted, quotes double. */
export function rowsToCsv(rows) {
    const columns = rowColumns(rows);
    if (!columns.length)
        return '';
    const csv = (value) => {
        const s = cell(value);
        return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    return [columns, ...rows.map((row) => columns.map((column) => row[column]))]
        .map((values) => values.map(csv).join(','))
        .join('\n');
}
const CAPTION_KEYS = ['name', 'title', 'displayName', 'label', 'subject', 'key', 'id', 'code'];
const isRecord = (value) => value != null && typeof value === 'object' && !Array.isArray(value);
const isNode = (value) => typeof value['__elementId'] === 'string' && Array.isArray(value['__labels']);
const isRelationship = (value) => typeof value['__elementId'] === 'string'
    && typeof value['__startElementId'] === 'string'
    && typeof value['__endElementId'] === 'string';
const ownProperties = (value) => entityProperties(value);
function caption(labels, properties) {
    for (const key of CAPTION_KEYS) {
        const value = properties[key];
        if (typeof value === 'string' && value.trim())
            return value;
        if (typeof value === 'number')
            return String(value);
    }
    return labels[0] ?? 'node';
}
export function rowGraph(rows) {
    const nodes = new Map();
    const edges = new Map();
    const visit = (value) => {
        if (Array.isArray(value))
            return value.forEach(visit);
        if (!isRecord(value))
            return;
        if (isNode(value)) {
            const id = value['__elementId'];
            const labels = value['__labels'].filter((l) => typeof l === 'string');
            const properties = ownProperties(value);
            // A placeholder made for an edge's end is replaced by the node itself when the rows hold it.
            if (nodes.get(id)?.placeholder ?? true) {
                nodes.set(id, { id, labels, caption: caption(labels, properties), properties, placeholder: false });
            }
            return;
        }
        if (isRelationship(value)) {
            const id = value['__elementId'];
            if (!edges.has(id)) {
                edges.set(id, {
                    id,
                    type: typeof value['__type'] === 'string' ? value['__type'] : '',
                    source: value['__startElementId'],
                    target: value['__endElementId'],
                    properties: ownProperties(value),
                });
            }
            return;
        }
        Object.values(value).forEach(visit);
    };
    rows.forEach((row) => Object.values(row).forEach(visit));
    for (const edge of edges.values()) {
        for (const end of [edge.source, edge.target]) {
            if (!nodes.has(end))
                nodes.set(end, { id: end, labels: [], caption: '', properties: {}, placeholder: true });
        }
    }
    return { nodes: [...nodes.values()], edges: [...edges.values()] };
}
//# sourceMappingURL=rows.js.map