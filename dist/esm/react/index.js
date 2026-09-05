import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { createElement, forwardRef, useCallback, useEffect, useId, useLayoutEffect, useRef, useState, } from 'react';
import { formatDuration } from "../studio-kit/format.js";
export { getTabbable, useFocusTrap } from "./useFocusTrap.js";
const classes = (...names) => names.filter(Boolean).join(' ');
export const Button = forwardRef(function Button({ intent = 'secondary', loading = false, disabled, className, children, type = 'button', ...rest }, ref) {
    return (_jsxs("button", { ...rest, ref: ref, type: type, className: classes('kit-button', intent, className), disabled: disabled || loading, "aria-busy": loading || undefined, "data-loading": loading || undefined, children: [loading ? _jsx("span", { className: "kit-button__spinner", "aria-hidden": "true" }) : null, _jsx("span", { className: "kit-button__label", children: children })] }));
});
const CardImplementation = forwardRef(function Card({ as = 'div', className, children, ...rest }, ref) {
    return createElement(as, { ...rest, ref, className: classes('card', className) }, children);
});
export const Card = CardImplementation;
const PanelImplementation = forwardRef(function Panel({ as = 'section', className, children, ...rest }, ref) {
    return createElement(as, { ...rest, ref, className: classes('panel', className) }, children);
});
export const Panel = PanelImplementation;
export const PanelBody = forwardRef(function PanelBody({ className, children, ...rest }, ref) {
    return (_jsx("div", { ...rest, ref: ref, className: classes('panel-body', className), children: children }));
});
const MIN_WORK_PANE_WIDTH = 30;
const MAX_WORK_PANE_WIDTH = 70;
const DEFAULT_WORK_PANE_WIDTH = 55;
const clampWorkPaneWidth = (width) => Math.min(MAX_WORK_PANE_WIDTH, Math.max(MIN_WORK_PANE_WIDTH, width));
export const ChatWorkspace = forwardRef(function ChatWorkspace({ children, header, toolbar, workPane, workPaneLabel = 'Work pane', workPaneOpen, defaultWorkPaneOpen = false, onWorkPaneOpenChange, className, style, ...rest }, ref) {
    const hasWorkPane = workPane !== undefined && workPane !== null;
    const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultWorkPaneOpen);
    const [workPaneWidth, setWorkPaneWidth] = useState(DEFAULT_WORK_PANE_WIDTH);
    const isControlled = workPaneOpen !== undefined;
    const isOpen = hasWorkPane && (isControlled ? workPaneOpen : uncontrolledOpen);
    const toggleRef = useRef(null);
    const workPaneRef = useRef(null);
    const bodyRef = useRef(null);
    const wasOpenRef = useRef(isOpen);
    const resizeCleanupRef = useRef(null);
    const workPaneId = useId();
    const workPaneLabelId = useId();
    const stopResize = useCallback(() => {
        resizeCleanupRef.current?.();
        resizeCleanupRef.current = null;
    }, []);
    useEffect(() => stopResize, [stopResize]);
    useLayoutEffect(() => {
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
    return (_jsxs("div", { ...rest, ref: ref, className: classes('chat-workspace', className), style: style, "data-work-pane-open": isOpen ? 'true' : 'false', children: [header !== undefined || toolbar !== undefined || hasWorkPane ? (_jsxs("div", { className: "chat-workspace__header", children: [_jsx("div", { className: "chat-workspace__heading", children: header }), _jsxs("div", { className: "chat-workspace__toolbar", children: [toolbar, hasWorkPane ? (_jsx("button", { ref: toggleRef, type: "button", className: "chat-workspace__pane-button", "aria-controls": workPaneId, "aria-expanded": isOpen, onClick: () => setOpen(!isOpen), children: isOpen ? `Hide ${workPaneLabel}` : `Open ${workPaneLabel}` })) : null] })] })) : null, _jsxs("div", { ref: bodyRef, className: "chat-workspace__body", children: [_jsx("div", { className: "chat-workspace__conversation", children: children }), hasWorkPane && isOpen ? (_jsx("div", { role: "separator", className: "chat-workspace__separator", tabIndex: 0, "aria-label": `${workPaneLabel} width`, "aria-controls": workPaneId, "aria-orientation": "vertical", "aria-valuemin": MIN_WORK_PANE_WIDTH, "aria-valuemax": MAX_WORK_PANE_WIDTH, "aria-valuenow": Math.round(workPaneWidth), onKeyDown: handleSeparatorKeyDown, onPointerDown: handlePointerDown })) : null, hasWorkPane ? (_jsxs("aside", { ref: workPaneRef, id: workPaneId, className: "chat-workspace__work-pane", style: { flexBasis: `${workPaneWidth}%` }, "aria-labelledby": workPaneLabelId, hidden: !isOpen, children: [_jsxs("div", { className: "chat-workspace__work-pane-header", children: [_jsx("span", { id: workPaneLabelId, className: "chat-workspace__work-pane-label", children: workPaneLabel }), _jsx("button", { type: "button", className: "chat-workspace__pane-button", "aria-label": `Close ${workPaneLabel}`, onClick: () => setOpen(false), children: "Back to chat" })] }), _jsx("div", { className: "chat-workspace__work-pane-body", children: workPane })] })) : null] })] }));
});
const TabListImplementation = forwardRef(function TabList({ as = 'div', className, children, ...rest }, ref) {
    return createElement(as, { ...rest, ref, role: 'tablist', className: classes('tabs', className) }, children);
});
export const TabList = TabListImplementation;
export const Tab = forwardRef(function Tab({ selected, className, children, type = 'button', ...rest }, ref) {
    return (_jsx("button", { ...rest, ref: ref, type: type, role: "tab", "aria-selected": selected, className: classes('tab', selected && 'is-on', className), children: children }));
});
export const StatusPill = forwardRef(function StatusPill({ tone, word, className, ...rest }, ref) {
    return (_jsxs("span", { ...rest, ref: ref, className: classes('pill', tone !== 'neutral' && tone, className), children: [_jsx("span", { className: "dot", "aria-hidden": "true" }), word] }));
});
export function SettingRow({ icon: Icon, title, description, children, stacked = false, center, }) {
    const hasCenter = center !== undefined;
    return (_jsxs("div", { className: "setting-row", "data-stacked": stacked ? 'true' : undefined, "data-has-center": hasCenter ? 'true' : undefined, children: [_jsx("span", { className: "setting-row__icon", children: _jsx(Icon, { "aria-hidden": "true", focusable: "false" }) }), _jsxs("div", { className: "setting-row__text", children: [_jsx("p", { className: "setting-row__title", children: title }), _jsx("p", { className: "setting-row__description", children: description })] }), hasCenter ? _jsx("div", { className: "setting-row__center", children: center }) : null, _jsx("div", { className: "setting-row__control", children: children })] }));
}
export function SettingGroup({ heading, note, children }) {
    return (_jsxs("section", { className: "setting-group", "aria-label": heading, children: [_jsx("h3", { className: "setting-group__heading", children: heading }), note !== undefined ? _jsx("p", { className: "setting-group__note", children: note }) : null, children] }));
}
function pluralize(count, word) {
    return `${count} ${word}${count === 1 ? '' : 's'}`;
}
export function formatReceiptLine({ sources, actions, updates, durationMs, }) {
    const parts = [];
    if (sources !== undefined)
        parts.push(pluralize(sources, 'source'));
    if (actions !== undefined)
        parts.push(pluralize(actions, 'action'));
    if (updates !== undefined)
        parts.push(pluralize(updates, 'update'));
    if (durationMs !== undefined)
        parts.push(formatDuration(durationMs));
    return parts.join(' · ');
}
export function ReceiptStrip({ sources, actions, updates, durationMs, expandable = false, children, className, expanded, onExpandedChange, toggleLabel, }) {
    const [uncontrolledExpanded, setUncontrolledExpanded] = useState(false);
    const isControlled = expanded !== undefined;
    const isExpanded = isControlled ? expanded : uncontrolledExpanded;
    const line = formatReceiptLine({ sources, actions, updates, durationMs });
    if (!expandable) {
        return _jsx("p", { className: classes('receipt', className), children: line });
    }
    const toggle = () => {
        const next = !isExpanded;
        if (!isControlled)
            setUncontrolledExpanded(next);
        onExpandedChange?.(next);
    };
    return (_jsxs("div", { className: classes('receipt', className), children: [_jsxs("button", { type: "button", className: "receipt__toggle", "aria-expanded": isExpanded, "aria-label": toggleLabel, onClick: toggle, children: [_jsx("span", { children: line }), _jsx("span", { className: "receipt__chevron", "aria-hidden": "true", children: isExpanded ? '▾' : '▸' })] }), isExpanded && children ? _jsx("div", { className: "receipt__detail", children: children }) : null] }));
}
//# sourceMappingURL=index.js.map