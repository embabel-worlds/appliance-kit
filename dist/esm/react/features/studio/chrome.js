import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/*
 * WHAT BOTH STUDIOS SHOW, AND HOW THEY REPORT AN OUTCOME.
 *
 * Every call returns an Outcome. A missing endpoint, rejected session and unreachable appliance
 * need different recovery instructions; a missing route alone does not establish the cause.
 */
import React from 'react';
export function Status({ tone, children, className = '' }) {
    return _jsx("div", { className: `status${tone ? ` ${tone}` : ''}${className ? ` ${className}` : ''}`, role: tone === 'error' ? 'alert' : 'status', children: children });
}
/**
 * Keep the action and server detail together. Recovery must not assume a missing endpoint means
 * an old appliance, or that signing in again grants a forbidden permission.
 * action is a lowercase infinitive phrase, e.g. "list documents", never a noun or gerund.
 */
export function failureMessage(outcome, action) {
    const status = outcome.status === undefined ? '' : ` (HTTP ${outcome.status})`;
    const detail = outcome.message ? ` ${outcome.message}` : '';
    switch (outcome.kind) {
        case 'unsupported':
            return `Could not ${action}${status}. This capability is not available on this appliance.${detail}`;
        case 'unauthorized':
            return outcome.status === 403
                ? `You are not allowed to ${action}${status}. Ask an administrator for access.${detail}`
                : `Sign in again to ${action}${status}.${detail}`;
        case 'unreachable':
            return `Could not ${action}${status}. Check the appliance connection.${detail}`;
        default:
            return `Could not ${action}${status}.${detail}`;
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
    return (_jsxs("section", { className: "panel", children: [_jsxs("div", { className: "panel-head", children: [_jsx("h2", { children: title }), aside] }), _jsx("div", { className: "panel-body", children: children })] }));
}
/**
 * Copy, with a moment's acknowledgement. The kit's `copyWithNod` does this for a raw DOM button;
 * in React the label is state, so this is the same behaviour expressed the way this app renders.
 */
export function CopyButton({ label, text, disabled }) {
    const [feedback, setFeedback] = React.useState('');
    return (_jsx("button", { className: "btn", disabled: disabled, "aria-live": "polite", onClick: async () => {
            if (window.isSecureContext === false || !navigator.clipboard?.writeText) {
                setFeedback(window.isSecureContext === false
                    ? 'Copy unavailable — open over HTTPS'
                    : 'Copy unavailable — use a clipboard-enabled browser');
                return;
            }
            try {
                await navigator.clipboard.writeText(text);
                setFeedback('Copied');
                setTimeout(() => setFeedback((current) => current === 'Copied' ? '' : current), 1200);
            }
            catch {
                setFeedback('Copy failed — check browser clipboard access');
            }
        }, children: feedback || label }));
}
/**
 * Results as a table. EVERY CELL IS TEXT: rows come from documents, and documents lie. React
 * escapes by default, which is why this is a component rather than an innerHTML helper — the
 * equivalent in Me needs `textContent` set by hand for the same reason.
 */
export function RowTable({ rows, columns, limit = 200 }) {
    const shown = rows.slice(0, limit);
    return (_jsxs("div", { className: "tablewrap", role: "region", "aria-label": "Results table", tabIndex: 0, children: [_jsxs("table", { className: "results-table", children: [_jsx("thead", { children: _jsx("tr", { children: columns.map((c) => _jsx("th", { children: c }, c)) }) }), _jsx("tbody", { children: shown.map((row, i) => (_jsx("tr", { children: columns.map((c) => (_jsx("td", { "data-label": c, children: row[c] == null ? '' : typeof row[c] === 'object'
                                    ? _jsx("span", { className: "cell-object", children: JSON.stringify(row[c], null, 2) })
                                    : String(row[c]) }, c))) }, i))) })] }), rows.length > shown.length && (_jsxs("div", { className: "hint", children: ["showing ", shown.length, " of ", rows.length, " \u2014 copy for the rest"] }))] }));
}
//# sourceMappingURL=chrome.js.map