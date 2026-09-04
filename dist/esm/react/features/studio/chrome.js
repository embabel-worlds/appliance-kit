import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/*
 * WHAT BOTH STUDIOS SHOW, AND HOW THEY REPORT AN OUTCOME.
 *
 * The kit's client never throws: every call comes back as an `Outcome`, and the failure that
 * matters most is not an error at all — `unsupported` means this appliance simply predates the
 * endpoint. Both studios must say "your appliance is older than this console" rather than
 * "something went wrong", so the translation happens once, here, instead of at forty call sites.
 */
import React from 'react';
export function Status({ tone, children }) {
    return _jsx("div", { className: `status${tone ? ` ${tone}` : ''}`, children: children });
}
/**
 * The sentence to show for a failure. `unsupported` gets the version story and everything else
 * gets the SERVER's own words where it sent any — a message invented here would be a guess
 * standing in front of an explanation the appliance already gave.
 */
export function failureMessage(outcome, what) {
    switch (outcome.kind) {
        case 'unsupported':
            return `This appliance predates ${what} — upgrade it to use this.`;
        case 'unauthorized':
            return 'Your session is not authorised for this. Sign in again.';
        case 'unreachable':
            return outcome.message;
        default:
            return outcome.message;
    }
}
/**
 * A failure a surface should fall SILENT on rather than nag about. As-you-type validation against
 * an appliance without `/validate` would otherwise print the same version complaint on every
 * keystroke; the feature is simply absent, and absent is quiet.
 */
export const isAbsent = (outcome) => outcome.kind === 'unsupported';
/** A collapsible panel, matching the kit's `.panel` chrome. */
export function StudioPanel({ title, aside, children, }) {
    return (_jsxs("section", { className: "panel", children: [_jsxs("header", { className: "panel-head", children: [_jsx("h2", { children: title }), aside] }), _jsx("div", { className: "panel-body", children: children })] }));
}
/**
 * Copy, with a moment's acknowledgement. The kit's `copyWithNod` does this for a raw DOM button;
 * in React the label is state, so this is the same behaviour expressed the way this app renders.
 */
export function CopyButton({ label, text, disabled }) {
    const [nodded, setNodded] = React.useState(false);
    return (_jsx("button", { className: "btn", disabled: disabled, onClick: () => {
            void navigator.clipboard?.writeText(text);
            setNodded(true);
            setTimeout(() => setNodded(false), 1200);
        }, children: nodded ? 'Copied' : label }));
}
/**
 * Results as a table. EVERY CELL IS TEXT: rows come from documents, and documents lie. React
 * escapes by default, which is why this is a component rather than an innerHTML helper — the
 * equivalent in Me needs `textContent` set by hand for the same reason.
 */
export function RowTable({ rows, columns, limit = 200 }) {
    const shown = rows.slice(0, limit);
    return (_jsxs("div", { className: "tablewrap", children: [_jsxs("table", { className: "results-table", children: [_jsx("thead", { children: _jsx("tr", { children: columns.map((c) => _jsx("th", { children: c }, c)) }) }), _jsx("tbody", { children: shown.map((row, i) => (_jsx("tr", { children: columns.map((c) => (_jsx("td", { children: row[c] == null ? '' : typeof row[c] === 'object' ? JSON.stringify(row[c]) : String(row[c]) }, c))) }, i))) })] }), rows.length > shown.length && (_jsxs("div", { className: "hint", children: ["showing ", shown.length, " of ", rows.length, " \u2014 copy for the rest"] }))] }));
}
//# sourceMappingURL=chrome.js.map