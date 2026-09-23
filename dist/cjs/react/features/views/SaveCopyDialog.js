"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.suggestedCopyName = suggestedCopyName;
exports.SaveCopyDialog = SaveCopyDialog;
const jsx_runtime_1 = require("react/jsx-runtime");
/*
 * SAVING A VIEW YOU DO NOT OWN — as a copy, under a name of your own.
 *
 * A realm's view, or one shipped with the world, cannot be saved over: the appliance refuses the
 * name, because the saved copy would load after the original and never be seen. So the edit is
 * kept as a new view in the user's world. The dialog exists because a copy needs a NAME, and it is
 * the natural place to say why a copy at all, and that the original will carry on without it.
 */
const react_1 = require("react");
/** The appliance's rule for a view name: it is used as a label in a query. */
const VIEW_NAME = /^[A-Za-z_][A-Za-z0-9_]*$/;
function suggestedCopyName(name) {
    const base = name.replace(/\W+/g, '_').replace(/^(\d)/, '_$1');
    return `${base}_copy`;
}
function SaveCopyDialog({ viewName, reason, taken, onSave, onCancel }) {
    const [name, setName] = (0, react_1.useState)(() => suggestedCopyName(viewName));
    const [error, setError] = (0, react_1.useState)('');
    const [busy, setBusy] = (0, react_1.useState)(false);
    const input = (0, react_1.useRef)(null);
    (0, react_1.useEffect)(() => { input.current?.select(); }, []);
    async function submit(event) {
        event.preventDefault();
        const wanted = name.trim();
        const problem = !VIEW_NAME.test(wanted)
            ? 'Use letters, digits and underscores, not starting with a digit.'
            : taken.has(wanted) ? `A view named ${wanted} already exists. Choose another name.` : '';
        if (problem) {
            setError(problem);
            input.current?.focus();
            return;
        }
        setBusy(true);
        const refused = await onSave(wanted);
        setBusy(false);
        if (refused) {
            setError(refused);
            input.current?.focus();
        }
    }
    return ((0, jsx_runtime_1.jsx)("div", { className: "viewcopy-scrim", onKeyDown: (event) => { if (event.key === 'Escape')
            onCancel(); }, children: (0, jsx_runtime_1.jsxs)("form", { className: "viewcopy", role: "dialog", "aria-modal": "true", "aria-labelledby": "viewcopy-title", onSubmit: (event) => void submit(event), noValidate: true, children: [(0, jsx_runtime_1.jsxs)("h3", { id: "viewcopy-title", children: ["Save a copy of ", viewName] }), (0, jsx_runtime_1.jsxs)("p", { children: [reason.kind === 'realm' && (0, jsx_runtime_1.jsxs)(jsx_runtime_1.Fragment, { children: ["This view comes from the ", (0, jsx_runtime_1.jsx)("strong", { children: reason.realm }), " realm, so it can't be changed here."] }), reason.kind === 'world' && (0, jsx_runtime_1.jsx)(jsx_runtime_1.Fragment, { children: "This view ships with this world, so it can't be changed here." }), reason.kind === 'contract' && (0, jsx_runtime_1.jsx)(jsx_runtime_1.Fragment, { children: "This view is bound to a data contract, which saving over it would drop." }), ' ', "Your edited query will be saved as a new view in your world."] }), (0, jsx_runtime_1.jsx)("p", { className: "hint", children: reason.kind === 'realm'
                        ? `The original stays as it is, and later updates to the ${reason.realm} realm won't reach your copy.`
                        : 'The original stays as it is.' }), (0, jsx_runtime_1.jsxs)("label", { className: "paramrow", children: [(0, jsx_runtime_1.jsx)("span", { className: "paramname", children: "name" }), (0, jsx_runtime_1.jsx)("input", { ref: input, autoFocus: true, value: name, spellCheck: false, autoComplete: "off", "aria-invalid": error ? true : undefined, "aria-describedby": "viewcopy-help", onChange: (event) => { setName(event.target.value); setError(''); } }), (0, jsx_runtime_1.jsx)("small", { id: "viewcopy-help", className: error ? 'viewcopy-error' : undefined, children: error || 'Letters, digits and underscores; it is used as a label in queries.' })] }), (0, jsx_runtime_1.jsxs)("div", { className: "row viewcopy-actions", children: [(0, jsx_runtime_1.jsx)("button", { type: "button", className: "btn ghost", onClick: onCancel, children: "Cancel" }), (0, jsx_runtime_1.jsx)("button", { type: "submit", className: "btn primary", disabled: busy, children: busy ? 'saving…' : 'Save copy' })] })] }) }));
}
//# sourceMappingURL=SaveCopyDialog.js.map