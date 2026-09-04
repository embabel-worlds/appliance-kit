import CodeMirror from 'codemirror';
import 'codemirror/addon/hint/show-hint.js';
import 'codemirror/addon/display/placeholder.js';
import 'codemirror/mode/cypher/cypher.js';
import 'codemirror/mode/javascript/javascript.js';
export interface Editor {
    getValue(): string;
    setValue(text: string): void;
    getCursor(): {
        line: number;
        ch: number;
    };
    getLine(line: number): string;
    getTokenAt(pos: {
        line: number;
        ch: number;
    }): {
        string: string;
        start: number;
        end: number;
    };
    coordsChar(coords: {
        left: number;
        top: number;
    }, mode: string): {
        line: number;
        ch: number;
    };
    charCoords(pos: {
        line: number;
        ch: number;
    }, mode: string): {
        left: number;
        right: number;
        top: number;
        bottom: number;
    };
    getWrapperElement(): HTMLElement;
    addLineClass(line: number, where: string, cls: string): void;
    removeLineClass(line: number, where: string, cls: string): void;
    setCursor(pos: {
        line: number;
        ch: number;
    }): void;
    focus(): void;
    refresh(): void;
    on(event: string, handler: (...args: any[]) => void): void;
    showHint(options: {
        completeSingle: boolean;
    }): void;
}
export interface EditorOptions {
    /** `application/x-cypher-query` or `text/typescript`. */
    mode: string;
    /** ⌘⏎ / ⌃⏎ — the studio's primary verb. */
    onRun(): void;
    /** Fires on every change the USER made; programmatic `setText` never triggers it. */
    onEdit?(): void;
}
export interface EditorHandle {
    /** Null until the editor has mounted. */
    editor: Editor | null;
    /** Set the text WITHOUT reporting it as a hand edit — how composed and generated text lands. */
    setText(text: string): void;
    /** The current text. Safe to call before mount; empty until then. */
    getText(): string;
    /** True once the user has typed into it — the composer stops overwriting at that point. */
    handEdited: boolean;
}
export declare function useEditor(options: EditorOptions): {
    ref: React.RefObject<HTMLDivElement | null>;
    handle: EditorHandle;
};
/** The CodeMirror constructor, for `registerHelper` and `Pos` at a studio's module scope. */
export { CodeMirror };
//# sourceMappingURL=editor.d.ts.map