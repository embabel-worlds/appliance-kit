/*
 * COPY, ACKNOWLEDGED. A copy with no acknowledgement gets clicked three times.
 */
/** Copy [text]; the button says "Copied ✓" briefly, then returns to [label]. */
export async function copyWithNod(button, label, text) {
    await navigator.clipboard.writeText(text);
    button.textContent = 'Copied ✓';
    setTimeout(() => {
        button.textContent = label;
    }, 1200);
}
//# sourceMappingURL=copy.js.map