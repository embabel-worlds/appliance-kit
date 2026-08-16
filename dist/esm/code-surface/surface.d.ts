export interface SurfaceMethod {
    name: string;
    /** The declaration as generated, without the trailing `;` — fit to display. */
    signature: string;
    doc: string | null;
}
export interface SurfaceNamespace {
    name: string;
    methods: SurfaceMethod[];
}
export interface GatewaySurface {
    namespaces: SurfaceNamespace[];
    /** Top-level verbs on the gateway itself — `notify`, `communicate`, … */
    methods: SurfaceMethod[];
}
/** One offerable name at a path: a namespace to descend into, or a method to call. */
export interface SurfaceMember {
    name: string;
    kind: 'namespace' | 'method';
    signature: string | null;
    doc: string | null;
}
/** Parse a generated `interfaces.ts` into the surface, or null when the root is absent. */
export declare function parseSurface(interfacesTs: string): GatewaySurface | null;
/**
 * What fits after `gateway.` (empty path) or `gateway.<ns>.` (path ['ns']) —
 * alphabetical, namespaces and top-level verbs together at the root. An
 * unknown or too-deep path offers nothing: the surface is generated, complete,
 * and per-user, so absence here really does mean "not on your gateway".
 */
export declare function membersOf(surface: GatewaySurface | null | undefined, path: string[]): SurfaceMember[];
/**
 * The `gateway.…` chain being typed, read from the text before the cursor:
 * `await gateway.kg.qu` → { path: ['kg'], stem: 'qu' }. This lives here, not
 * in either console's editor glue, so the Me app and the Worlds console make
 * the same completion decision from the same parse — the same reason
 * @embabel/vc owns the Cypher-side context readers. Null when the cursor is
 * not on a gateway chain at all.
 */
export declare function gatewayPathAt(before: string): {
    path: string[];
    stem: string;
} | null;
/** The method at a full path — ['notify'] or ['kg', 'query'] — for signature display. */
export declare function methodAt(surface: GatewaySurface | null | undefined, path: string[]): SurfaceMethod | null;
//# sourceMappingURL=surface.d.ts.map