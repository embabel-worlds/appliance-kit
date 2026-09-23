import React from 'react';
export type EditorSize = 'closed' | 'mini' | 'full';
export interface ViewCypherEditorHandle {
    getText(): string;
    /** Replace the text without reporting it as an edit. */
    setText(text: string): void;
}
export interface ViewCypherEditorProps {
    size: EditorSize;
    onSize(size: EditorSize): void;
    onRun(): void;
    /** Every hand edit; the owner compares against the saved body. */
    onEdit(text: string): void;
    edited: boolean;
    /** The save control, and any note beside it (Saved · Undo, a refusal). */
    saveControls: React.ReactNode;
    onRevert(): void;
    /** What the expanded editor covers, for the strip left showing underneath. */
    underneath: string;
}
export declare const ViewCypherEditor: React.ForwardRefExoticComponent<ViewCypherEditorProps & React.RefAttributes<ViewCypherEditorHandle>>;
//# sourceMappingURL=ViewCypherEditor.d.ts.map