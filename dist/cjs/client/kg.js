"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.KgClient = void 0;
exports.isBackgroundHandle = isBackgroundHandle;
const KG = '/api/v1/admin/kg';
/**
 * Generation and execution are not interactive-fast. A cold extract or aggregate materializes on
 * first traversal, so a 30s default would time out calls that were going to succeed.
 */
const TIMEOUTS = {
    execute: 180_000,
    generate: 120_000,
    saveView: 60_000,
};
/** Runtime guard for the one operation with two success shapes: a finished result, or a handle. */
function isBackgroundHandle(outcome) {
    return !('rowCount' in outcome);
}
class KgClient {
    transport;
    constructor(transport) {
        this.transport = transport;
    }
    /**
     * The acting user's reachable schema — the SAME snapshot the preflight validates against, so
     * what an editor offers for completion and what validation accepts can never disagree.
     */
    schema() {
        return this.transport.send({ method: 'GET', path: `${KG}/schema` });
    }
    /** The strict preflight WITHOUT execution — the editor's as-you-type validator. */
    validate(cypher) {
        return this.transport.send({ method: 'POST', path: `${KG}/validate`, body: { cypher } });
    }
    /**
     * Generate cypher and an explanation, without running it. Paired with `execute` so a console can
     * show what will run BEFORE paying for it — a caller that only sees the cypher when the whole
     * run returns looks hung.
     */
    generate(question) {
        return this.transport.send({
            method: 'POST',
            path: `${KG}/generate`,
            body: { question },
            timeoutMs: TIMEOUTS.generate,
        });
    }
    /** Answer a natural-language question: generate, then execute, scoped to the acting user. */
    ask(question) {
        return this.transport.send({
            method: 'POST',
            path: `${KG}/ask`,
            body: { question },
            timeoutMs: TIMEOUTS.execute,
        });
    }
    /**
     * Execute verbatim cypher through the virtual-cypher engine.
     *
     * With `background`, the result is a handle — use {@link isBackgroundHandle} to tell them apart.
     * With `waitSeconds`, a result whose `run` is set means "not yet": its `rows` are empty because
     * the run has not finished, NEVER because the graph is empty.
     */
    execute(cypher, options = {}) {
        const query = {};
        if (options.background)
            query['background'] = true;
        if (options.waitSeconds !== undefined)
            query['waitSeconds'] = options.waitSeconds;
        return this.transport.send({
            method: 'POST',
            path: `${KG}/execute`,
            query,
            body: { cypher },
            timeoutMs: TIMEOUTS.execute,
        });
    }
    /** The acting user's in-flight runs — for a listing, or a kill button. */
    runs() {
        return this.transport.send({ method: 'GET', path: `${KG}/runs` });
    }
    /** State and, once settled, the result of a background run. */
    run(runId) {
        return this.transport.send({ method: 'GET', path: `${KG}/runs/${encodeURIComponent(runId)}` });
    }
    /** Cancel an in-flight run. Committed graph-cache work survives the kill. */
    kill(runId) {
        return this.transport.send({ method: 'POST', path: `${KG}/kill/${encodeURIComponent(runId)}` });
    }
    /** Answer a run parked awaiting input. */
    answer(runId, choice) {
        return this.transport.send({
            method: 'POST',
            path: `${KG}/runs/${encodeURIComponent(runId)}/answer`,
            body: { choice },
        });
    }
    /** Saved views across the world and realm tiers, with their cache state. */
    views() {
        return this.transport.send({ method: 'GET', path: `${KG}/views` });
    }
    /**
     * Save a query as a named view. The appliance validates and persists it — a console never edits
     * world YAML itself.
     */
    saveView(spec) {
        return this.transport.send({
            method: 'POST',
            path: `${KG}/views`,
            body: spec,
            timeoutMs: TIMEOUTS.saveView,
        });
    }
    deleteView(name) {
        return this.transport.send({ method: 'DELETE', path: `${KG}/views/${encodeURIComponent(name)}` });
    }
    /**
     * The runnable cypher for a saved view invoked with these arguments. Put it in the editable
     * cypher box and run it through `execute`, so a view goes through the same engine as any other
     * query rather than a private path.
     */
    viewInvocation(name, args = {}) {
        return this.transport.send({
            method: 'POST',
            path: `${KG}/views/${encodeURIComponent(name)}/invocation`,
            body: { args },
        });
    }
    /** Force-recompute a materialised view's cache now, ignoring its TTL. */
    refreshView(name) {
        return this.transport.send({
            method: 'POST',
            path: `${KG}/views/${encodeURIComponent(name)}/refresh`,
        });
    }
}
exports.KgClient = KgClient;
//# sourceMappingURL=kg.js.map