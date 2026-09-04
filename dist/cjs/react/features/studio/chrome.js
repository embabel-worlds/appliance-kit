"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.isAbsent = void 0;
exports.Status = Status;
exports.failureMessage = failureMessage;
exports.StudioPanel = StudioPanel;
exports.CopyButton = CopyButton;
exports.RowTable = RowTable;
const jsx_runtime_1 = require("react/jsx-runtime");
/*
 * WHAT BOTH STUDIOS SHOW, AND HOW THEY REPORT AN OUTCOME.
 *
 * The kit's client never throws: every call comes back as an `Outcome`, and the failure that
 * matters most is not an error at all — `unsupported` means this appliance simply predates the
 * endpoint. Both studios must say "your appliance is older than this console" rather than
 * "something went wrong", so the translation happens once, here, instead of at forty call sites.
 */
const react_1 = __importDefault(require("react"));
function Status({ tone, children }) {
    return (0, jsx_runtime_1.jsx)("div", { className: `status${tone ? ` ${tone}` : ''}`, children: children });
}
/**
 * The sentence to show for a failure. `unsupported` gets the version story and everything else
 * gets the SERVER's own words where it sent any — a message invented here would be a guess
 * standing in front of an explanation the appliance already gave.
 */
function failureMessage(outcome, what) {
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
const isAbsent = (outcome) => outcome.kind === 'unsupported';
exports.isAbsent = isAbsent;
/** A collapsible panel, matching the kit's `.panel` chrome. */
function StudioPanel({ title, aside, children, }) {
    return ((0, jsx_runtime_1.jsxs)("section", { className: "panel", children: [(0, jsx_runtime_1.jsxs)("header", { className: "panel-head", children: [(0, jsx_runtime_1.jsx)("h2", { children: title }), aside] }), (0, jsx_runtime_1.jsx)("div", { className: "panel-body", children: children })] }));
}
/**
 * Copy, with a moment's acknowledgement. The kit's `copyWithNod` does this for a raw DOM button;
 * in React the label is state, so this is the same behaviour expressed the way this app renders.
 */
function CopyButton({ label, text, disabled }) {
    const [nodded, setNodded] = react_1.default.useState(false);
    return ((0, jsx_runtime_1.jsx)("button", { className: "btn", disabled: disabled, onClick: () => {
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
function RowTable({ rows, columns, limit = 200 }) {
    const shown = rows.slice(0, limit);
    return ((0, jsx_runtime_1.jsxs)("div", { className: "tablewrap", children: [(0, jsx_runtime_1.jsxs)("table", { className: "results-table", children: [(0, jsx_runtime_1.jsx)("thead", { children: (0, jsx_runtime_1.jsx)("tr", { children: columns.map((c) => (0, jsx_runtime_1.jsx)("th", { children: c }, c)) }) }), (0, jsx_runtime_1.jsx)("tbody", { children: shown.map((row, i) => ((0, jsx_runtime_1.jsx)("tr", { children: columns.map((c) => ((0, jsx_runtime_1.jsx)("td", { children: row[c] == null ? '' : typeof row[c] === 'object' ? JSON.stringify(row[c]) : String(row[c]) }, c))) }, i))) })] }), rows.length > shown.length && ((0, jsx_runtime_1.jsxs)("div", { className: "hint", children: ["showing ", shown.length, " of ", rows.length, " \u2014 copy for the rest"] }))] }));
}
//# sourceMappingURL=chrome.js.map