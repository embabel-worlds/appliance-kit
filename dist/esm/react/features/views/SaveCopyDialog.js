import { jsxs as _jsxs, jsx as _jsx, Fragment as _Fragment } from "react/jsx-runtime";
/*
 * SAVING A VIEW YOU DO NOT OWN — as a copy, under a name of your own.
 *
 * A realm's view, or one shipped with the world, cannot be saved over: the appliance refuses the
 * name, because the saved copy would load after the original and never be seen. So the edit is
 * kept as a new view in the user's world. The dialog exists because a copy needs a NAME, and it is
 * the natural place to say why a copy at all, and that the original will carry on without it.
 */
import { useEffect, useRef, useState } from 'react';
/** The appliance's rule for a view name: it is used as a label in a query. */
const VIEW_NAME = /^[A-Za-z_][A-Za-z0-9_]*$/;
export function suggestedCopyName(name) {
    const base = name.replace(/\W+/g, '_').replace(/^(\d)/, '_$1');
    return `${base}_copy`;
}
export function SaveCopyDialog({ viewName, reason, taken, onSave, onCancel }) {
    const [name, setName] = useState(() => suggestedCopyName(viewName));
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const input = useRef(null);
    useEffect(() => { input.current?.select(); }, []);
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
    return (_jsx("div", { className: "viewcopy-scrim", onKeyDown: (event) => { if (event.key === 'Escape')
            onCancel(); }, children: _jsxs("form", { className: "viewcopy", role: "dialog", "aria-modal": "true", "aria-labelledby": "viewcopy-title", onSubmit: (event) => void submit(event), noValidate: true, children: [_jsxs("h3", { id: "viewcopy-title", children: ["Save a copy of ", viewName] }), _jsxs("p", { children: [reason.kind === 'realm' && _jsxs(_Fragment, { children: ["This view comes from the ", _jsx("strong", { children: reason.realm }), " realm, so it can't be changed here."] }), reason.kind === 'world' && _jsx(_Fragment, { children: "This view ships with this world, so it can't be changed here." }), reason.kind === 'contract' && _jsx(_Fragment, { children: "This view is bound to a data contract, which saving over it would drop." }), ' ', "Your edited query will be saved as a new view in your world."] }), _jsx("p", { className: "hint", children: reason.kind === 'realm'
                        ? `The original stays as it is, and later updates to the ${reason.realm} realm won't reach your copy.`
                        : 'The original stays as it is.' }), _jsxs("label", { className: "paramrow", children: [_jsx("span", { className: "paramname", children: "name" }), _jsx("input", { ref: input, autoFocus: true, value: name, spellCheck: false, autoComplete: "off", "aria-invalid": error ? true : undefined, "aria-describedby": "viewcopy-help", onChange: (event) => { setName(event.target.value); setError(''); } }), _jsx("small", { id: "viewcopy-help", className: error ? 'viewcopy-error' : undefined, children: error || 'Letters, digits and underscores; it is used as a label in queries.' })] }), _jsxs("div", { className: "row viewcopy-actions", children: [_jsx("button", { type: "button", className: "btn ghost", onClick: onCancel, children: "Cancel" }), _jsx("button", { type: "submit", className: "btn primary", disabled: busy, children: busy ? 'saving…' : 'Save copy' })] })] }) }));
}
//# sourceMappingURL=SaveCopyDialog.js.map