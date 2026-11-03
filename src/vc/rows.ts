/*
 * RESULT ROWS, SERIALIZED — the copy buttons every results panel grows.
 *
 * Column order is the union of keys in first-seen row order: the SAME rule the
 * results table renders with, so what you copy is what you saw. Values follow
 * the table too — null paints empty, objects paint as JSON, everything else as
 * its string, and a node or relationship as its own properties (see
 * INTERNAL_PROPERTIES).
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
export const INTERNAL_PROPERTIES: ReadonlySet<string> = new Set([
  'userId', 'worldId', 'workspaceId', 'visibleTo', 'extractedBy',
])

/** Whether [key] is bookkeeping rather than an entity's data. See INTERNAL_PROPERTIES. */
export function isInternalProperty(key: string): boolean {
  return key.startsWith('__') || INTERNAL_PROPERTIES.has(key)
}

/** A node or relationship as the studio returns it: it carries an element id or labels. */
export function isEntity(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === 'object' && !Array.isArray(value)
    && ('__elementId' in value || Array.isArray((value as Record<string, unknown>)['__labels']))
}

/** An entity's own properties, without the bookkeeping. */
export function entityProperties(value: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(value).filter(([key]) => !isInternalProperty(key)))
}

/**
 * A value as the table shows it: every entity in it — a cell, a list, a path, a map holding one —
 * reduced to its own properties. Anything else is returned as it came.
 */
export function shownValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(shownValue)
  if (isEntity(value)) return entityProperties(value)
  if (value != null && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, inner]) => [key, shownValue(inner)]))
  }
  return value
}

export function rowColumns(rows: Array<Record<string, unknown>>): string[] {
  const columns: string[] = []
  for (const row of rows) for (const key of Object.keys(row)) if (!columns.includes(key)) columns.push(key)
  return columns
}

const cell = (value: unknown): string =>
  value == null ? '' : typeof value === 'object' ? JSON.stringify(shownValue(value)) : String(value)

/**
 * A GitHub-flavoured Markdown table. Pipes are escaped; newlines flatten to a
 * space — a Markdown cell has no way to hold one, and a broken row is worse
 * than a joined line.
 */
export function rowsToMarkdown(rows: Array<Record<string, unknown>>): string {
  const columns = rowColumns(rows)
  if (!columns.length) return ''
  const md = (value: unknown) => cell(value).replace(/\|/g, '\\|').replace(/\r?\n/g, ' ')
  return [
    `| ${columns.map(md).join(' | ')} |`,
    `| ${columns.map(() => '---').join(' | ')} |`,
    ...rows.map((row) => `| ${columns.map((column) => md(row[column])).join(' | ')} |`),
  ].join('\n')
}

/** RFC 4180-shaped CSV: a field holding comma, quote or newline is quoted, quotes double. */
export function rowsToCsv(rows: Array<Record<string, unknown>>): string {
  const columns = rowColumns(rows)
  if (!columns.length) return ''
  const csv = (value: unknown) => {
    const s = cell(value)
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  return [columns, ...rows.map((row) => columns.map((column) => row[column]))]
    .map((values) => values.map(csv).join(','))
    .join('\n')
}

/*
 * RESULT ROWS, DRAWN — the nodes and relationships a result holds, for the graph view.
 *
 * The studio's execute answers entities a client can draw: a node carries `__elementId` and
 * `__labels`, a relationship `__elementId`, `__type`, `__startElementId` and `__endElementId`, and a
 * path is a list of both in traversal order. Anything else is a value and is not drawn.
 *
 * EVERY CELL IS WALKED, lists and nested maps included, because an entity can sit anywhere a value
 * can: `collect(n)`, a path, a map projection holding a node. Each is kept once, by its element id —
 * the same node returned on forty rows is one node.
 *
 * A RELATIONSHIP WHOSE END IS NOT IN THE ROWS still names it (`RETURN r` alone does), so that end is
 * added as a placeholder: drawn, so the edge has somewhere to go, and marked, so nobody reads it as
 * a node the query returned.
 */

export interface RowGraphNode {
  id: string
  labels: string[]
  /** What to write on it: a name-like property when it has one, else its first label. */
  caption: string
  /** Its properties, without the bookkeeping (INTERNAL_PROPERTIES). */
  properties: Record<string, unknown>
  /** Only named as a relationship's end; the rows did not return it. */
  placeholder: boolean
}

export interface RowGraphEdge {
  id: string
  type: string
  source: string
  target: string
  properties: Record<string, unknown>
}

export interface RowGraph {
  nodes: RowGraphNode[]
  edges: RowGraphEdge[]
}

const CAPTION_KEYS = ['name', 'title', 'displayName', 'label', 'subject', 'key', 'id', 'code']

type Entity = Record<string, unknown>

const isRecord = (value: unknown): value is Entity =>
  value != null && typeof value === 'object' && !Array.isArray(value)

const isNode = (value: Entity): boolean =>
  typeof value['__elementId'] === 'string' && Array.isArray(value['__labels'])

const isRelationship = (value: Entity): boolean =>
  typeof value['__elementId'] === 'string'
  && typeof value['__startElementId'] === 'string'
  && typeof value['__endElementId'] === 'string'

const ownProperties = (value: Entity): Record<string, unknown> => entityProperties(value)

function caption(labels: string[], properties: Record<string, unknown>): string {
  for (const key of CAPTION_KEYS) {
    const value = properties[key]
    if (typeof value === 'string' && value.trim()) return value
    if (typeof value === 'number') return String(value)
  }
  return labels[0] ?? 'node'
}

export function rowGraph(rows: Array<Record<string, unknown>>): RowGraph {
  const nodes = new Map<string, RowGraphNode>()
  const edges = new Map<string, RowGraphEdge>()

  const visit = (value: unknown): void => {
    if (Array.isArray(value)) return value.forEach(visit)
    if (!isRecord(value)) return
    if (isNode(value)) {
      const id = value['__elementId'] as string
      const labels = (value['__labels'] as unknown[]).filter((l): l is string => typeof l === 'string')
      const properties = ownProperties(value)
      // A placeholder made for an edge's end is replaced by the node itself when the rows hold it.
      if (nodes.get(id)?.placeholder ?? true) {
        nodes.set(id, { id, labels, caption: caption(labels, properties), properties, placeholder: false })
      }
      return
    }
    if (isRelationship(value)) {
      const id = value['__elementId'] as string
      if (!edges.has(id)) {
        edges.set(id, {
          id,
          type: typeof value['__type'] === 'string' ? value['__type'] : '',
          source: value['__startElementId'] as string,
          target: value['__endElementId'] as string,
          properties: ownProperties(value),
        })
      }
      return
    }
    Object.values(value).forEach(visit)
  }
  rows.forEach((row) => Object.values(row).forEach(visit))

  for (const edge of edges.values()) {
    for (const end of [edge.source, edge.target]) {
      if (!nodes.has(end)) nodes.set(end, { id: end, labels: [], caption: '', properties: {}, placeholder: true })
    }
  }
  return { nodes: [...nodes.values()], edges: [...edges.values()] }
}
