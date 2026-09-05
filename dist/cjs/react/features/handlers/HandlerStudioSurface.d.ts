import React from 'react';
import type { HandlerStudioSurfaceProps } from '../contracts.ts';
export declare function HandlerStudioSurface({ services, draft, onDraftConsumed, }: HandlerStudioSurfaceProps): React.JSX.Element;
type Stage = 'proposed' | 'watching' | 'acting';
export declare function stageOf(h: {
    active: boolean;
    autonomous: boolean;
}): Stage;
export {};
//# sourceMappingURL=HandlerStudioSurface.d.ts.map