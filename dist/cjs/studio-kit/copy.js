"use strict";
/*
 * COPY, ACKNOWLEDGED. A copy with no acknowledgement gets clicked three times.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.copyWithNod = copyWithNod;
/** Copy [text]; the button says "Copied ✓" briefly, then returns to [label]. */
async function copyWithNod(button, label, text) {
    await navigator.clipboard.writeText(text);
    button.textContent = 'Copied ✓';
    setTimeout(() => {
        button.textContent = label;
    }, 1200);
}
//# sourceMappingURL=copy.js.map