/*
 * THE GRAPH VIEW — a result's nodes and relationships, drawn.
 *
 * The table flattens a node to a JSON cell, which hides the one thing a graph answer has that a
 * table does not: what is joined to what. `ai.fromText` reads a sentence into a small graph, and
 * showing it as three columns of JSON makes the point of it invisible.
 *
 * LAYOUT IS d3-force's, run to rest before anything is painted rather than animated in. A settled
 * picture is the answer; watching it settle is a screensaver, and a layout computed once is the same
 * picture every time the same rows come back. The drawing is plain SVG, because React already owns
 * this DOM and a second renderer fighting it for the same nodes is how a chart ends up blank.
 *
 * What the drawing reads comes from `rowGraph` in vc — every cell walked, each entity once, ends the
 * rows never returned added as marked placeholders — so the view and any test agree on what a
 * result holds.
 */

import { forceCenter, forceCollide, forceLink, forceManyBody, forceSimulation, type SimulationNodeDatum } from 'd3-force'
import React, { useMemo, useState } from 'react'
import type { RowGraph, RowGraphEdge, RowGraphNode } from '../../../vc/index.ts'

/* Past this the picture is a hairball, and laying it out starts to cost a visible pause. The table
 * still holds every row; the view says what it left out. */
const MAX_NODES = 300
const RADIUS = 14
const TICKS = 300
const PADDING = 48
/* The smallest area a drawing is fitted into. Without it two nodes fill the panel, and their labels —
 * sized in the drawing's own units — grow to headline size and run into each other. */
const MIN_WIDTH = 640
const MIN_HEIGHT = 380
/* Long enough that a relationship's type fits between the two captions it joins. */
const LINK_DISTANCE = 170
const LABEL_OFFSET = 9

interface Placed extends SimulationNodeDatum { node: RowGraphNode; x: number; y: number }

interface Layout {
  placed: Map<string, Placed>
  edges: Array<RowGraphEdge & { bend: number }>
  box: { x: number; y: number; width: number; height: number }
}

/** Same label, same colour, across runs: a hash of the label picks one of the theme's six inks. */
function kind(node: RowGraphNode): number {
  const label = node.labels[0] ?? ''
  let hash = 0
  for (const ch of label) hash = (hash * 31 + ch.charCodeAt(0)) | 0
  return Math.abs(hash) % 6
}

/*
 * Two relationships between the same pair would be drawn on top of each other and read as one, so
 * each gets its own bend, fanned either side of the straight line.
 */
function bends(edges: RowGraphEdge[]): Array<RowGraphEdge & { bend: number }> {
  const pairOf = (e: RowGraphEdge) => [e.source, e.target].sort().join('\u0000')
  const counts = new Map<string, number>()
  edges.forEach((e) => counts.set(pairOf(e), (counts.get(pairOf(e)) ?? 0) + 1))
  const seen = new Map<string, number>()
  return edges.map((e) => {
    const pair = pairOf(e)
    const index = seen.get(pair) ?? 0
    seen.set(pair, index + 1)
    const total = counts.get(pair) ?? 1
    return { ...e, bend: (index - (total - 1) / 2) * 34 }
  })
}

function layout(graph: RowGraph): Layout {
  const nodes = graph.nodes.slice(0, MAX_NODES)
  const kept = new Set(nodes.map((n) => n.id))
  const edges = graph.edges.filter((e) => kept.has(e.source) && kept.has(e.target))
  const placed = nodes.map((node) => ({ node }) as Placed)
  const simulation = forceSimulation(placed)
    .force('link', forceLink<Placed, { source: string; target: string }>(edges.map((e) => ({ source: e.source, target: e.target })))
      .id((d) => d.node.id).distance(LINK_DISTANCE))
    .force('charge', forceManyBody().strength(-320))
    .force('center', forceCenter(0, 0))
    .force('collide', forceCollide(RADIUS * 2.6))
    .stop()
  for (let i = 0; i < TICKS; i++) simulation.tick()
  const xs = placed.map((p) => p.x)
  const ys = placed.map((p) => p.y)
  const [left, right, top, bottom] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)]
  const width = Math.max(right - left + 2 * PADDING, MIN_WIDTH)
  const height = Math.max(bottom - top + 2 * PADDING, MIN_HEIGHT)
  return {
    placed: new Map(placed.map((p) => [p.node.id, p])),
    edges: bends(edges),
    // Centred on the drawing, so a small graph sits in the middle of the panel at its own size.
    box: { x: (left + right - width) / 2, y: (top + bottom - height) / 2, width, height },
  }
}

