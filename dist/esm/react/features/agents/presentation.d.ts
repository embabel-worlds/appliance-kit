import type { Agent } from '../../../client/agents.ts';
export type AgentPresentation = 'conversational' | 'worker';
export declare function presentationOf(agent: Agent): AgentPresentation;
/**
 * Why a conversational agent cannot be talked to right now, in a sponsor's words; empty when it can.
 * It needs four things, all already on the agent: a signed version, a sponsor, to be active, and not off.
 */
export declare function unavailableBecause(agent: Agent): string[];
export declare function canTalkNow(agent: Agent): boolean;
//# sourceMappingURL=presentation.d.ts.map