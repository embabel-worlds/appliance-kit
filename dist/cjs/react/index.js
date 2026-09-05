"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StatusPill = exports.Tab = exports.TabList = exports.ChatWorkspace = exports.PanelBody = exports.Panel = exports.Card = exports.Button = exports.useFocusTrap = exports.getTabbable = void 0;
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
const MIN_WORK_PANE_WIDTH = 30;
const MAX_WORK_PANE_WIDTH = 70;
const DEFAULT_WORK_PANE_WIDTH = 55;
const clampWorkPaneWidth = (width) => Math.min(MAX_WORK_PANE_WIDTH, Math.max(MIN_WORK_PANE_WIDTH, width));
exports.ChatWorkspace = (0, react_1.forwardRef)(function ChatWorkspace({ children, header, toolbar, workPane, workPaneLabel = 'Work pane', workPaneOpen, defaultWorkPaneOpen = false, onWorkPaneOpenChange, className, style, ...rest }, ref) {
    const hasWorkPane = react_1.Children.toArray(workPane).length > 0;
    const [uncontrolledOpen, setUncontrolledOpen] = (0, react_1.useState)(defaultWorkPaneOpen);
    const [workPaneWidth, setWorkPaneWidth] = (0, react_1.useState)(DEFAULT_WORK_PANE_WIDTH);
    const isControlled = workPaneOpen !== undefined;
    const isOpen = hasWorkPane && (isControlled ? workPaneOpen : uncontrolledOpen);
    const toggleRef = (0, react_1.useRef)(null);
    const workPaneRef = (0, react_1.useRef)(null);
    const bodyRef = (0, react_1.useRef)(null);
    const wasOpenRef = (0, react_1.useRef)(isOpen);
    const resizeCleanupRef = (0, react_1.useRef)(null);
    const workPaneId = (0, react_1.useId)();
    const workPaneLabelId = (0, react_1.useId)();
    const stopResize = (0, react_1.useCallback)(() => {
        resizeCleanupRef.current?.();
        resizeCleanupRef.current = null;
    }, []);
    (0, react_1.useEffect)(() => stopResize, [stopResize]);
    (0, react_1.useLayoutEffect)(() => {
        if (wasOpenRef.current && !isOpen && workPaneRef.current?.contains(document.activeElement)) {
            toggleRef.current?.focus();
        }
        wasOpenRef.current = isOpen;
    }, [isOpen]);
    const setOpen = (next) => {
        if (!isControlled)
            setUncontrolledOpen(next);
        onWorkPaneOpenChange?.(next);
    };
    const handlePointerDown = (event) => {
        if (event.button !== 0)
            return;
        const body = bodyRef.current;
        if (!body)
            return;
        const bounds = body.getBoundingClientRect();
        if (bounds.width <= 0)
            return;
        event.preventDefault();
        stopResize();
        const handlePointerMove = (moveEvent) => {
            const width = ((bounds.right - moveEvent.clientX) / bounds.width) * 100;
            setWorkPaneWidth(clampWorkPaneWidth(width));
        };
        const handlePointerEnd = () => stopResize();
        window.addEventListener('pointermove', handlePointerMove);
        window.addEventListener('pointerup', handlePointerEnd);
        window.addEventListener('pointercancel', handlePointerEnd);
        resizeCleanupRef.current = () => {
            window.removeEventListener('pointermove', handlePointerMove);
            window.removeEventListener('pointerup', handlePointerEnd);
            window.removeEventListener('pointercancel', handlePointerEnd);
        };
    };
    const handleSeparatorKeyDown = (event) => {
        let nextWidth;
        if (event.key === 'ArrowLeft')
            nextWidth = workPaneWidth + 5;
        if (event.key === 'ArrowRight')
            nextWidth = workPaneWidth - 5;
        if (event.key === 'Home')
            nextWidth = MIN_WORK_PANE_WIDTH;
        if (event.key === 'End')
            nextWidth = MAX_WORK_PANE_WIDTH;
        if (nextWidth === undefined)
            return;
        event.preventDefault();
        setWorkPaneWidth(clampWorkPaneWidth(nextWidth));
    };
    return ((0, jsx_runtime_1.jsxs)("div", { ...rest, ref: ref, className: classes('chat-workspace', className), style: style, "data-work-pane-open": isOpen ? 'true' : 'false', children: [header !== undefined || toolbar !== undefined || hasWorkPane ? ((0, jsx_runtime_1.jsxs)("div", { className: "chat-workspace__header", children: [(0, jsx_runtime_1.jsx)("div", { className: "chat-workspace__heading", children: header }), (0, jsx_runtime_1.jsxs)("div", { className: "chat-workspace__toolbar", children: [toolbar, hasWorkPane ? ((0, jsx_runtime_1.jsx)("button", { ref: toggleRef, type: "button", className: "chat-workspace__pane-button", "aria-controls": workPaneId, "aria-expanded": isOpen, onClick: () => setOpen(!isOpen), children: isOpen ? `Hide ${workPaneLabel}` : `Open ${workPaneLabel}` })) : null] })] })) : null, (0, jsx_runtime_1.jsxs)("div", { ref: bodyRef, className: "chat-workspace__body", children: [(0, jsx_runtime_1.jsx)("div", { className: "chat-workspace__conversation", children: children }), hasWorkPane && isOpen ? ((0, jsx_runtime_1.jsx)("div", { role: "separator", className: "chat-workspace__separator", tabIndex: 0, "aria-label": `${workPaneLabel} width`, "aria-controls": workPaneId, "aria-orientation": "vertical", "aria-valuemin": MIN_WORK_PANE_WIDTH, "aria-valuemax": MAX_WORK_PANE_WIDTH, "aria-valuenow": Math.round(workPaneWidth), onKeyDown: handleSeparatorKeyDown, onPointerDown: handlePointerDown })) : null, hasWorkPane ? ((0, jsx_runtime_1.jsxs)("aside", { ref: workPaneRef, id: workPaneId, className: "chat-workspace__work-pane", style: { flexBasis: `${workPaneWidth}%` }, "aria-labelledby": workPaneLabelId, hidden: !isOpen, children: [(0, jsx_runtime_1.jsxs)("div", { className: "chat-workspace__work-pane-header", children: [(0, jsx_runtime_1.jsx)("span", { id: workPaneLabelId, className: "chat-workspace__work-pane-label", children: workPaneLabel }), (0, jsx_runtime_1.jsx)("button", { type: "button", className: "chat-workspace__pane-button", "aria-label": `Close ${workPaneLabel}`, onClick: () => setOpen(false), children: "Back to chat" })] }), (0, jsx_runtime_1.jsx)("div", { className: "chat-workspace__work-pane-body", children: workPane })] })) : null] })] }));
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