import React from 'react';
import type { Agent, AgentStage } from '../../../client/agents.ts';
import type { AgentsSurfaceProps } from '../contracts.ts';
/** The highest stage any routine actually fires at: what the agent is doing, in one pill. */
export declare function firingOf(agent: Agent): AgentStage;
/**
 * @deprecated A host built on desk draws state with desk's `Led` and the words beside it, not this
 * pill: see "Hosts built on desk" in the README. The pill is `display: flex`, so anywhere but a
 * flex row it stretches to the width of its container and reads as a text field.
 */
export declare function StagePill({ stage }: {
    stage: AgentStage;
}): React.JSX.Element;
export declare function AgentsSurface({ services, host, initialAgent }: AgentsSurfaceProps): React.JSX.Element;
//# sourceMappingURL=AgentsSurface.d.ts.map