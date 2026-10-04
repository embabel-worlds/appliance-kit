import React from 'react';
import type { AgentsServices } from '../contracts.ts';
export declare function ReflectionSection({ name, services, onAdopted }: {
    name: string;
    services: AgentsServices;
    /** A proposal was written into the world: the agent now has unsigned changes to show. */
    onAdopted: () => void;
}): React.JSX.Element | null;
//# sourceMappingURL=ReflectionSection.d.ts.map