/** The edge's path, its label's position, and an end pulled back to the target's rim for the arrow. */
function edgeGeometry(from: Placed, to: Placed, bend: number) {
  if (from === to) {
    const r = RADIUS
    return {
      d: `M ${from.x - r / 2} ${from.y - r} C ${from.x - r * 3} ${from.y - r * 4}, ${from.x + r * 3} ${from.y - r * 4}, ${from.x + r / 2} ${from.y - r}`,
      lx: from.x,
      ly: from.y - r * 3.4,
    }
  }
  const dx = to.x - from.x
  const dy = to.y - from.y
  const length = Math.hypot(dx, dy) || 1
  const cx = (from.x + to.x) / 2 - (dy / length) * bend
  const cy = (from.y + to.y) / 2 + (dx / length) * bend
  const tx = to.x - cx
  const ty = to.y - cy
  const tl = Math.hypot(tx, ty) || 1
  const ex = to.x - (tx / tl) * (RADIUS + 3)
  const ey = to.y - (ty / tl) * (RADIUS + 3)
  // The label sits just off the line, on the side it bends to, so it never strikes through the edge.
  const side = bend < 0 ? -1 : 1
  const lx = (from.x + 2 * cx + to.x) / 4 - (dy / length) * LABEL_OFFSET * side
  const ly = (from.y + 2 * cy + to.y) / 4 + (dx / length) * LABEL_OFFSET * side
  return { d: `M ${from.x} ${from.y} Q ${cx} ${cy} ${ex} ${ey}`, lx, ly }
}

const show = (value: unknown): string =>
  value == null ? '' : typeof value === 'object' ? JSON.stringify(value) : String(value)

export function ResultGraph({ graph }: { graph: RowGraph }) {
  const drawn = useMemo(() => layout(graph), [graph])
  const [selected, setSelected] = useState<string | null>(null)
  const picked = selected ? graph.nodes.find((n) => n.id === selected) ?? null : null
  const omitted = graph.nodes.length - drawn.placed.size
  const { box } = drawn

  return (
    <div className="resultgraph">
      <svg
        className="resultgraph-canvas"
        viewBox={`${box.x} ${box.y} ${box.width} ${box.height}`}
        role="img"
        aria-label={`${graph.nodes.length} node(s) and ${graph.edges.length} relationship(s)`}
        onClick={() => setSelected(null)}
      >
        <defs>
          <marker id="resultgraph-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" className="resultgraph-arrowhead" />
          </marker>
        </defs>
        {drawn.edges.map((edge) => {
          const from = drawn.placed.get(edge.source)
          const to = drawn.placed.get(edge.target)
          if (!from || !to) return null
          const { d, lx, ly } = edgeGeometry(from, to, edge.bend)
          return (
            <g className="resultgraph-edge" key={edge.id}>
              <title>{edge.type}</title>
              <path d={d} markerEnd="url(#resultgraph-arrow)" />
              {edge.type && <text x={lx} y={ly} textAnchor="middle">{edge.type}</text>}
            </g>
          )
        })}
        {[...drawn.placed.values()].map(({ node, x, y }) => (
          <g
            key={node.id}
            className={`resultgraph-node k${kind(node)}${node.placeholder ? ' is-placeholder' : ''}${selected === node.id ? ' is-selected' : ''}`}
            transform={`translate(${x} ${y})`}
            onClick={(e) => { e.stopPropagation(); setSelected(node.id) }}
          >
            <title>
              {node.placeholder
                ? 'Named by a relationship in the rows; the query did not return this node itself'
                : `${node.labels.join(':')}${node.caption && node.caption !== node.labels[0] ? ` — ${node.caption}` : ''}`}
            </title>
            <circle r={RADIUS} />
            {!node.placeholder && <text y={RADIUS + 13} textAnchor="middle">{node.caption.length > 28 ? `${node.caption.slice(0, 27)}…` : node.caption}</text>}
          </g>
        ))}
      </svg>
      <div className="resultgraph-foot">
        {picked ? (
          <div className="resultgraph-detail">
            <strong>{picked.placeholder ? 'Not returned' : picked.labels.map((l) => `:${l}`).join('')}</strong>
            {picked.placeholder
              ? <span className="hint"> — a relationship in the rows ends here, but the query did not return the node. Return it to see its properties.</span>
              : (
                <div className="resultgraph-props">
                  {Object.entries(picked.properties).map(([key, value]) => (
                    <React.Fragment key={key}>
                      <span className="resultgraph-prop">{key}</span>
                      <span className="resultgraph-value">{show(value)}</span>
                    </React.Fragment>
                  ))}
                </div>
              )}
          </div>
        ) : (
          <span className="hint">
            {graph.nodes.length} node(s), {graph.edges.length} relationship(s). Click a node for its properties.
            {omitted > 0 && ` Showing the first ${MAX_NODES}; the table has every row.`}
          </span>
        )}
      </div>
    </div>
  )
}
