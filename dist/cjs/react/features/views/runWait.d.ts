import React from 'react';
import type { ViewsServices } from '../contracts.ts';
export type CancelResult = {
    accepted: true;
} | {
    accepted: false;
    text: string;
};
export declare function cancelRun(kg: ViewsServices['kg'], boundRunId: string | null, draft: string | null): Promise<CancelResult>;
/**
 * How long there has been no result, and the last thing the engine reported doing.
 *
 * Its own component so the once-a-second tick re-renders one line rather than the whole surface.
 * NOT a live region: a status that changes every second would be read out every second.
 */
export declare function RunWait({ startedAt, lastStep }: {
    startedAt: number;
    lastStep: string | null;
}): React.JSX.Element;
//# sourceMappingURL=runWait.d.ts.map