"use strict";
/*
 * THE CYPHER COMPLETION, orchestrated once. Every DECISION — which labels may
 * open a pattern, which edges leave a node, which properties a map may still
 * bind — lives in @embabel/vc; this file owns only the branch ORDER and the
 * editor mechanics, which both studios (and the Worlds console) must agree on
 * or the same keystroke completes differently per surface.
 *
 * @embabel/vc is INJECTED, never imported: bundling it here would put a second
 * copy of the semantics on every page that already loads EmbabelVc.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.CYPHER_KEYWORDS = void 0;
exports.cypherFragmentCompletions = cypherFragmentCompletions;
exports.createCypherHint = createCypherHint;
exports.createSessionCypherHint = createSessionCypherHint;
/**
 * Schema-aware completions for a Cypher FRAGMENT — the text before the cursor,
 * with [aliasSource] the widest text aliases may be declared in (the whole
 * editor for a query; the fragment itself for Cypher inside a kg-call string).
 * The pattern-position branches only; a full editor adds via/ai/keywords via
 * [createCypherHint]. Null when nothing pattern-shaped is being typed.
 */
function cypherFragmentCompletions(vc, schema, before, aliasSource) {
    let m;
    // (x:Lab… → labels: the far end of the edge behind it, or pattern-openers at
    // first position (reach-only labels are legal only after an edge).
    if ((m = before.match(/[([]\s*\w*:(\w*)$/)) && before.lastIndexOf('(') > before.lastIndexOf('[')) {
        const stem = m[1] ?? '';
        const context = vc.nodeContext(before, vc.aliasMap(aliasSource));
        const labels = (context
            ? vc.connectedLabels(schema, context.label, context.type, context.direction)
            : vc.anchorLabels(schema)).filter(starts(stem));
        const items = labels.map((l) => labelItem(vc, schema, l));
        // A reach-only label typed where a pattern OPENS is refused bare, so it is offered as the
        // pattern that reaches it — once a person has begun to name it, so the list is not every
        // anchored form in the world.
        if (!context && stem)
            items.push(...anchoredItems(vc, schema, before, stem));
        return { list: labels, stemLength: stem.length, items };
    }
    // [r:REL… → the edges the schema has seen at the node on the left.
    if ((m = before.match(/\[\s*\w*:(\w*)$/))) {
        const stem = m[1] ?? '';
        const context = vc.edgeContext(before, vc.aliasMap(aliasSource));
        const rels = vc.relationshipTypesFor(schema, context?.label, context?.direction).filter(starts(stem));
        const items = rels.map((r) => ({ label: r, text: r, doc: vc.relationshipDoc?.(schema, r, context?.label) || undefined }));
        return { list: rels, stemLength: stem.length, items };
    }
    // (c:Concept {na… → the label's own property KEYS, minus what the map binds.
    const mapContext = vc.propertyMapContext(before, vc.aliasMap(aliasSource));
    if (mapContext) {
        const stem = before.match(/(\w*)$/)?.[1] ?? '';
        const props = mapContext.label
            ? vc.propertiesOf(schema, mapContext.label).filter((p) => !mapContext.used.includes(p)).filter(starts(stem))
            : [];
        return { list: props, stemLength: stem.length, items: propertyItems(vc, schema, mapContext.label, props) };
    }
    // alias.prop… → that alias's label's properties.
    if ((m = before.match(/(\w+)\.(\w*)$/))) {
        const alias = m[1] ?? '';
        const stem = m[2] ?? '';
        const label = vc.aliasMap(aliasSource)[alias];
        if (label) {
            const props = vc.propertiesOf(schema, label).filter(starts(stem));
            return { list: props, stemLength: stem.length, items: propertyItems(vc, schema, label, props) };
        }
    }
    return null;
}
function labelItem(vc, schema, label) {
    return { label, text: label, doc: vc.labelDoc?.(schema, label) || undefined };
}
function propertyItems(vc, schema, label, names) {
    const details = label && vc.propertyDetails ? vc.propertyDetails(schema, label) : [];
    return names.map((name) => {
        const property = details.find((p) => p.name === name);
        const type = property?.type && property.type !== 'any' ? property.type : undefined;
        const described = property?.description?.trim() ?? '';
        // An older appliance described an undocumented property by its own name; that says nothing.
        const doc = described && described.toLowerCase() !== name.toLowerCase() ? described : undefined;
        return { label: name, text: name, detail: type, doc };
    });
}
/*
 * `(r:ConfigR` at the head of a pattern: ConfigRun cannot open it, so offer what can —
 * `(me:AssistantUser)-[:HAS_CONFIG]->(r:ConfigRun` — replacing the `r:ConfigR` typed so far, with the
 * person's own variable kept. One item per door, the user anchor's first.
 */
function anchoredItems(vc, schema, before, stem) {
    if (!vc.labelDoors || !vc.anchoredPattern || !vc.labelNames)
        return [];
    const typed = before.match(/\(\s*(\w*)\s*:\w*$/);
    if (!typed)
        return [];
    const variable = typed[1] ?? '';
    const replaceLength = before.length - before.lastIndexOf('(') - 1;
    const opens = new Set(vc.anchorLabels(schema));
    return vc.labelNames(schema)
        .filter((l) => !opens.has(l) && starts(stem)(l))
        .flatMap((label) => vc.labelDoors(schema, label).slice(0, 3).map((door) => {
        // The pattern without its closing paren: the cursor lands where a property map or `)` goes next.
        const pattern = vc.anchoredPattern(door, label, variable);
        return {
            label: `${label} via ${door.anchor}`,
            text: pattern.slice(1, -1),
            detail: 'anchored',
            doc: vc.labelDoc?.(schema, label) || undefined,
            replaceLength,
        };
    }));
}
function starts(stem) {
    return (name) => name.toLowerCase().startsWith(stem.toLowerCase());
}
/**
 * The full editor hint for a Cypher editor, ready for
 * `CodeMirror.registerHelper('hint', 'cypher', createCypherHint(CodeMirror, vc, options))`.
 * Every list alphabetical: completion is for scanning, not for whatever order
 * the schema snapshot happened to arrive in.
 */
function createCypherHint(CodeMirror, vc, options) {
    return (editor) => {
        const cursor = editor.getCursor();
        const line = editor.getLine(cursor.line);
        const before = line.slice(0, cursor.ch);
        const found = (list, from) => ({
            list: [...list].sort((a, b) => a.localeCompare(b)),
            from: CodeMirror.Pos(cursor.line, from),
            to: CodeMirror.Pos(cursor.line, cursor.ch),
        });
        // CodeMirror's show-hint takes objects as readily as strings: `text` is inserted, `displayText`
        // listed, a per-item `from` widens what is replaced, and `render` draws the row. A name the
        // schema says nothing more about stays the plain string it always was.
        const foundItems = (items, stemLength) => ({
            list: [...items].sort((a, b) => a.label.localeCompare(b.label)).map((item) => !item.detail && !item.doc && item.replaceLength === undefined && item.text === item.label ? item.text : {
                text: item.text,
                displayText: item.label,
                className: 'kit-hint',
                ...(item.replaceLength !== undefined ? { from: CodeMirror.Pos(cursor.line, cursor.ch - item.replaceLength) } : {}),
                render: (element) => renderItem(element, item),
            }),
            from: CodeMirror.Pos(cursor.line, cursor.ch - stemLength),
            to: CodeMirror.Pos(cursor.line, cursor.ch),
        });
        const schema = options.schema();
        let m;
        // via:'… and ai:{ … are the ENGINE's vocabulary, ahead of pattern branches
        // (a property map otherwise swallows the ai:{ keys).
        if ((m = before.match(/via:\s*'(\w*)$/))) {
            const stem = m[1] ?? '';
            return found(vc.VIA_VALUES.filter((v) => v.startsWith(stem)), cursor.ch - stem.length);
        }
        if ((m = before.match(/ai:\s*\{[^}]*?(\w*)$/))) {
            const stem = m[1] ?? '';
            return found(vc.AI_KEYS.filter((k) => k.startsWith(stem)), cursor.ch - stem.length);
        }
        const fragment = cypherFragmentCompletions(vc, schema, before, editor.getValue());
        if (fragment) {
            return fragment.items ? foundItems(fragment.items, fragment.stemLength) : found(fragment.list, cursor.ch - fragment.stemLength);
        }
        // bare word → keywords and labels
        if ((m = before.match(/(\w+)$/))) {
            const stem = m[1] ?? '';
            const labels = (schema?.labels ?? []).map((l) => l.label);
            const pool = [...(options.keywords ?? []), ...labels];
            return found(pool.filter((w) => w.toLowerCase().startsWith(stem.toLowerCase())), cursor.ch - stem.length);
        }
        return null;
    };
}
/*
 * One row: the name, a dim tag (a property's type; `anchored` for a pattern), and the documentation.
 * The documentation is in the row so it travels with the completion; the stylesheet shows it in full
 * on the ACTIVE row and clips it elsewhere, so scanning stays a list of names. Text only — every word
 * here came from a schema a realm wrote, and none of it is markup.
 */
function renderItem(element, item) {
    const doc = element.ownerDocument;
    const span = (className, text) => {
        const node = doc.createElement('span');
        node.className = className;
        node.textContent = text;
        return node;
    };
    element.append(span('kit-hint-name', item.label));
    if (item.detail)
        element.append(span('kit-hint-detail', item.detail));
    if (item.doc)
        element.append(span('kit-hint-doc', item.doc));
}
/** The bare-word vocabulary both studios teach. Shared so one keystroke completes the same way
 *  in Me and in the console; `ai.relevant/score/classify` are here because per-row judgment is
 *  textual by nature — there is no control that expresses it. */
exports.CYPHER_KEYWORDS = [
    'MATCH', 'WHERE', 'RETURN', 'ORDER BY', 'LIMIT', 'WITH', 'DISTINCT', 'AND', 'OR', 'NOT',
    'CONTAINS', 'STARTS WITH', 'ENDS WITH', 'IN', 'IS NULL', 'IS NOT NULL', 'count(', 'toLower(',
    'ai.relevant(', 'ai.score(', 'ai.classify(',
];
/**
 * The SESSION-AWARE completion: `createCypherHint`, with the session's bindings synthesized into
 * the alias context. A one-line prompt holding only `WHERE c.` completes Chunk's properties
 * because the transcript bound `c` — the proxy prepends one `MATCH (var:Label)` line per binding
 * to `getValue`, and touches nothing else: the hint replaces text by cursor coordinates, which
 * stay on the REAL editor.
 */
function createSessionCypherHint(CodeMirror, vc, options) {
    const base = createCypherHint(CodeMirror, vc, options);
    return (editor) => base({
        getCursor: () => editor.getCursor(),
        getLine: (line) => editor.getLine(line),
        getValue: () => options.bindings().map((b) => `MATCH (${b.variable}:${b.label})`).join('\n') + '\n' + editor.getValue(),
    });
}
//# sourceMappingURL=hints.js.map