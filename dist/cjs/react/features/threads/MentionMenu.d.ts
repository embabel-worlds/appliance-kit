import React from 'react';
/**
 * An agent as the MENU needs it. The host maps its own records to this: the kit holds no opinion
 * about when an agent may be talked to, which is the appliance's to answer.
 */
export interface MentionableAgent {
    name: string;
    /** One line on what it does, from the agent's own job. */
    job?: string;
    /** Why it may not take part, when it may not — shown, not enforced. */
    hint?: string;
}
export declare function MentionMenu({ agents, query, active, onPick, id }: {
    agents: readonly MentionableAgent[];
    query: string;
    /** Index of the highlighted row, owned by the composer because the keys arrive there. */
    active: number;
    onPick: (name: string) => void;
    id: string;
}): React.JSX.Element | null;
/**
 * The menu's keyboard state for one composer: which row is highlighted, kept in range as the query
 * narrows the list.
 */
export declare function useMentionCursor(count: number): {
    active: number;
    move: (delta: number) => void;
    reset: () => void;
};
//# sourceMappingURL=MentionMenu.d.ts.map