"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Prose = Prose;
const jsx_runtime_1 = require("react/jsx-runtime");
const markdown_ts_1 = require("../../../studio-kit/markdown.js");
function Prose({ libs, text, className }) {
    return ((0, jsx_runtime_1.jsx)("div", { className: className ? `md ${className}` : 'md', dangerouslySetInnerHTML: { __html: (0, markdown_ts_1.toSafeHtml)(libs, text) } }));
}
//# sourceMappingURL=Prose.js.map