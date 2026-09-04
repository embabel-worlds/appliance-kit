import { createContext, useContext, type ReactNode } from 'react'
import type { QueryStudioHost, QueryStudioServices } from '../contracts.ts'

export interface QueryRuntime {
  services: QueryStudioServices
  host: QueryStudioHost
}

const QueryRuntimeContext = createContext<QueryRuntime | null>(null)

export function QueryRuntimeProvider({
  services,
  host,
  children,
}: QueryRuntime & { children: ReactNode }) {
  return <QueryRuntimeContext.Provider value={{ services, host }}>{children}</QueryRuntimeContext.Provider>
}

export function useQueryRuntime(): QueryRuntime {
  const runtime = useContext(QueryRuntimeContext)
  if (!runtime) throw new Error('QueryStudioSurface runtime is missing')
  return runtime
}
