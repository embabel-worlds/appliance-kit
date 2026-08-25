"use strict";
var EmbabelStudioKit = (() => {
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

  // src/studio-kit/index.ts
  var index_exports = {};
  __export(index_exports, {
    CYPHER_KEYWORDS: () => CYPHER_KEYWORDS,
    MARKDOWN_OPTIONS: () => MARKDOWN_OPTIONS,
    MARKDOWN_SANITIZE: () => MARKDOWN_SANITIZE,
    MAX_LOG_LINES: () => MAX_LOG_LINES,
    copyWithNod: () => copyWithNod,
    createCypherHint: () => createCypherHint,
    createDefinitionTooltip: () => createDefinitionTooltip,
    createSessionCypherHint: () => createSessionCypherHint,
    cypherFragmentCompletions: () => cypherFragmentCompletions,
    definitionTitle: () => definitionTitle,
    formatDuration: () => formatDuration,
    isAtBottom: () => isAtBottom,
    matchesFilter: () => matchesFilter,
    pendingBehind: () => pendingBehind,
    setStatus: () => setStatus,
    severityOfLevel: () => severityOfLevel,
    severityOfLine: () => severityOfLine,
    toSafeHtml: () => toSafeHtml
  });

  // src/studio-kit/format.ts
  function formatDuration(ms) {
    if (ms < 1e3) return `${ms} ms`;
    const seconds = Math.round(ms / 100) / 10;
    if (seconds < 60) return `${seconds.toFixed(1)} s`;
    const whole = Math.round(ms / 1e3);
    const rest = whole % 60;
    return rest ? `${Math.floor(whole / 60)} min ${rest} s` : `${Math.floor(whole / 60)} min`;
  }

  // src/studio-kit/status.ts
  function setStatus(el, ok, message) {
    el.textContent = message;
    el.className = ok === null ? "status" : ok ? "status ok" : "status error";
  }

  // src/studio-kit/copy.ts
  async function copyWithNod(button, label, text) {
    await navigator.clipboard.writeText(text);
    button.textContent = "Copied \u2713";
    setTimeout(() => {
      button.textContent = label;
    }, 1200);
  }

  // src/studio-kit/tooltip.ts
  function definitionTitle(label) {
    return `${label.label} \xB7 ${label.realm ? `${label.realm} realm` : "core"}`;
  }
  function createDefinitionTooltip(doc, id = "deftip") {
    const tip = doc.getElementById(id) ?? doc.body.appendChild(doc.createElement("div"));
    tip.id = id;
    tip.hidden = true;
    const win = doc.defaultView;
    win?.addEventListener("scroll", () => {
      tip.hidden = true;
    }, true);
    return {
      show(target, name, text) {
        tip.innerHTML = "";
        const head = doc.createElement("div");
        head.className = "t-label";
        head.textContent = name;
        tip.append(head);
        if (text) {
          const body = doc.createElement("div");
          body.textContent = text;
          tip.append(body);
        }
        tip.hidden = false;
        const rect = target instanceof Element ? target.getBoundingClientRect() : target;
        const width = win?.innerWidth ?? 1200;
        const height = win?.innerHeight ?? 800;
        tip.style.left = `${Math.max(12, Math.min(rect.right + 10, width - 480))}px`;
        tip.style.top = `${Math.max(12, Math.min(rect.top, height - tip.offsetHeight - 12))}px`;
      },
      hide() {
        tip.hidden = true;
      }
    };
  }

  // src/studio-kit/markdown.ts
  var MARKDOWN_OPTIONS = {
    gfm: true,
    breaks: true
  };
  var MARKDOWN_SANITIZE = {
    ALLOWED_TAGS: [
      "p",
      "br",
      "hr",
      "strong",
      "em",
      "del",
      "code",
      "pre",
      "blockquote",
      "ul",
      "ol",
      "li",
      "a",
      "h1",
      "h2",
      "h3",
      "h4",
      "h5",
      "h6",
      "table",
      "thead",
      "tbody",
      "tr",
      "th",
      "td"
    ],
    ALLOWED_ATTR: ["href", "title", "start"],
    ALLOWED_URI_REGEXP: /^https?:\/\//i
  };
  function toSafeHtml(libs, text) {
    if (text == null || text === "") return "";
    const parsed = libs.parse(String(text), MARKDOWN_OPTIONS);
    return String(libs.sanitize(parsed, { ...MARKDOWN_SANITIZE, RETURN_DOM_FRAGMENT: false }));
  }

  // src/studio-kit/logs.ts
  function severityOfLine(line) {
    if (/\b(ERROR|FATAL|SEVERE)\b/.test(line)) return "error";
    if (/\bWARN(ING)?\b/.test(line)) return "warn";
    return "";
  }
  function severityOfLevel(level) {
    const upper = (level ?? "").toUpperCase();
    if (upper === "ERROR" || upper === "FATAL" || upper === "SEVERE") return "error";
    if (upper === "WARN" || upper === "WARNING") return "warn";
    return "";
  }
  var MAX_LOG_LINES = 5e3;
  function matchesFilter(line, needle) {
    const trimmed = needle.trim().toLowerCase();
    return !trimmed || line.toLowerCase().includes(trimmed);
  }
  function isAtBottom(view) {
    return view.scrollHeight - view.scrollTop - view.clientHeight < 40;
  }
  function pendingBehind(total, shownUpTo) {
    return Math.max(0, total - shownUpTo);
  }

  // src/studio-kit/hints.ts
  function cypherFragmentCompletions(vc, schema, before, aliasSource) {
    let m;
    if ((m = before.match(/[([]\s*\w*:(\w*)$/)) && before.lastIndexOf("(") > before.lastIndexOf("[")) {
      const stem = m[1] ?? "";
      const context = vc.nodeContext(before, vc.aliasMap(aliasSource));
      const labels = context ? vc.connectedLabels(schema, context.label, context.type, context.direction) : vc.anchorLabels(schema);
      return { list: labels.filter((l) => l.toLowerCase().startsWith(stem.toLowerCase())), stemLength: stem.length };
    }
    if (m = before.match(/\[\s*\w*:(\w*)$/)) {
      const stem = m[1] ?? "";
      const context = vc.edgeContext(before, vc.aliasMap(aliasSource));
      const rels = vc.relationshipTypesFor(schema, context?.label, context?.direction);
      return { list: rels.filter((r) => r.toLowerCase().startsWith(stem.toLowerCase())), stemLength: stem.length };
    }
    const mapContext = vc.propertyMapContext(before, vc.aliasMap(aliasSource));
    if (mapContext) {
      const stem = before.match(/(\w*)$/)?.[1] ?? "";
      const props = mapContext.label ? vc.propertiesOf(schema, mapContext.label).filter((p) => !mapContext.used.includes(p)) : [];
      return { list: props.filter((p) => p.toLowerCase().startsWith(stem.toLowerCase())), stemLength: stem.length };
    }
    if (m = before.match(/(\w+)\.(\w*)$/)) {
      const alias = m[1] ?? "";
      const stem = m[2] ?? "";
      const label = vc.aliasMap(aliasSource)[alias];
      if (label) {
        const props = vc.propertiesOf(schema, label);
        return { list: props.filter((p) => p.toLowerCase().startsWith(stem.toLowerCase())), stemLength: stem.length };
      }
    }
    return null;
  }
  function createCypherHint(CodeMirror, vc, options) {
    return (editor) => {
      const cursor = editor.getCursor();
      const line = editor.getLine(cursor.line);
      const before = line.slice(0, cursor.ch);
      const found = (list, from) => ({
        list: [...list].sort((a, b) => a.localeCompare(b)),
        from: CodeMirror.Pos(cursor.line, from),
        to: CodeMirror.Pos(cursor.line, cursor.ch)
      });
      const schema = options.schema();
      let m;
      if (m = before.match(/via:\s*'(\w*)$/)) {
        const stem = m[1] ?? "";
        return found(vc.VIA_VALUES.filter((v) => v.startsWith(stem)), cursor.ch - stem.length);
      }
      if (m = before.match(/ai:\s*\{[^}]*?(\w*)$/)) {
        const stem = m[1] ?? "";
        return found(vc.AI_KEYS.filter((k) => k.startsWith(stem)), cursor.ch - stem.length);
      }
      const fragment = cypherFragmentCompletions(vc, schema, before, editor.getValue());
      if (fragment) return found(fragment.list, cursor.ch - fragment.stemLength);
      if (m = before.match(/(\w+)$/)) {
        const stem = m[1] ?? "";
        const labels = (schema?.labels ?? []).map((l) => l.label);
        const pool = [...options.keywords ?? [], ...labels];
        return found(pool.filter((w) => w.toLowerCase().startsWith(stem.toLowerCase())), cursor.ch - stem.length);
      }
      return null;
    };
  }
  var CYPHER_KEYWORDS = [
    "MATCH",
    "WHERE",
    "RETURN",
    "ORDER BY",
    "LIMIT",
    "WITH",
    "DISTINCT",
    "AND",
    "OR",
    "NOT",
    "CONTAINS",
    "STARTS WITH",
    "ENDS WITH",
    "IN",
    "IS NULL",
    "IS NOT NULL",
    "count(",
    "toLower(",
    "ai.relevant(",
    "ai.score(",
    "ai.classify("
  ];
  function createSessionCypherHint(CodeMirror, vc, options) {
    const base = createCypherHint(CodeMirror, vc, options);
    return (editor) => base({
      getCursor: () => editor.getCursor(),
      getLine: (line) => editor.getLine(line),
      getValue: () => options.bindings().map((b) => `MATCH (${b.variable}:${b.label})`).join("\n") + "\n" + editor.getValue()
    });
  }
  return __toCommonJS(index_exports);
})();
