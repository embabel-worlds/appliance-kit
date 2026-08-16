"use strict";
/*
 * STATUS LINES — ok in green, error in red, in-flight in neither. Every panel
 * in every studio says things this way.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.setStatus = setStatus;
/** Paint [message] on [el] with the tri-state class the stylesheets share. */
function setStatus(el, ok, message) {
    el.textContent = message;
    el.className = ok === null ? 'status' : ok ? 'status ok' : 'status error';
}
//# sourceMappingURL=status.js.map