"use strict";
var EmbabelApplianceClient = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // src/client/index.ts
  var index_exports = {};
  __export(index_exports, {
    ApplianceClient: () => ApplianceClient,
    DocumentsClient: () => DocumentsClient,
    HandlersClient: () => HandlersClient,
    HintsClient: () => HintsClient,
    HttpTransport: () => HttpTransport,
    KgClient: () => KgClient,
    basicAuth: () => basicAuth,
    classifySource: () => classifySource,
    createSseParser: () => createSseParser,
    expect: () => expect,
    isBackgroundHandle: () => isBackgroundHandle,
    isOk: () => isOk,
    newOperationId: () => newOperationId,
    ok: () => ok
  });

  // src/client/outcome.ts
  var ok = (value) => ({ ok: true, value });
  var failure = (kind, message, status, body) => {
    const f = { ok: false, kind, message };
    if (status !== void 0) f.status = status;
    if (body !== void 0) f.body = body;
    return f;
  };
  var isOk = (outcome) => outcome.ok;
  function expect(outcome) {
    if (outcome.ok) return outcome.value;
    throw new Error(`${outcome.kind}: ${outcome.message}`);
  }

  // src/client/transport.ts
  function basicAuth(username, password) {
    const encoded = typeof globalThis.btoa === "function" ? globalThis.btoa(`${username}:${password}`) : (
      // Node before the global btoa, and the Electron main process.
      Buffer.from(`${username}:${password}`, "utf8").toString("base64")
    );
    return { Authorization: `Basic ${encoded}` };
  }
  function looksLikeUnmappedRoute(status, body) {
    if (status === 405) return true;
    if (status !== 404) return false;
    if (body === void 0 || body === null || typeof body !== "object") return true;
    const shape = body;
    if (typeof shape["error"] === "string" && !("timestamp" in shape) && !("path" in shape)) {
      return false;
    }
    return "timestamp" in shape || "path" in shape || !("error" in shape);
  }
  var HttpTransport = class {
    baseUrl;
    headers;
    doFetch;
    defaultTimeoutMs;
    constructor(config) {
      this.baseUrl = config.baseUrl.replace(/\/$/, "");
      this.headers = config.headers ?? (() => ({}));
      const injected = config.fetch ?? globalThis.fetch;
      if (typeof injected !== "function") {
        throw new Error("No fetch available: pass one in HttpTransportConfig.fetch");
      }
      this.doFetch = injected.bind(globalThis);
      this.defaultTimeoutMs = config.timeoutMs ?? 3e4;
    }
    url(spec) {
      const query = spec.query ?? {};
      const params = new URLSearchParams();
      for (const [key, value] of Object.entries(query)) {
        if (value !== void 0) params.append(key, String(value));
      }
      const search = params.toString();
      return `${this.baseUrl}${spec.path}${search ? `?${search}` : ""}`;
    }
    async send(spec) {
      const controller = new AbortController();
      const timeoutMs = spec.timeoutMs ?? this.defaultTimeoutMs;
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      let response;
      try {
        const init = {
          method: spec.method,
          signal: controller.signal,
          headers: {
            Accept: "application/json",
            // A form writes its own content type, boundary and all — see RequestSpec.form.
            ...spec.body === void 0 || spec.form !== void 0 ? {} : { "Content-Type": "application/json" },
            ...this.headers(),
            ...spec.headers
          }
        };
        if (spec.form !== void 0) init.body = spec.form;
        else if (spec.body !== void 0) init.body = JSON.stringify(spec.body);
        response = await this.doFetch(this.url(spec), init);
      } catch (cause) {
        const aborted = cause instanceof Error && cause.name === "AbortError";
        return failure(
          "unreachable",
          aborted ? `The appliance did not answer within ${timeoutMs}ms` : `Could not reach the appliance: ${cause instanceof Error ? cause.message : String(cause)}`
        );
      } finally {
        clearTimeout(timer);
      }
      const text = await response.text().catch(() => "");
      let body;
      try {
        body = text.length > 0 ? JSON.parse(text) : void 0;
      } catch {
        body = void 0;
      }
      if (response.ok) return ok(body);
      if (response.status === 401 || response.status === 403) {
        return failure("unauthorized", serverMessage(body) ?? "Not authorized", response.status, body);
      }
      if (looksLikeUnmappedRoute(response.status, body)) {
        return failure(
          "unsupported",
          `This appliance does not have ${spec.method} ${spec.path} \u2014 it is likely older than this client`,
          response.status,
          body
        );
      }
      if (response.status >= 500) {
        return failure("failed", serverMessage(body) ?? `The appliance failed (${response.status})`, response.status, body);
      }
      return failure("refused", serverMessage(body) ?? `Request refused (${response.status})`, response.status, body);
    }
  };
  function serverMessage(body) {
    if (body !== null && typeof body === "object") {
      const error = body["error"];
      if (typeof error === "string" && error.length > 0) return error;
    }
    return void 0;
  }

  // src/client/sse.ts
  function createSseParser() {
    let buffer = "";
    return {
      push(text) {
        buffer += text.replace(/\r\n?/g, "\n");
        const events = [];
        let cut;
        while ((cut = buffer.indexOf("\n\n")) >= 0) {
          const block = buffer.slice(0, cut);
          buffer = buffer.slice(cut + 2);
          let event = "message";
          let id;
          const data = [];
          for (const line of block.split("\n")) {
            if (line.startsWith(":") || line === "") continue;
            const colon = line.indexOf(":");
            const field = colon === -1 ? line : line.slice(0, colon);
            let value = colon === -1 ? "" : line.slice(colon + 1);
            if (value.startsWith(" ")) value = value.slice(1);
            if (field === "event") event = value;
            else if (field === "data") data.push(value);
            else if (field === "id") id = value;
          }
          if (data.length === 0) continue;
          events.push(id === void 0 ? { event, data: data.join("\n") } : { event, data: data.join("\n"), id });
        }
        return events;
      }
    };
  }

  // src/client/kg.ts
  var KG = "/api/v1/admin/kg";
  var TIMEOUTS = {
    execute: 18e4,
    generate: 12e4,
    saveView: 6e4
  };
  function isBackgroundHandle(outcome) {
    return "runId" in outcome && outcome.runId !== void 0;
  }
  var KgClient = class {
    constructor(transport) {
      this.transport = transport;
    }
    /**
     * The acting user's reachable schema — the SAME snapshot the preflight validates against, so
     * what an editor offers for completion and what validation accepts can never disagree.
     */
    schema() {
      return this.transport.send({ method: "GET", path: `${KG}/schema` });
    }
    /** The strict preflight WITHOUT execution — the editor's as-you-type validator. */
    validate(cypher) {
      return this.transport.send({ method: "POST", path: `${KG}/validate`, body: { cypher } });
    }
    /**
     * Generate cypher and an explanation, without running it. Paired with `execute` so a console can
     * show what will run BEFORE paying for it — a caller that only sees the cypher when the whole
     * run returns looks hung.
     */
    generate(question) {
      return this.transport.send({
        method: "POST",
        path: `${KG}/generate`,
        body: { question },
        timeoutMs: TIMEOUTS.generate
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
        method: "POST",
        path: `${KG}/refine`,
        body: { cypher, instruction },
        timeoutMs: TIMEOUTS.generate
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
        method: "GET",
        path: `${KG}/schema/${encodeURIComponent(label)}/${encodeURIComponent(property)}/values`
      });
    }
    /** Answer a natural-language question: generate, then execute, scoped to the acting user. */
    ask(question) {
      return this.transport.send({
        method: "POST",
        path: `${KG}/ask`,
        body: { question },
        timeoutMs: TIMEOUTS.execute
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
      if (options.background) query["background"] = true;
      if (options.waitSeconds !== void 0) query["waitSeconds"] = options.waitSeconds;
      const body = { cypher };
      if (options.captureAs !== void 0) body["captureAs"] = options.captureAs;
      return this.transport.send({
        method: "POST",
        path: `${KG}/execute`,
        query,
        body,
        timeoutMs: TIMEOUTS.execute
      });
    }
    /** The acting user's live captured scopes, newest first. An expired scope is already absent. */
    scopes() {
      return this.transport.send({ method: "GET", path: `${KG}/scopes` });
    }
    /** Delete a captured scope. `deleted: false` is an honest no-op, not an error. */
    deleteScope(name) {
      return this.transport.send({ method: "DELETE", path: `${KG}/scopes/${encodeURIComponent(name)}` });
    }
    /** Pin a captured scope: clear its expiry so it survives until explicitly deleted. */
    pinScope(name) {
      return this.transport.send({ method: "POST", path: `${KG}/scopes/${encodeURIComponent(name)}/pin` });
    }
    /** The acting user's in-flight runs — for a listing, or a kill button. */
    runs() {
      return this.transport.send({ method: "GET", path: `${KG}/runs` });
    }
    /** State and, once settled, the result of a background run. */
    run(runId) {
      return this.transport.send({ method: "GET", path: `${KG}/runs/${encodeURIComponent(runId)}` });
    }
    /** Cancel an in-flight run. Committed graph-cache work survives the kill. */
    kill(runId) {
      return this.transport.send({ method: "POST", path: `${KG}/kill/${encodeURIComponent(runId)}` });
    }
    /** Answer a run parked awaiting input. */
    answer(runId, choice) {
      return this.transport.send({
        method: "POST",
        path: `${KG}/runs/${encodeURIComponent(runId)}/answer`,
        body: { choice }
      });
    }
    /** Saved views across the world and realm tiers, with their cache state. */
    views() {
      return this.transport.send({ method: "GET", path: `${KG}/views` });
    }
    /**
     * Save a query as a named view. The appliance validates and persists it — a console never edits
     * world YAML itself.
     */
    saveView(spec) {
      return this.transport.send({
        method: "POST",
        path: `${KG}/views`,
        body: spec,
        timeoutMs: TIMEOUTS.saveView
      });
    }
    deleteView(name) {
      return this.transport.send({ method: "DELETE", path: `${KG}/views/${encodeURIComponent(name)}` });
    }
    /**
     * The runnable cypher for a saved view invoked with these arguments. Put it in the editable
     * cypher box and run it through `execute`, so a view goes through the same engine as any other
     * query rather than a private path.
     */
    viewInvocation(name, args = {}) {
      return this.transport.send({
        method: "POST",
        path: `${KG}/views/${encodeURIComponent(name)}/invocation`,
        body: { args }
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
        method: "POST",
        path: `${KG}/views/${encodeURIComponent(name)}/run`,
        body: { args },
        timeoutMs: TIMEOUTS.execute
      });
    }
    /** Force-recompute a materialised view's cache now, ignoring its TTL. */
    refreshView(name) {
      return this.transport.send({
        method: "POST",
        path: `${KG}/views/${encodeURIComponent(name)}/refresh`
      });
    }
  };

  // src/client/documents.ts
  var DOCS = "/api/v1/documents";
  var ASK_TIMEOUT_MS = 18e4;
  var INGEST_TIMEOUT_MS = 3e5;
  var DocumentsClient = class {
    constructor(transport) {
      this.transport = transport;
    }
    /** Everything ingested, with the chunk total the graph holds for it. */
    list() {
      return this.transport.send({ method: "GET", path: DOCS });
    }
    /**
     * Ingest one file: converted, chunked, embedded, answerable once it lands.
     *
     * BYTES, NOT A `File`. The console has a `File` from an `<input>`; the Me app has an
     * `ArrayBuffer` that crossed an IPC bridge, because no file PATH may cross it and a `File` is not
     * structured-cloneable in the shape that matters. Bytes plus a name is the intersection, so one
     * method serves both rather than the Me app keeping a private upload path.
     */
    upload(filename, bytes, tags = []) {
      const form = new FormData();
      const blob = bytes instanceof Blob ? bytes : new Blob([bytes]);
      form.append("file", blob, filename);
      for (const tag of tags.filter((t) => t.trim())) form.append("tags", tag.trim());
      return this.transport.send({ method: "POST", path: `${DOCS}/upload`, form, timeoutMs: INGEST_TIMEOUT_MS });
    }
    /** Ingest a web page by URL — the appliance fetches and converts it. */
    ingestUrl(url, tags = []) {
      return this.transport.send({
        method: "POST",
        path: `${DOCS}/url`,
        body: { url, tags: tags.filter((t) => t.trim()) },
        timeoutMs: INGEST_TIMEOUT_MS
      });
    }
    /**
     * Ask the ingested documents, with citations.
     *
     * `operationId` is how a surface narrates its OWN retrieval. The progress stream
     * (`GET /api/v1/virtual-cypher/events`) is per-USER, so every window of every app signed in as
     * this user sees every event; the appliance echoes this header back on each `retrieval.step`, and
     * a client that supplies one can ignore everything that is not its own. Without it, asking a
     * question in one window narrates into another.
     *
     * Empty strings are dropped rather than sent: `from: ''` is not a filter, and a server that reads
     * it as one would exclude every document.
     */
    ask(request, options = {}) {
      const body = {
        question: request.question,
        history: request.history ?? [],
        answer: true
      };
      if (request.tag) body["tag"] = request.tag;
      if (request.dateField) body["dateField"] = request.dateField;
      if (request.from) body["from"] = request.from;
      if (request.to) body["to"] = request.to;
      if (request.topK) body["topK"] = request.topK;
      return this.transport.send({
        method: "POST",
        path: `${DOCS}/ask`,
        body,
        headers: options.operationId ? { "X-Embabel-Operation-Id": options.operationId } : void 0,
        timeoutMs: ASK_TIMEOUT_MS
      });
    }
  };
  function newOperationId(prefix = "ask") {
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }

  // src/client/hints.ts
  var HINTS = "/api/v1/hints";
  var HintsClient = class {
    constructor(transport) {
      this.transport = transport;
    }
    /** Every hint the acting user should see on [surface]. */
    all(surface) {
      return this.transport.send({ method: "GET", path: HINTS, query: surface ? { surface } : {} });
    }
    /**
     * One hint, avoiding [exclude] (recently shown ids) until everything has been seen.
     * The server answers an EMPTY BODY when every hint is excluded — the transport surfaces
     * that as an `undefined` value, and callers show nothing rather than repeating themselves.
     */
    random(exclude = [], surface) {
      const query = {};
      if (exclude.length) query.exclude = exclude.join(",");
      if (surface) query.surface = surface;
      return this.transport.send({ method: "GET", path: `${HINTS}/random`, query });
    }
    /** The hints in one category (`hint`, `did-you-know`, `fun-fact`). */
    byCategory(category, surface) {
      const query = { category };
      if (surface) query.surface = surface;
      return this.transport.send({ method: "GET", path: `${HINTS}/category`, query });
    }
  };

  // src/client/citations.ts
  function classifySource(uri) {
    if (!uri) return { kind: "opaque", label: "unknown source" };
    if (/^https?:\/\//i.test(uri)) {
      let label = uri;
      try {
        const parsed = new URL(uri);
        label = parsed.hostname + parsed.pathname;
      } catch {
      }
      return { kind: "web", label, url: uri };
    }
    if (uri.startsWith("file://")) {
      let containerPath;
      try {
        containerPath = decodeURIComponent(new URL(uri).pathname);
      } catch {
        containerPath = uri.replace(/^file:\/\//, "");
      }
      return { kind: "file", label: containerPath, containerPath };
    }
    return { kind: "opaque", label: uri };
  }

  // src/client/handlers.ts
  var HANDLERS = "/api/v1/admin/handlers";
  var TIMEOUTS2 = {
    dryRun: 18e4,
    generate: 12e4,
    save: 6e4
  };
  var HandlersClient = class {
    constructor(transport) {
      this.transport = transport;
    }
    /** The user's own handlers, plus realm-shipped ones they have not adopted. */
    list() {
      return this.transport.send({ method: "POST", path: `${HANDLERS}/list`, body: {} });
    }
    /** One handler's source and triggers, for round-tripping open → edit → save. */
    open(name) {
      return this.transport.send({
        method: "POST",
        path: `${HANDLERS}/open`,
        query: { name },
        body: {}
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
      return this.transport.send({ method: "POST", path: `${HANDLERS}/validate`, body: { source } });
    }
    /**
     * English → handler source, with the compiler's verdict on what came back. With `current`, the
     * English is a CHANGE to that source — the round-trip an editor's Refine drives.
     */
    generate(english, current) {
      return this.transport.send({
        method: "POST",
        path: `${HANDLERS}/generate`,
        body: current === void 0 ? { english } : { english, current },
        timeoutMs: TIMEOUTS2.generate
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
      if (signalType) body["signalType"] = signalType;
      if (sample) body["sample"] = sample;
      return this.transport.send({
        method: "POST",
        path: `${HANDLERS}/dry-run`,
        body,
        timeoutMs: TIMEOUTS2.dryRun
      });
    }
    /**
     * Create or update a handler. The appliance type-checks before persisting, so a false `ok` means
     * the code was rejected, not that the request failed — `message` is the compiler's own words.
     */
    save(spec) {
      return this.transport.send({
        method: "POST",
        path: `${HANDLERS}/save`,
        body: spec,
        timeoutMs: TIMEOUTS2.save
      });
    }
    /** Delete a user-authored handler. A realm-shipped one can only be disabled. */
    delete(name) {
      return this.transport.send({
        method: "POST",
        path: `${HANDLERS}/delete`,
        query: { name },
        body: {}
      });
    }
    /** Enable (or, for a realm handler, adopt) — or disable. Until this is true, a handler never fires. */
    setEnabled(name, enabled) {
      return this.transport.send({
        method: "POST",
        path: `${HANDLERS}/set-enabled`,
        query: { name, enabled },
        body: {}
      });
    }
    /**
     * Set a per-user cron schedule, or clear it with a blank. The response echoes what was STORED,
     * not what was sent — the blank-to-null coercion happens server-side, and a client that trusted
     * its own input would show a schedule that is not in force.
     */
    setSchedule(name, schedule) {
      return this.transport.send({
        method: "POST",
        path: `${HANDLERS}/set-schedule`,
        query: { name, schedule },
        body: {}
      });
    }
  };

  // src/client/index.ts
  var ApplianceClient = class _ApplianceClient {
    constructor(transport) {
      this.transport = transport;
      this.kg = new KgClient(transport);
      this.handlers = new HandlersClient(transport);
      this.documents = new DocumentsClient(transport);
      this.hints = new HintsClient(transport);
    }
    kg;
    handlers;
    documents;
    hints;
    /** The console's configuration: relative URLs, same origin, ambient credentials. */
    static sameOrigin(config = {}) {
      return new _ApplianceClient(new HttpTransport({ ...config, baseUrl: "" }));
    }
    /** The Me main process's configuration: an explicit appliance URL and its credential. */
    static forAppliance(config) {
      return new _ApplianceClient(new HttpTransport(config));
    }
  };
  return __toCommonJS(index_exports);
})();
