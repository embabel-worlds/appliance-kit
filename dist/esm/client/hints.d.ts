import type { components } from './generated/openapi.ts';
import type { Outcome } from './outcome.ts';
import type { Transport } from './transport.ts';
type Schemas = components['schemas'];
export type Hint = Schemas['Hint'];
export type HintAction = Schemas['HintAction'];
export type HintSurface = 'me' | 'console';
export declare class HintsClient {
    private readonly transport;
    constructor(transport: Transport);
    /** Every hint the acting user should see on [surface]. */
    all(surface?: HintSurface): Promise<Outcome<Hint[]>>;
    /**
     * One hint, avoiding [exclude] (recently shown ids) until everything has been seen.
     * The server answers an EMPTY BODY when every hint is excluded — the transport surfaces
     * that as an `undefined` value, and callers show nothing rather than repeating themselves.
     */
    random(exclude?: string[], surface?: HintSurface): Promise<Outcome<Hint | undefined>>;
    /** The hints in one category (`hint`, `did-you-know`, `fun-fact`). */
    byCategory(category: string, surface?: HintSurface): Promise<Outcome<Hint[]>>;
}
export {};
//# sourceMappingURL=hints.d.ts.map