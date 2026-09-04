"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTabbable = getTabbable;
exports.useFocusTrap = useFocusTrap;
const react_1 = require("react");
const TABBABLE_SELECTOR = [
    'a[href]',
    'area[href]',
    "input:not([disabled]):not([type='hidden'])",
    'select:not([disabled])',
    'textarea:not([disabled])',
    'button:not([disabled])',
    '[tabindex]',
    "[contenteditable='true']",
].join(',');
function getTabbable(container) {
    return Array.from(container.querySelectorAll(TABBABLE_SELECTOR)).filter((element) => element.tabIndex !== -1);
}
function useFocusTrap(active) {
    const containerRef = (0, react_1.useRef)(null);
    const previouslyFocusedRef = (0, react_1.useRef)(null);
    (0, react_1.useEffect)(() => {
        if (!active)
            return;
        previouslyFocusedRef.current = document.activeElement;
        const frame = requestAnimationFrame(() => {
            const container = containerRef.current;
            if (!container)
                return;
            getTabbable(container)[0]?.focus();
        });
        const handleKeyDown = (event) => {
            if (event.key !== 'Tab')
                return;
            const container = containerRef.current;
            if (!container)
                return;
            const tabbable = getTabbable(container);
            if (tabbable.length === 0)
                return;
            const first = tabbable[0];
            const last = tabbable[tabbable.length - 1];
            if (!first || !last)
                return;
            if (event.shiftKey && document.activeElement === first) {
                event.preventDefault();
                last.focus();
            }
            else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first.focus();
            }
        };
        const container = containerRef.current;
        container?.addEventListener('keydown', handleKeyDown);
        return () => {
            cancelAnimationFrame(frame);
            container?.removeEventListener('keydown', handleKeyDown);
            previouslyFocusedRef.current?.focus();
        };
    }, [active]);
    return containerRef;
}
//# sourceMappingURL=useFocusTrap.js.map