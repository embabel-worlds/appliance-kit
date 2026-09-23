import React from 'react';
/** Why this view cannot be saved in place — the dialog's opening sentence. */
export type CopyReason = {
    kind: 'realm';
    realm: string;
} | {
    kind: 'world';
} | {
    kind: 'contract';
};
export declare function suggestedCopyName(name: string): string;
export declare function SaveCopyDialog({ viewName, reason, taken, onSave, onCancel }: {
    viewName: string;
    reason: CopyReason;
    /** Names already in use; checked here so the common clash never costs a round trip. */
    taken: ReadonlySet<string>;
    /** Resolves to an error message to show, or null once saved. */
    onSave(name: string): Promise<string | null>;
    onCancel(): void;
}): React.JSX.Element;
//# sourceMappingURL=SaveCopyDialog.d.ts.map