import React from 'react';
import type { AgentRequest, RequestStatus } from '../../../client/requests.ts';
import type { ApprovalsSurfaceProps } from '../contracts.ts';
/** An agent or routine name as a person reads it: `chase-failed-payment` is "Chase failed payment". */
export declare function displayName(slug: string): string;
/**
 * Who asked, as the card's reader sees it. A person's own held call is theirs: "You" to the person who
 * made it — today the only one shown it, as the request's owner — and their name to anyone else, as
 * the appliance words its notification. Otherwise the agent, else the routine. A person's request
 * carries the appliance's placeholder routine, which names nobody, so it is never the fallback there.
 */
export declare function askerOf(request: AgentRequest, viewer?: string): string;
/**
 * @deprecated A host built on desk draws state with desk's `Led` and the words beside it, not this
 * pill: see "Hosts built on desk" in the README. The pill is `display: flex`, so anywhere but a
 * flex row it stretches to the width of its container and reads as a text field.
 */
export declare function RequestStatusPill({ status }: {
    status: RequestStatus;
}): React.JSX.Element;
export declare function ApprovalsSurface({ services, host, focusRequest }: ApprovalsSurfaceProps): React.JSX.Element;
//# sourceMappingURL=ApprovalsSurface.d.ts.map