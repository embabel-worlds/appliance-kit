import React from 'react';
import type { QueryStudioSurfaceProps } from '../contracts.ts';
/**
 * @param handedOver cypher arriving from another tab (a view expanded in Views), landed once. A
 *   changing value lands again; null never clobbers what is already in the editor.
 */
export declare function QueryStudioSurface({ services, host, handedOver }: QueryStudioSurfaceProps): React.JSX.Element;
/**
 * Save the query in the editor as a named view. Writing one belongs HERE, next to the thing being
 * written; browsing and running them is the Views tab.
 *
 * The APPLIANCE persists it — a console never edits world YAML itself, so what is stored is what
 * the server validated.
 */
export declare function SaveView({ current }: {
    current(): string;
}): React.JSX.Element;
//# sourceMappingURL=QueryStudioSurface.d.ts.map