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
/**
 * Runtime guard for the one operation with two success shapes: a finished result, or a handle.
 *
 * IDENTIFIES THE HANDLE POSITIVELY, by the `runId` only a handle carries. It used to test for the
 * ABSENCE of `rowCount`, which is a different question and the wrong one: `rowCount` is documented
 * as required on a result but is not always sent, and every consumer of the older clients defends
 * with `rowCount ?? rows.length` for exactly that reason. A result that omitted it was therefore
 * read as a background handle, and its rows — sitting right there in the payload — were discarded
 * while the caller reported the run as parked.
 *
 * A missing OPTIONAL field must never be what tells two shapes apart. `runId` is required on the
 * handle and absent from the result, so it is the one field that answers this question.
 */
function isBackgroundHandle(outcome) {
    return 'runId' in outcome && outcome.runId !== undefined;
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
    /**
     * Revise existing cypher per an instruction, without running it — "now only the ones since
     * March". Distinct from {@link generate}, which starts from nothing: the model is given the
     * query it is changing, so an editor's Refine keeps what the author already had rather than
     * regenerating around it.
     */
    refine(cypher, instruction) {
        return this.transport.send({
            method: 'POST',
            path: `${KG}/refine`,
            body: { cypher, instruction },
            timeoutMs: TIMEOUTS.generate,
        });
    }
    /**
     * The legal values of a property — the closed set, or the fact that it is too wide, or why it
     * cannot be enumerated at all. Three outcomes, and completion must tell them apart: `enumerable:
     * false` means the source cannot be asked, which is NOT an empty set, and `tooMany` present
     * means the domain is real but wider than the property's declared maximum.
     */
    propertyValues(label, property) {
        return this.transport.send({
            method: 'GET',
            path: `${KG}/schema/${encodeURIComponent(label)}/${encodeURIComponent(property)}/values`,
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
    /**
     * Run a saved view with these arguments and return its rows — the one-call form of
     * {@link viewInvocation} followed by {@link execute}.
     *
     * BOTH ARE WORTH HAVING. This one is for a caller that just wants the answer; the two-step is
     * for a studio, which puts the expanded cypher in an editable box so the author can see what a
     * view actually does and adjust it. Neither is a shortcut for the other.
     */
    runView(name, args = {}) {
        return this.transport.send({
            method: 'POST',
            path: `${KG}/views/${encodeURIComponent(name)}/run`,
            body: { args },
            timeoutMs: TIMEOUTS.execute,
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