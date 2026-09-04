"use strict";
/*
 * THE EDITOR, ONCE, FOR BOTH STUDIOS.
 *
 * CodeMirror 5, not 6, and that is a decision rather than an oversight. The completion behaviour
 * both studios stand on — `createCypherHint` in `@embabel/appliance-kit/studio-kit` — is written
 * against CM5's `registerHelper`/`showHint` API and is already in production in the Me app. Taking
 * CM6 here would mean a second hint implementation, and the two front ends would then complete
 * differently on the same keystroke, which is precisely the drift the shared kit exists to end.
 * When Me moves, this moves with it.
 *
 * CM5 owns a DOM node and React must not re-render into it, so the editor is created once against
 * a ref and everything after that goes through the returned handle. React never sees the text.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CodeMirror = void 0;
exports.useEditor = useEditor;
const react_1 = require("react");
const codemirror_1 = __importDefault(require("codemirror"));
exports.CodeMirror = codemirror_1.default;
require("codemirror/addon/hint/show-hint.js");
// In-box placeholder text — how an empty prompt says it is the place to type.
require("codemirror/addon/display/placeholder.js");
require("codemirror/mode/cypher/cypher.js");
require("codemirror/mode/javascript/javascript.js");
function useEditor(options) {
    const ref = (0, react_1.useRef)(null);
    const editorRef = (0, react_1.useRef)(null);
    const programmatic = (0, react_1.useRef)(false);
    const [handEdited, setHandEdited] = (0, react_1.useState)(false);
    // Held in a ref so recreating the editor is never needed just because a callback identity moved.
    const callbacks = (0, react_1.useRef)(options);
    callbacks.current = options;
    const [, forceRender] = (0, react_1.useState)(0);
    (0, react_1.useEffect)(() => {
        if (!ref.current || editorRef.current)
            return;
        const run = () => callbacks.current.onRun();
        const cm = codemirror_1.default(ref.current, {
            mode: options.mode,
            lineNumbers: true,
            viewportMargin: Infinity,
            extraKeys: { 'Cmd-Enter': run, 'Ctrl-Enter': run, 'Ctrl-Space': 'autocomplete' },
        });
        cm.on('change', () => {
            if (programmatic.current)
                return;
            setHandEdited(true);
            callbacks.current.onEdit?.();
        });
        // Completion opens as you type the characters that BEGIN a completable thing — a label after
        // `(x:`, a relationship after `[:`, a property after `alias.`. Waiting for ⌃Space means most
        // people never discover the schema is there at all.
        cm.on('inputRead', (_cm, change) => {
            if (change.origin !== '+input')
                return;
            const ch = change.text[change.text.length - 1] ?? '';
            if (!/[:.'{\w]/.test(ch))
                return;
            const cursor = cm.getCursor();
            const before = cm.getLine(cursor.line).slice(0, cursor.ch);
            if (/(\(\s*\w*:\w*|\[\s*\w*:\w*|\w+\.\w*|via:\s*'\w*|ai:\s*\{\s*\w*|\(\s*\w*\s*(?::\s*\w+)?\s*\{[^{}]*)$/.test(before)) {
                cm.showHint({ completeSingle: false });
            }
        });
        editorRef.current = cm;
        forceRender((n) => n + 1);
        return () => {
            cm.getWrapperElement().remove();
            editorRef.current = null;
        };
        // Created once for the life of the component: `mode` is fixed per studio, and re-running this
        // would drop the user's text on the floor.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return {
        ref,
        handle: {
            editor: editorRef.current,
            handEdited,
            getText: () => editorRef.current?.getValue() ?? '',
            setText: (text) => {
                const cm = editorRef.current;
                if (!cm)
                    return;
                programmatic.current = true;
                cm.setValue(text);
                programmatic.current = false;
            },
        },
    };
}
//# sourceMappingURL=editor.js.map