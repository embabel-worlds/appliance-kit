import React from 'react';
import type { KgPlanStep } from '../../../client/kg.ts';
import type { PlanPanelProps } from '../contracts.ts';
/**
 * A fact as the planner writes it, as a person reads it: `node:Issue` is an Issue,
 * `edge:Attendee-RAISED->Issue` is the pattern it would be in a query. Anything else is shown as
 * sent rather than guessed at.
 */
export declare function factLabel(fact: string): string;
/** Stored, API or AI: what a step goes beyond the graph for, from what it reaches. */
export declare function costClass(step: Pick<KgPlanStep, 'reaches'>): string;
export declare function PlanPanel({ services, goal, debounceMs, onShowCompiled }: PlanPanelProps): React.JSX.Element;
//# sourceMappingURL=PlanPanel.d.ts.map