import React from 'react';
import type { RequestStatus } from '../../../client/requests.ts';
import type { ApprovalsSurfaceProps } from '../contracts.ts';
/** An agent or routine name as a person reads it: `chase-failed-payment` is "Chase failed payment". */
export declare function displayName(slug: string): string;
/**
 * @deprecated A host built on desk draws state with desk's `Led` and the words beside it, not this
 * pill: see "Hosts built on desk" in the README. The pill is `display: flex`, so anywhere but a
 * flex row it stretches to the width of its container and reads as a text field.
 */
export declare function RequestStatusPill({ status }: {
    status: RequestStatus;
}): React.JSX.Element;
export declare function ApprovalsSurface({ services, host }: ApprovalsSurfaceProps): React.JSX.Element;
//# sourceMappingURL=ApprovalsSurface.d.ts.map