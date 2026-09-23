"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ViewCypherEditor = void 0;
const jsx_runtime_1 = require("react/jsx-runtime");
/*
 * A VIEW'S CYPHER, EDITABLE IN PLACE — one editor at two sizes.
 *
 * Small, it hangs under the run bar for a quick tweak. Expanded, it covers the tabs and results for
 * real work, stopping short of the bottom so a strip of what it covers stays visible: the user is
 * never unsure where their results went. It is ONE CodeMirror instance whose container changes
 * size, never two editors sharing text, so the cursor, scroll and undo stack survive the switch and
 * nobody has to be told the two are the same.
 *
 * Run closes it at either size — the point of running is to look at the rows.
 */
const react_1 = require("react");
const editor_ts_1 = require("../studio/editor.js");
exports.ViewCypherEditor = (0, react_1.forwardRef)(function ViewCypherEditor({ size, onSize, onRun, onEdit, edited, saveControls, onRevert, underneath }, ref) {
    const { ref: hostRef, handle } = (0, editor_ts_1.useEditor)({
        mode: 'application/x-cypher-query',
        onRun,
        onEdit: () => onEdit(handle.getText()),
    });
    (0, react_1.useImperativeHandle)(ref, () => ({ getText: handle.getText, setText: handle.setText }), [handle.editor]);
    // CodeMirror measures itself when it becomes visible or changes size; it cannot notice either.
    (0, react_1.useEffect)(() => {
        if (size === 'closed')
            return;
        handle.editor?.refresh();
        handle.editor?.focus();
    }, [size, handle.editor]);
    /*
     * CAPTURED, before CodeMirror sees the key: CodeMirror binds Escape itself (to collapse a
     * multi-selection) and marks it handled, so a bubbling listener would never step the editor down.
     * An open completion list keeps Escape, to close itself.
     */
    function onKeyDownCapture(event) {
        if (event.key !== 'Escape')
            return;
        if (handle.editor?.state?.completionActive)
            return;
        event.preventDefault();
        onSize(size === 'full' ? 'mini' : 'closed');
    }
    return ((0, jsx_runtime_1.jsxs)(jsx_runtime_1.Fragment, { children: [(0, jsx_runtime_1.jsxs)("section", { className: `viewcypher viewcypher-${size}`, hidden: size === 'closed', role: "region", "aria-label": size === 'full' ? 'Cypher editor, expanded' : 'Cypher editor', onKeyDownCapture: onKeyDownCapture, children: [(0, jsx_runtime_1.jsxs)("header", { className: "viewcypher-head", children: [(0, jsx_runtime_1.jsx)("span", { className: "viewnav-label", children: "Cypher" }), edited && (0, jsx_runtime_1.jsx)("span", { className: "viewtag viewtag-edited", children: "edited" }), edited && (0, jsx_runtime_1.jsx)("button", { className: "btn ghost tiny", onClick: onRevert, children: "Revert" }), (0, jsx_runtime_1.jsx)("span", { className: "viewcypher-spacer" }), saveControls, size === 'full'
                                ? (0, jsx_runtime_1.jsx)("button", { className: "btn ghost tiny", onClick: () => onSize('mini'), title: "Back to the small editor", children: "\u2921 Shrink" })
                                : (0, jsx_runtime_1.jsx)("button", { className: "btn ghost tiny", onClick: () => onSize('full'), title: "Grow the editor to fill the window", children: "\u2922 Expand" }), (0, jsx_runtime_1.jsx)("button", { className: "btn ghost tiny", onClick: () => onSize('closed'), "aria-label": "Close the Cypher editor", children: "\u2715" })] }), (0, jsx_runtime_1.jsx)("div", { className: "editor-host viewcypher-host", ref: hostRef })] }), size === 'full' && ((0, jsx_runtime_1.jsxs)("button", { className: "viewcypher-peek", onClick: () => onSize('closed'), children: [underneath, " underneath \u2014 Run to return"] }))] }));
});
//# sourceMappingURL=ViewCypherEditor.js.map