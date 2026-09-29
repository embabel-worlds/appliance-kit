import React from 'react';
import type { Agent, AgentStage } from '../../../client/agents.ts';
import type { AgentsSurfaceProps } from '../contracts.ts';
/** The highest stage any routine actually fires at: what the agent is doing, in one pill. */
export declare function firingOf(agent: Agent): AgentStage;
export declare function StagePill({ stage }: {
    stage: AgentStage;
}): React.JSX.Element;
export declare function AgentsSurface({ services, host, initialAgent }: AgentsSurfaceProps): React.JSX.Element;
//# sourceMappingURL=AgentsSurface.d.ts.map