"use strict";
var EmbabelVc = (() => {
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

  // src/vc/index.ts
  var index_exports = {};
  __export(index_exports, {
    AI_KEYS: () => AI_KEYS,
    RESERVED_PARAMS: () => RESERVED_PARAMS,
    SCOPE_NAME: () => SCOPE_NAME,
    TARGETS: () => TARGETS,
    TIPS: () => TIPS,
    VIA_VALUES: () => VIA_VALUES,
    aliasMap: () => aliasMap,
    anchorLabels: () => anchorLabels,
    compose: () => compose,
    connectedLabels: () => connectedLabels,
    declaredParams: () => declaredParams,
    describeVcEvent: () => describeVcEvent,
    edgeContext: () => edgeContext,
    esc: () => esc,
    isFailure: () => isFailure,
    isTerminal: () => isTerminal,
    labelNames: () => labelNames,
    nodeContext: () => nodeContext,
    propertiesOf: () => propertiesOf,
    propertyMapContext: () => propertyMapContext,
    referencedScopeNames: () => referencedScopeNames,
    relationshipTypes: () => relationshipTypes,
    relationshipTypesFor: () => relationshipTypesFor,
    rowColumns: () => rowColumns,
    rowsToCsv: () => rowsToCsv,
    rowsToMarkdown: () => rowsToMarkdown,
    scopeLabel: () => scopeLabel,
    scopeReference: () => scopeReference
  });

  // src/vc/targets.ts
  var esc = (s) => s.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
  var TARGETS = {
    documents: {
      name: "Documents",
      what: "your ingested knowledge base",
      seedLabel: "Search for",
      modes: ["about", "mentions", "judged"],
      tags: true,
      dates: true
    },
    files: {
      name: "Files",
      what: "shared folders, walked live",
      seedLabel: "Term or idea",
      modes: ["mentions", "judged"],
      tags: false,
      dates: false
    },
    threads: {
      name: "Email threads",
      what: "relevance over thread summaries",
      seedLabel: "Seed",
      modes: ["semantic"],
      tags: false,
      dates: false,
      anchors: {
        topic: { label: "Topic (Concept)", pattern: (v) => `(:Concept {value:'${esc(v)}'})`, placeholder: "the renewal" },
        person: { label: "Person", pattern: (v) => `(:Person {name:'${esc(v)}'})`, placeholder: "Ada Lovelace" },
        organization: { label: "Organization", pattern: (v) => `(:Organization {name:'${esc(v)}'})`, placeholder: "Acme" },
        meeting: { label: "Meeting", pattern: (v) => `(:Meeting {subject:'${esc(v)}'})`, placeholder: "Q3 planning" }
      }
    },
    canvas: {
      name: "Blank canvas",
      what: "the whole graph, your shapes",
      modes: [],
      tags: false,
      dates: false
    }
  };
  var VIA_VALUES = ["keyword", "agentic-rag"];
  var AI_KEYS = ["hint", "model", "temperature", "confidence", "fresh"];

  // src/vc/compose.ts
  var str = (v) => v === void 0 || v === null ? "" : String(v);
  var limitOf = (spec) => Math.max(1, Number(str(spec.limit)) || 10);
  function edgeProps(spec) {
    const parts = [];
    const mode = spec.mode ?? "about";
    if (mode === "mentions") parts.push("via:'keyword'");
    if (mode === "judged") {
      parts.push("via:'agentic-rag'");
      const intent = str(spec.intent).trim();
      if (intent) parts.push(`intent:'${esc(intent)}'`);
    }
    const ai = [];
    const steering = spec.ai ?? {};
    if (str(steering.hint).trim()) ai.push(`hint:'${esc(str(steering.hint).trim())}'`);
    if (str(steering.model).trim()) ai.push(`model:'${esc(str(steering.model).trim())}'`);
    if (str(steering.temperature) !== "") ai.push(`temperature:${Number(steering.temperature)}`);
    if (str(steering.confidence) !== "") ai.push(`confidence:${Number(steering.confidence)}`);
    if (steering.fresh) ai.push("fresh:true");
    if (ai.length && mode === "judged") parts.push(`ai:{${ai.join(", ")}}`);
    return parts.length ? ` {${parts.join(", ")}}` : "";
  }
  function whereParts(spec, alias) {
    const parts = [];
    const target = TARGETS[spec.target];
    if (target.tags && str(spec.tag)) parts.push(`'${esc(str(spec.tag))}' IN ${alias}.tags`);
    if (target.dates && str(spec.dateField)) {
      if (str(spec.dateFrom)) parts.push(`${alias}.${str(spec.dateField)} >= '${str(spec.dateFrom)}'`);
      if (str(spec.dateTo)) parts.push(`${alias}.${str(spec.dateField)} < '${str(spec.dateTo)}'`);
    }
    if (str(spec.minScore) !== "") parts.push(`r.score >= ${Number(spec.minScore)}`);
    return parts;
  }
  var lines = (...parts) => parts.filter((l) => l !== null).join("\n");
  function composeDocuments(spec) {
    const seed = str(spec.seed).trim() || "your search";
    const mode = spec.mode ?? "about";
    const where = whereParts(spec, "d");
    const evidence = mode === "mentions" ? "r.score AS score, r.snippet AS snippet, r.matchedTerms AS matched" : mode === "judged" ? "r.score AS score, r.snippet AS evidence, r.intent AS intent" : "r.score AS score, r.snippet AS snippet, r.mode AS mode";
    return lines(
      mode === "judged" ? "// judged retrieval: several LLM calls per anchor \u2014 an explicit choice, never a default" : null,
      `MATCH (:Concept {value:'${esc(seed)}'})-[r:RELEVANT_TO${edgeProps(spec)}]->(d:Document)`,
      where.length ? `WHERE ${where.join("\n  AND ")}` : null,
      `RETURN d.title AS title, ${evidence}`,
      `ORDER BY r.score DESC LIMIT ${limitOf(spec)}`
    );
  }
  function composeFiles(spec) {
    const mode = spec.mode ?? "about";
    if (mode === "mentions") {
      const seed2 = (str(spec.seed).trim() || "your term").toLowerCase();
      return lines(
        `MATCH (:Concept {value:'${esc(seed2)}'})-[r:RELEVANT_TO {via:'keyword'}]->(f:File)`,
        `RETURN f.name AS name, f.dir AS dir, f.content AS excerpt, f.modifiedAt AS modified`,
        `ORDER BY modified DESC LIMIT ${limitOf(spec)}`
      );
    }
    const seed = str(spec.seed).trim() || "your idea";
    return lines(
      "// judged retrieval over file contents: several LLM calls per anchor",
      `MATCH (:Concept {value:'${esc(seed)}'})-[r:RELEVANT_TO${edgeProps(spec)}]->(f:File)`,
      `RETURN f.name AS name, f.dir AS dir, r.score AS score, r.snippet AS evidence`,
      `ORDER BY r.score DESC LIMIT ${limitOf(spec)}`
    );
  }
  function composeThreads(spec) {
    const anchor = TARGETS.threads.anchors[spec.anchor ?? "topic"];
    const seed = str(spec.seed).trim() || anchor.placeholder;
    const floor = str(spec.minScore) !== "" ? Number(spec.minScore) : 0.6;
    return lines(
      `MATCH ${anchor.pattern(seed)}-[r:RELEVANT_TO]->(t:RelevantEmailThread)`,
      `WHERE r.score >= ${floor}`,
      `RETURN t.subject AS subject, t.snippet AS snippet, r.score AS score`,
      `ORDER BY r.score DESC LIMIT ${limitOf(spec)}`
    );
  }
  function composeCanvas(_spec) {
    return lines(
      "MATCH (d:Document)",
      "RETURN d.title AS title, d.tags AS tags, d.uri AS uri",
      "ORDER BY d.ingestionTimestamp DESC LIMIT 25"
    );
  }
  var TIPS = {
    documents: [
      "Per-row LLM judgment over the fetched rows \u2014 add AND ai.relevant(d, 'genuinely about <your criterion>') to filter, or ORDER BY ai.score(d, '<your criterion>') DESC to rerank.",
      "Content, not metadata: MATCH (d)-[:HAS_SUMMARY]->(s:Summary) RETURN s.summary.",
      "AND at the document: a second seed meeting the same d asserts BOTH terms."
    ],
    files: [
      "The excerpt holds the matching lines, never the whole file body.",
      "For summarization use the Documents target \u2014 files are metadata + grep."
    ],
    threads: [
      "RELEVANT_TO is semantic \u2014 'reads as being about', never 'corresponded with'.",
      "Compose with structure: (me:AssistantUser)-[:EMAILED]->(p:Person)-[r:RELEVANT_TO]->(t)."
    ],
    canvas: [
      "The whole graph is yours \u2014 the Schema panel lists every node type here.",
      "About (vector): (:Concept {value:'\u2026'})-[r:RELEVANT_TO]->(d:Document).",
      "Mentions (keyword): (:Concept {value:'\u2026'})-[r:RELEVANT_TO {via:'keyword'}]->(d).",
      "Judged (agentic): (:Concept)-[r:RELEVANT_TO {via:'agentic-rag', intent:'\u2026'}]->(d).",
      "Files by keyword: (:Concept {value:'\u2026'})-[r:RELEVANT_TO {via:'keyword'}]->(f:File).",
      "Threads: (:Person|Organization|Meeting)-[r:RELEVANT_TO]->(t:RelevantEmailThread).",
      "Summaries: (d:Document)-[:HAS_SUMMARY]->(s:Summary).",
      "Tags are a list: WHERE 'tag' IN d.tags \u2014 membership, never CONTAINS.",
      "Per-row LLM judgment: ai.relevant(n, '\u2026') / ai.score(n, '\u2026') / ai.classify(n, '\u2026')."
    ]
  };
  var COMPOSERS = {
    documents: composeDocuments,
    files: composeFiles,
    threads: composeThreads,
    canvas: composeCanvas
  };
  function compose(spec) {
    return COMPOSERS[spec.target](spec);
  }

  // src/vc/schema.ts
  function aliasMap(cypher) {
    const map = {};
    for (const m of cypher.matchAll(/\(\s*(\w+)\s*:\s*(\w+)/g)) {
      if (m[1] && m[2]) map[m[1]] = m[2];
    }
    return map;
  }
  function propertiesOf(schema, label) {
    return schema?.labels.find((l) => l.label === label)?.properties?.map((p) => p.name) ?? [];
  }
  function labelNames(schema) {
    return schema?.labels.map((l) => l.label) ?? [];
  }
  function anchorLabels(schema) {
    return (schema?.labels ?? []).filter((l) => l.anchor !== false).map((l) => l.label).sort((a, b) => a.localeCompare(b));
  }
  function relationshipTypes(schema) {
    return [...new Set(schema?.relationships.map((r) => r.type) ?? [])].sort((a, b) => a.localeCompare(b));
  }
  function relationshipTypesFor(schema, label, direction = "any") {
    if (!label || !schema?.labels.some((l) => l.label === label)) return relationshipTypes(schema);
    const types = (dir) => dedupeSorted(
      (schema.relationships ?? []).filter((r) => dir !== "in" && r.from === label || dir !== "out" && r.to === label).map((r) => r.type)
    );
    const scoped = types(direction);
    return scoped.length ? scoped : types("any");
  }
  var dedupeSorted = (xs) => [...new Set(xs)].sort((a, b) => a.localeCompare(b));
  function connectedLabels(schema, label, type, direction = "any") {
    const rels = schema?.relationships ?? [];
    const known = !!label && (schema?.labels.some((l) => l.label === label) ?? false);
    const typeKnown = !!type && rels.some((r) => r.type === type);
    const bySource = (dir) => dedupeSorted(
      rels.flatMap((r) => [
        ...dir !== "in" && r.from === label && (!type || r.type === type) ? [r.to] : [],
        ...dir !== "out" && r.to === label && (!type || r.type === type) ? [r.from] : []
      ])
    );
    const byType = (dir) => dedupeSorted(
      rels.flatMap(
        (r) => r.type === type ? [...dir !== "in" ? [r.to] : [], ...dir !== "out" ? [r.from] : []] : []
      )
    );
    if (known) {
      const exact = bySource(direction);
      if (exact.length) return exact;
      const either = bySource("any");
      if (either.length) return either;
    }
    if (typeKnown) {
      const scoped = byType(direction);
      return scoped.length ? scoped : byType("any");
    }
    if (known && !type) return [];
    return dedupeSorted(labelNames(schema));
  }
  function edgeContext(before, aliases) {
    const m = before.match(/\(\s*(\w*)\s*(?::\s*(\w+))?\s*(?:\{[^{}]*\})?\s*\)\s*(<-|-)\s*\[[^\]]*$/);
    if (!m) return null;
    const label = m[2] ?? aliases[m[1] ?? ""] ?? null;
    return { label, direction: m[3] === "<-" ? "in" : "out" };
  }
  function nodeContext(before, aliases) {
    const m = before.match(
      /\(\s*(\w*)\s*(?::\s*(\w+))?\s*(?:\{[^{}]*\})?\s*\)\s*(<-|-)\s*(?:\[\s*\w*\s*(?::\s*(\w+))?[^\]]*\])?\s*(->|-)\s*\(\s*\w*\s*:?\s*\w*$/
    );
    if (!m) return null;
    const label = m[2] ?? aliases[m[1] ?? ""] ?? null;
    const direction = m[3] === "<-" ? "in" : m[5] === "->" ? "out" : "any";
    return { label, type: m[4] ?? null, direction };
  }
  function propertyMapContext(before, aliases) {
    const m = before.match(/\(\s*(\w*)\s*(?::\s*(\w+))?\s*\{([^{}]*?)(\w*)$/);
    if (!m) return null;
    const body = m[3] ?? "";
    if ((body.split("'").length - 1) % 2) return null;
    if (/:\s*$/.test(body)) return null;
    const label = m[2] ?? aliases[m[1] ?? ""] ?? null;
    return { label, used: [...body.matchAll(/(\w+)\s*:/g)].flatMap((k) => k[1] ? [k[1]] : []) };
  }

  // src/vc/params.ts
  var RESERVED_PARAMS = ["ai", "realm", "userId", "anchors", "exclude", "want", "hint"];
  var SCOPE_REFERENCE = /`\$([A-Za-z_][A-Za-z0-9_]*)`/g;
  function declaredParams(cypher) {
    const scopes = new Set([...cypher.matchAll(SCOPE_REFERENCE)].map((m) => m[1]));
    return [...new Set([...cypher.matchAll(/\$([A-Za-z_][A-Za-z0-9_]*)/g)].map((m) => m[1]))].filter((p) => !RESERVED_PARAMS.includes(p)).filter((p) => !scopes.has(p));
  }

  // src/vc/rows.ts
  function rowColumns(rows) {
    const columns = [];
    for (const row of rows) for (const key of Object.keys(row)) if (!columns.includes(key)) columns.push(key);
    return columns;
  }
  var cell = (value) => value == null ? "" : typeof value === "object" ? JSON.stringify(value) : String(value);
  function rowsToMarkdown(rows) {
    const columns = rowColumns(rows);
    if (!columns.length) return "";
    const md = (value) => cell(value).replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
    return [
      `| ${columns.map(md).join(" | ")} |`,
      `| ${columns.map(() => "---").join(" | ")} |`,
      ...rows.map((row) => `| ${columns.map((column) => md(row[column])).join(" | ")} |`)
    ].join("\n");
  }
  function rowsToCsv(rows) {
    const columns = rowColumns(rows);
    if (!columns.length) return "";
    const csv = (value) => {
      const s = cell(value);
      return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    return [columns, ...rows.map((row) => columns.map((column) => row[column]))].map((values) => values.map(csv).join(",")).join("\n");
  }

  // src/vc/events.ts
  var isTerminal = (event) => event.type === "query.completed" || event.type === "query.rejected";
  var isFailure = (event) => event.type === "producer.error" || event.type === "query.rejected";
  var plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
  var RETRIEVAL_STEPS = {
    search_semantic: "Searching by meaning",
    search_keyword: "Searching by keyword",
    read_document: "Reading",
    judged: "Judging",
    composing: "Composing the answer"
  };
  function describeVcEvent(event) {
    switch (event.type) {
      case "query.started":
        return "Planning the query";
      case "stage.started": {
        const e = event;
        return `Stage ${e.stage}: ${e.producer} \u2192 ${e.targetLabel}, from ${plural(e.anchorCount, e.anchorLabel)}`;
      }
      case "producer.fetch": {
        const e = event;
        return `${e.producer} returned ${plural(e.recordCount, "record")} for ${plural(e.keyCount, "key")} (${e.durationMs} ms)`;
      }
      case "nodes.materialized": {
        const e = event;
        return `Materialized ${plural(e.count, e.targetLabel)} via ${e.relationship}`;
      }
      case "producer.error": {
        const e = event;
        return `${e.producer} failed: ${e.detail}`;
      }
      case "producer.progress": {
        const e = event;
        const of = e.total > 0 ? `${e.current}/${e.total}` : String(e.current);
        return `${e.producer}: ${of} ${e.unit}${e.key ? ` \xB7 ${e.key}` : ""}`;
      }
      case "retrieval.step": {
        const e = event;
        const verb = RETRIEVAL_STEPS[e.step] ?? e.step;
        const found = e.results == null ? "" : ` \u2014 ${plural(e.results, "result")}`;
        return `${verb}: ${e.detail}${found}`;
      }
      case "query.completed": {
        const e = event;
        const labels = e.materializedLabels?.length ? ` \xB7 materialized ${e.materializedLabels.join(", ")}` : "";
        return `Done \u2014 ${plural(e.rowCount, "row")} in ${e.durationMs} ms${labels}`;
      }
      case "query.rejected":
        return `Rejected: ${event.reason}`;
      default:
        return event.type;
    }
  }

  // src/vc/scopes.ts
  var SCOPE_NAME = /^[A-Za-z_][A-Za-z0-9_]*$/;
  var ANY_REF = /`\$([A-Za-z_]\w*)`/g;
  function scopeLabel(name) {
    return "`$" + name + "`";
  }
  function scopeReference(name, alias = "x") {
    return `(${alias}:${scopeLabel(name)})`;
  }
  function referencedScopeNames(cypher) {
    const names = [];
    for (const m of cypher.matchAll(ANY_REF)) {
      const name = m[1];
      if (name !== void 0 && !names.includes(name)) names.push(name);
    }
    return names;
  }
  return __toCommonJS(index_exports);
})();
