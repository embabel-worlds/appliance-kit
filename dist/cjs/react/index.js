"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StatusPill = exports.Tab = exports.TabList = exports.PanelBody = exports.Panel = exports.Card = exports.Button = exports.useFocusTrap = exports.getTabbable = void 0;
exports.SettingRow = SettingRow;
exports.SettingGroup = SettingGroup;
exports.formatReceiptLine = formatReceiptLine;
exports.ReceiptStrip = ReceiptStrip;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const format_ts_1 = require("../studio-kit/format.js");
var useFocusTrap_ts_1 = require("./useFocusTrap.js");
Object.defineProperty(exports, "getTabbable", { enumerable: true, get: function () { return useFocusTrap_ts_1.getTabbable; } });
Object.defineProperty(exports, "useFocusTrap", { enumerable: true, get: function () { return useFocusTrap_ts_1.useFocusTrap; } });
const classes = (...names) => names.filter(Boolean).join(' ');
exports.Button = (0, react_1.forwardRef)(function Button({ intent = 'secondary', loading = false, disabled, className, children, type = 'button', ...rest }, ref) {
    return ((0, jsx_runtime_1.jsxs)("button", { ...rest, ref: ref, type: type, className: classes('kit-button', intent, className), disabled: disabled || loading, "aria-busy": loading || undefined, "data-loading": loading || undefined, children: [loading ? (0, jsx_runtime_1.jsx)("span", { className: "kit-button__spinner", "aria-hidden": "true" }) : null, (0, jsx_runtime_1.jsx)("span", { className: "kit-button__label", children: children })] }));
});
const CardImplementation = (0, react_1.forwardRef)(function Card({ as = 'div', className, children, ...rest }, ref) {
    return (0, react_1.createElement)(as, { ...rest, ref, className: classes('card', className) }, children);
});
exports.Card = CardImplementation;
const PanelImplementation = (0, react_1.forwardRef)(function Panel({ as = 'section', className, children, ...rest }, ref) {
    return (0, react_1.createElement)(as, { ...rest, ref, className: classes('panel', className) }, children);
});
exports.Panel = PanelImplementation;
exports.PanelBody = (0, react_1.forwardRef)(function PanelBody({ className, children, ...rest }, ref) {
    return ((0, jsx_runtime_1.jsx)("div", { ...rest, ref: ref, className: classes('panel-body', className), children: children }));
});
const TabListImplementation = (0, react_1.forwardRef)(function TabList({ as = 'div', className, children, ...rest }, ref) {
    return (0, react_1.createElement)(as, { ...rest, ref, role: 'tablist', className: classes('tabs', className) }, children);
});
exports.TabList = TabListImplementation;
exports.Tab = (0, react_1.forwardRef)(function Tab({ selected, className, children, type = 'button', ...rest }, ref) {
    return ((0, jsx_runtime_1.jsx)("button", { ...rest, ref: ref, type: type, role: "tab", "aria-selected": selected, className: classes('tab', selected && 'is-on', className), children: children }));
});
exports.StatusPill = (0, react_1.forwardRef)(function StatusPill({ tone, word, className, ...rest }, ref) {
    return ((0, jsx_runtime_1.jsxs)("span", { ...rest, ref: ref, className: classes('pill', tone !== 'neutral' && tone, className), children: [(0, jsx_runtime_1.jsx)("span", { className: "dot", "aria-hidden": "true" }), word] }));
});
function SettingRow({ icon: Icon, title, description, children, stacked = false, center, }) {
    const hasCenter = center !== undefined;
    return ((0, jsx_runtime_1.jsxs)("div", { className: "setting-row", "data-stacked": stacked ? 'true' : undefined, "data-has-center": hasCenter ? 'true' : undefined, children: [(0, jsx_runtime_1.jsx)("span", { className: "setting-row__icon", children: (0, jsx_runtime_1.jsx)(Icon, { "aria-hidden": "true", focusable: "false" }) }), (0, jsx_runtime_1.jsxs)("div", { className: "setting-row__text", children: [(0, jsx_runtime_1.jsx)("p", { className: "setting-row__title", children: title }), (0, jsx_runtime_1.jsx)("p", { className: "setting-row__description", children: description })] }), hasCenter ? (0, jsx_runtime_1.jsx)("div", { className: "setting-row__center", children: center }) : null, (0, jsx_runtime_1.jsx)("div", { className: "setting-row__control", children: children })] }));
}
function SettingGroup({ heading, note, children }) {
    return ((0, jsx_runtime_1.jsxs)("section", { className: "setting-group", "aria-label": heading, children: [(0, jsx_runtime_1.jsx)("h3", { className: "setting-group__heading", children: heading }), note !== undefined ? (0, jsx_runtime_1.jsx)("p", { className: "setting-group__note", children: note }) : null, children] }));
}
function pluralize(count, word) {
    return `${count} ${word}${count === 1 ? '' : 's'}`;
}
function formatReceiptLine({ sources, actions, updates, durationMs, }) {
    const parts = [];
    if (sources !== undefined)
        parts.push(pluralize(sources, 'source'));
    if (actions !== undefined)
        parts.push(pluralize(actions, 'action'));
    if (updates !== undefined)
        parts.push(pluralize(updates, 'update'));
    if (durationMs !== undefined)
        parts.push((0, format_ts_1.formatDuration)(durationMs));
    return parts.join(' · ');
}
function ReceiptStrip({ sources, actions, updates, durationMs, expandable = false, children, className, expanded, onExpandedChange, toggleLabel, }) {
    const [uncontrolledExpanded, setUncontrolledExpanded] = (0, react_1.useState)(false);
    const isControlled = expanded !== undefined;
    const isExpanded = isControlled ? expanded : uncontrolledExpanded;
    const line = formatReceiptLine({ sources, actions, updates, durationMs });
    if (!expandable) {
        return (0, jsx_runtime_1.jsx)("p", { className: classes('receipt', className), children: line });
    }
    const toggle = () => {
        const next = !isExpanded;
        if (!isControlled)
            setUncontrolledExpanded(next);
        onExpandedChange?.(next);
    };
    return ((0, jsx_runtime_1.jsxs)("div", { className: classes('receipt', className), children: [(0, jsx_runtime_1.jsxs)("button", { type: "button", className: "receipt__toggle", "aria-expanded": isExpanded, "aria-label": toggleLabel, onClick: toggle, children: [(0, jsx_runtime_1.jsx)("span", { children: line }), (0, jsx_runtime_1.jsx)("span", { className: "receipt__chevron", "aria-hidden": "true", children: isExpanded ? '▾' : '▸' })] }), isExpanded && children ? (0, jsx_runtime_1.jsx)("div", { className: "receipt__detail", children: children }) : null] }));
}
//# sourceMappingURL=index.js.map