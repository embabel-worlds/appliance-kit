import React from 'react';
import type { AgentsServices } from '../contracts.ts';
export declare function SuggestedColleagues({ services, onOpen, onDrafted }: {
    services: AgentsServices;
    /** Open an agent's card, by name. */
    onOpen: (name: string) => void;
    /** A draft was written: the roster has a new agent to show. */
    onDrafted: (name: string) => void;
}): React.JSX.Element | null;
//# sourceMappingURL=SuggestedColleagues.d.ts.map