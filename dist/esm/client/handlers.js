const HANDLERS = '/api/v1/admin/handlers';
/**
 * Generation runs a model and then a compile; a dry run executes the handler. Neither is
 * interactive-fast, and the transport's 30s default would time out calls that were going to
 * succeed.
 */
const TIMEOUTS = {
    dryRun: 180_000,
    generate: 120_000,
    save: 60_000,
};
export class HandlersClient {
    transport;
    constructor(transport) {
        this.transport = transport;
    }
    /** The user's own handlers, plus realm-shipped ones they have not adopted. */
    list() {
        return this.transport.send({ method: 'POST', path: `${HANDLERS}/list`, body: {} });
    }
    /** One handler's source and triggers, for round-tripping open → edit → save. */
    open(name) {
        return this.transport.send({
            method: 'POST',
            path: `${HANDLERS}/open`,
            query: { name },
            body: {},
        });
    }
    /**
     * The `tsc` gate WITHOUT saving or running — the editor's as-you-type verdict, and the same gate
     * the save path enforces, so "valid here" and "rejected there" can never disagree.
     *
     * Two booleans come back and they mean different things: `ok` is whether the check ran, `valid`
     * is its verdict. Validation is best-effort server-side (a missing sandbox skips it), so a
     * caller that reads only `valid` cannot tell "it compiles" from "nothing checked it".
     */
    validate(source) {
        return this.transport.send({ method: 'POST', path: `${HANDLERS}/validate`, body: { source } });
    }
    /**
     * English → handler source, with the compiler's verdict on what came back. With `current`, the
     * English is a CHANGE to that source — the round-trip an editor's Refine drives.
     */
    generate(english, current) {
        return this.transport.send({
            method: 'POST',
            path: `${HANDLERS}/generate`,
            body: current === undefined ? { english } : { english, current },
            timeoutMs: TIMEOUTS.generate,
        });
    }
    /**
     * Run a handler OBSERVE-ONLY on the appliance, against a real recent signal of `signalType` (or
     * a cron tick when nothing matches), or against `sample` when the event has not been received
     * yet.
     *
     * Read `ranAgainst` rather than assuming: a signal type with nothing on record falls back to a
     * cron tick, so reporting the REQUESTED type would tell an author their handler ran against an
     * event it never saw.
     */
    dryRun(source, signalType, sample) {
        const body = { source };
        if (signalType)
            body['signalType'] = signalType;
        if (sample)
            body['sample'] = sample;
        return this.transport.send({
            method: 'POST',
            path: `${HANDLERS}/dry-run`,
            body,
            timeoutMs: TIMEOUTS.dryRun,
        });
    }
    /**
     * Create or update a handler. The appliance type-checks before persisting, so a false `ok` means
     * the code was rejected, not that the request failed — `message` is the compiler's own words.
     */
    save(spec) {
        return this.transport.send({
            method: 'POST',
            path: `${HANDLERS}/save`,
            body: spec,
            timeoutMs: TIMEOUTS.save,
        });
    }
    /** Delete a user-authored handler. A realm-shipped one can only be disabled. */
    delete(name) {
        return this.transport.send({
            method: 'POST',
            path: `${HANDLERS}/delete`,
            query: { name },
            body: {},
        });
    }
    /** Enable (or, for a realm handler, adopt) — or disable. Until this is true, a handler never fires. */
    setEnabled(name, enabled) {
        return this.transport.send({
            method: 'POST',
            path: `${HANDLERS}/set-enabled`,
            query: { name, enabled },
            body: {},
        });
    }
    /**
     * Set a per-user cron schedule, or clear it with a blank. The response echoes what was STORED,
     * not what was sent — the blank-to-null coercion happens server-side, and a client that trusted
     * its own input would show a schedule that is not in force.
     */
    setSchedule(name, schedule) {
        return this.transport.send({
            method: 'POST',
            path: `${HANDLERS}/set-schedule`,
            query: { name, schedule },
            body: {},
        });
    }
}
//# sourceMappingURL=handlers.js.map