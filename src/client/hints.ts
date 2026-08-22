import type { components } from './generated/openapi.ts'
import type { Outcome } from './outcome.ts'
import type { Transport } from './transport.ts'

/*
 * TIPS, TYPED. `/api/v1/hints` joined the guarded surface when hints became world content:
 * a realm ships tips in `hints/` beside its views, the server resolves the acting user's set
 * (installation tier + world tier), and every UI — this kit's consumers and the appliance's
 * own chat — reads the same resolution. The client's one job beyond fetching is honesty about
 * scope: pass the surface you are (`me` or `console`) so users never see another UI's tips.
 */

type Schemas = components['schemas']

export type Hint = Schemas['Hint']
export type HintAction = Schemas['HintAction']

const HINTS = '/api/v1/hints'

export type HintSurface = 'me' | 'console'

export class HintsClient {
  constructor(private readonly transport: Transport) {}

  /** Every hint the acting user should see on [surface]. */
  all(surface?: HintSurface): Promise<Outcome<Hint[]>> {
    return this.transport.send({ method: 'GET', path: HINTS, query: surface ? { surface } : {} })
  }

  /**
   * One hint, avoiding [exclude] (recently shown ids) until everything has been seen.
   * The server answers an EMPTY BODY when every hint is excluded — the transport surfaces
   * that as an `undefined` value, and callers show nothing rather than repeating themselves.
   */
  random(exclude: string[] = [], surface?: HintSurface): Promise<Outcome<Hint | undefined>> {
    const query: Record<string, string> = {}
    if (exclude.length) query.exclude = exclude.join(',')
    if (surface) query.surface = surface
    return this.transport.send({ method: 'GET', path: `${HINTS}/random`, query })
  }

  /** The hints in one category (`hint`, `did-you-know`, `fun-fact`). */
  byCategory(category: string, surface?: HintSurface): Promise<Outcome<Hint[]>> {
    const query: Record<string, string> = { category }
    if (surface) query.surface = surface
    return this.transport.send({ method: 'GET', path: `${HINTS}/category`, query })
  }
}
