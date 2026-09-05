import { type ReactNode } from 'react';
import type { QueryStudioHost, QueryStudioServices } from '../contracts.ts';
export interface QueryRuntime {
    services: QueryStudioServices;
    host: QueryStudioHost;
}
export declare function QueryRuntimeProvider({ services, host, children, }: QueryRuntime & {
    children: ReactNode;
}): import("react").JSX.Element;
export declare function useQueryRuntime(): QueryRuntime;
//# sourceMappingURL=runtime.d.ts.map