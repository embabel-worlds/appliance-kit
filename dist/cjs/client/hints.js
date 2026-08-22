"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HintsClient = void 0;
const HINTS = '/api/v1/hints';
class HintsClient {
    transport;
    constructor(transport) {
        this.transport = transport;
    }
    /** Every hint the acting user should see on [surface]. */
    all(surface) {
        return this.transport.send({ method: 'GET', path: HINTS, query: surface ? { surface } : {} });
    }
    /**
     * One hint, avoiding [exclude] (recently shown ids) until everything has been seen.
     * The server answers an EMPTY BODY when every hint is excluded — the transport surfaces
     * that as an `undefined` value, and callers show nothing rather than repeating themselves.
     */
    random(exclude = [], surface) {
        const query = {};
        if (exclude.length)
            query.exclude = exclude.join(',');
        if (surface)
            query.surface = surface;
        return this.transport.send({ method: 'GET', path: `${HINTS}/random`, query });
    }
    /** The hints in one category (`hint`, `did-you-know`, `fun-fact`). */
    byCategory(category, surface) {
        const query = { category };
        if (surface)
            query.surface = surface;
        return this.transport.send({ method: 'GET', path: `${HINTS}/category`, query });
    }
}
exports.HintsClient = HintsClient;
//# sourceMappingURL=hints.js.map