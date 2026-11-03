/*
 * STARTER QUERIES — a few cards over the empty editor, each showing one thing the query language
 * can do, that run when clicked.
 *
 * An empty editor teaches nothing. Somebody new to the studio does not yet know that a WHERE can be
 * written in English, that a sentence can be read into a graph, or that the world's own runs and
 * realms are data like any other — and a placeholder cannot show them. A card can, because clicking
 * it puts the query in the editor AND runs it, so the query and its answer arrive together and the
 * next step is to change something and run it again.
 *
 * WHAT THE CARDS ARE is the world's: default-world ships a set, a world or a realm adds its own,
 * and the appliance says whether this person still needs them offered (`show`). It stops offering
 * them once they dismiss them, save a view of their own, or have written a handful of queries in the
 * studio. Examples, beside Help, brings them back on request either way.
 *
 * Each card says what it demonstrates in one line, and whether it asks a model (`AI`) — which costs
 * model calls — or is plain Cypher over what the world holds.
 */

import { Sparkle, X } from '@phosphor-icons/react'
import React from 'react'
import type { KgQueryExample } from '../../../client/kg.ts'

export function QueryExampleCards({
  examples,
  requested,
  onRun,
  onClose,
  onDismiss,
}: {
  examples: KgQueryExample[]
  /** Opened from the Examples button, rather than offered over an empty editor. */
  requested: boolean
  onRun(example: KgQueryExample): void
  onClose(): void
  /** Stop offering them unasked; absent when the appliance cannot record that. */
  onDismiss?(): void
}) {
  return (
    <section className="query-examples" aria-label="Example queries">
      <header className="query-examples-head">
        <span className="query-examples-title">Try an example — click one to run it</span>
        {requested || !onDismiss
          ? (
            <button className="btn ghost tiny" onClick={onClose} aria-label="Close examples" title="Close examples">
              <X size={14} weight="bold" aria-hidden="true" />
            </button>
          )
          : (
            <button className="btn ghost tiny" onClick={onDismiss} title="Examples stays beside Help, to bring them back">
              Don't show these again
            </button>
          )}
      </header>
      <div className="query-examples-grid">
        {examples.map((example) => (
          <button
            key={example.id}
            className={`query-example is-${example.kind}`}
            onClick={() => onRun(example)}
            title={example.cypher}
          >
            <span className="query-example-top">
              <strong>{example.title}</strong>
              <span className={`viewtag query-example-kind is-${example.kind}`}>
                {example.kind === 'ai' && <Sparkle size={11} weight="fill" aria-hidden="true" />}
                {example.kind === 'ai' ? 'AI' : 'Cypher'}
              </span>
            </span>
            <span className="query-example-line">{example.description}</span>
            {example.source && <span className="query-example-source">from {example.source}</span>}
          </button>
        ))}
      </div>
    </section>
  )
}
