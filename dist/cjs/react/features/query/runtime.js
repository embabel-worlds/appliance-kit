"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.QueryRuntimeProvider = QueryRuntimeProvider;
exports.useQueryRuntime = useQueryRuntime;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const QueryRuntimeContext = (0, react_1.createContext)(null);
function QueryRuntimeProvider({ services, host, children, }) {
    return (0, jsx_runtime_1.jsx)(QueryRuntimeContext.Provider, { value: { services, host }, children: children });
}
function useQueryRuntime() {
    const runtime = (0, react_1.useContext)(QueryRuntimeContext);
    if (!runtime)
        throw new Error('QueryStudioSurface runtime is missing');
    return runtime;
}
//# sourceMappingURL=runtime.js.map