import React from 'react';
import { type MarkdownLibraries } from '../../../studio-kit/markdown.ts';
export interface ProseProps {
    /** `marked` and `DOMPurify`, injected by the front end — see the markdown policy. */
    libs: MarkdownLibraries;
    /** Markdown from a model, or from a document a model quoted. Untrusted; null renders nothing. */
    text: string | null | undefined;
    /** Extra classes for the surface's own layout. `md` is always present. */
    className?: string;
}
export declare function Prose({ libs, text, className }: ProseProps): React.JSX.Element;
//# sourceMappingURL=Prose.d.ts.map