"use strict";
/*
 * RESULT ROWS, SERIALIZED — the copy buttons every results panel grows.
 *
 * Column order is the union of keys in first-seen row order: the SAME rule the
 * results table renders with, so what you copy is what you saw. Values follow
 * the table too — null paints empty, objects paint as JSON, everything else as
 * its string.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.rowColumns = rowColumns;
exports.rowsToMarkdown = rowsToMarkdown;
exports.rowsToCsv = rowsToCsv;
exports.rowGraph = rowGraph;
function rowColumns(rows) {
    const columns = [];
    for (const row of rows)
        for (const key of Object.keys(row))
            if (!columns.includes(key))
                columns.push(key);
    return columns;
}
const cell = (value) => value == null ? '' : typeof value === 'object' ? JSON.stringify(value) : String(value);
/**
 * A GitHub-flavoured Markdown table. Pipes are escaped; newlines flatten to a
 * space — a Markdown cell has no way to hold one, and a broken row is worse
 * than a joined line.
 */
function rowsToMarkdown(rows) {
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
function rowsToCsv(rows) {
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
const ownProperties = (value) => Object.fromEntries(Object.entries(value).filter(([key]) => !key.startsWith('__')));
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
function rowGraph(rows) {
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