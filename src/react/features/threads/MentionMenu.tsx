/*
 * WHO YOU CAN BRING INTO A THREAD, offered where you need it.
 *
 * `@mention` was the only way to reach an agent in a thread, and nothing in the thread said who
 * there was. The names live in the Agents window, so a person either knew them or left to find out
 * — and `/talk`, which lists them, is a CHAT command: typed into a thread it posts the literal text
 * "/talk". The place you most need the names was the one place that could not give them.
 *
 * IT INFORMS, IT NEVER GATES. An agent that is off or unsigned is listed, with a note, and can be
 * mentioned anyway, because the appliance already answers in the thread saying why it would not
 * take part. Deciding here instead would put that rule in two places, and the second copy is how
 * this surface broke the last time.
 */

import React, { useEffect, useState } from 'react'
import { matching } from './mentions.ts'

/**
 * An agent as the MENU needs it. The host maps its own records to this: the kit holds no opinion
 * about when an agent may be talked to, which is the appliance's to answer.
 */
export interface MentionableAgent {
  name: string
  /** One line on what it does, from the agent's own job. */
  job?: string
  /** Why it may not take part, when it may not — shown, not enforced. */
  hint?: string
}

export function MentionMenu({ agents, query, active, onPick, id }: {
  agents: readonly MentionableAgent[]
  query: string
  /** Index of the highlighted row, owned by the composer because the keys arrive there. */
  active: number
  onPick: (name: string) => void
  id: string
}) {
  const shown = matching(agents, query)
  if (shown.length === 0) return null
  return (
    <ul className="threadmentions" role="listbox" id={id} aria-label="Agents you can mention">
      {shown.map((agent, index) => (
        <li key={agent.name}>
          <button
            type="button"
            role="option"
            id={`${id}-${index}`}
            aria-selected={index === active}
            className={index === active ? 'is-active' : undefined}
            /* The textarea must keep the caret: a click that moved focus first would replace a
               mention the browser had already collapsed. */
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => onPick(agent.name)}
          >
            <strong>@{agent.name}</strong>
            {agent.job && <span className="hint">{agent.job}</span>}
            {agent.hint && <span className="pill">{agent.hint}</span>}
          </button>
        </li>
      ))}
    </ul>
  )
}

/**
 * The menu's keyboard state for one composer: which row is highlighted, kept in range as the query
 * narrows the list.
 */
export function useMentionCursor(count: number) {
  const [active, setActive] = useState(0)
  /* A list that shrinks under the cursor would otherwise leave it pointing past the end, and Enter
   * would pick nothing while looking like it would pick something. */
  useEffect(() => {
    setActive((current) => (current >= count ? 0 : current))
  }, [count])
  const move = (delta: number) => setActive((current) => (count === 0 ? 0 : (current + delta + count) % count))
  return { active, move, reset: () => setActive(0) }
}
