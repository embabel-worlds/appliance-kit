import { jsx as _jsx } from "react/jsx-runtime";
import { toSafeHtml } from "../../../studio-kit/markdown.js";
export function Prose({ libs, text, className }) {
    return (_jsx("div", { className: className ? `md ${className}` : 'md', dangerouslySetInnerHTML: { __html: toSafeHtml(libs, text) } }));
}
//# sourceMappingURL=Prose.js.map