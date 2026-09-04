import { jsx as _jsx } from "react/jsx-runtime";
import { createContext, useContext } from 'react';
const QueryRuntimeContext = createContext(null);
export function QueryRuntimeProvider({ services, host, children, }) {
    return _jsx(QueryRuntimeContext.Provider, { value: { services, host }, children: children });
}
export function useQueryRuntime() {
    const runtime = useContext(QueryRuntimeContext);
    if (!runtime)
        throw new Error('QueryStudioSurface runtime is missing');
    return runtime;
}
//# sourceMappingURL=runtime.js.map