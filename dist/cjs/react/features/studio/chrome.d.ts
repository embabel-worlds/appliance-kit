import React from 'react';
import type { Outcome } from '../../../client/outcome.ts';
/** A status line's tone. Mirrors the kit CSS: `.status.ok`, `.status.error`, plain for neutral. */
export type Tone = 'ok' | 'error' | 'caution' | null;
export declare function Status({ tone, children }: {
    tone: Tone;
    children: React.ReactNode;
}): React.JSX.Element;
/**
 * The sentence to show for a failure. `unsupported` gets the version story and everything else
 * gets the SERVER's own words where it sent any — a message invented here would be a guess
 * standing in front of an explanation the appliance already gave.
 */
export declare function failureMessage(outcome: Extract<Outcome<unknown>, {
    ok: false;
}>, what: string): string;
/**
 * A failure a surface should fall SILENT on rather than nag about. As-you-type validation against
 * an appliance without `/validate` would otherwise print the same version complaint on every
 * keystroke; the feature is simply absent, and absent is quiet.
 */
export declare const isAbsent: (outcome: Extract<Outcome<unknown>, {
    ok: false;
}>) => boolean;
/** A collapsible panel, matching the kit's `.panel` chrome. */
export declare function StudioPanel({ title, aside, children, }: {
    title: React.ReactNode;
    aside?: React.ReactNode;
    children?: React.ReactNode;
}): React.JSX.Element;
/**
 * Copy, with a moment's acknowledgement. The kit's `copyWithNod` does this for a raw DOM button;
 * in React the label is state, so this is the same behaviour expressed the way this app renders.
 */
export declare function CopyButton({ label, text, disabled }: {
    label: string;
    text: string;
    disabled?: boolean;
}): React.JSX.Element;
/**
 * Results as a table. EVERY CELL IS TEXT: rows come from documents, and documents lie. React
 * escapes by default, which is why this is a component rather than an innerHTML helper — the
 * equivalent in Me needs `textContent` set by hand for the same reason.
 */
export declare function RowTable({ rows, columns, limit }: {
    rows: Array<Record<string, unknown>>;
    columns: string[];
    limit?: number;
}): React.JSX.Element;
//# sourceMappingURL=chrome.d.ts.map