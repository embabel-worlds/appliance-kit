import React from 'react';
import type { KgQueryExample } from '../../../client/kg.ts';
export declare function QueryExampleCards({ examples, requested, onRun, onClose, onDismiss, }: {
    examples: KgQueryExample[];
    /** Opened from the Examples button, rather than offered over an empty editor. */
    requested: boolean;
    onRun(example: KgQueryExample): void;
    onClose(): void;
    /** Stop offering them unasked; absent when the appliance cannot record that. */
    onDismiss?(): void;
}): React.JSX.Element;
//# sourceMappingURL=QueryExamples.d.ts.map