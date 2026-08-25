/*
 * THE SESSION GRAMMAR — you type REAL CYPHER, one clause at a time.
 *
 * Every line is a verbatim clause of the query the session is building. `MATCH (c:Chunk)` runs
 * and captures (the `RETURN c` is implied from YOUR variable); `WHERE c.source CONTAINS '…'` is
 * legitimately the next clause — `c` means something because you bound it; a later
 * `MATCH (c)<-[:HAS_CHUNK]-(d:Document)` continues from it. The transcript IS the pipeline.
 *
 * Two forms per line:
 *  - the SESSION form, which is what runs: a continuation binds off the captured scope
 *    (`(c:` + backtick + `$_2` + backtick + `)`) so it re-reads a frozen member set instead of
 *    re-running everything before it;
 *  - the PIPELINE, which is the user's own clauses accumulated (plus `WITH` stage boundaries) —
 *    one real, scope-free query, the thing "Save as view" keeps.
 *
 * Lines, in the order they are tried:
 *
 *   pin <name>            pin a scope
 *   $name                 peek a scope (25 rows, not captured)
 *   name = MATCH …        run and bind the capture under <name>
 *   MATCH …               open a set, or continue from a variable you bound earlier;
 *                         RETURN is implied when omitted; captures when one labelled/bound
 *                         variable comes back
 *   WHERE …               narrow the newest set — the next clause of its MATCH
 *   RETURN … / ORDER BY … / LIMIT …
 *                         project or shape the newest set — shown, not captured
 *
 * Pure and DOM-free. Shared here so the Me app and the Worlds console elaborate the SAME line
 * into the SAME Cypher — the session is one grammar, not two readings of a sketch.
 */
export const PEEK_LIMIT = 25;
/** `RETURN [DISTINCT] var [ORDER/SKIP/LIMIT…]` — the subset shape the appliance can capture. */
const SUBSET_RETURN = /\bRETURN\s+(?:DISTINCT\s+)?([A-Za-z_]\w*)\s*(?=\bLIMIT\b|\bORDER\b|\bSKIP\b|$)/i;
/** Node atoms in a pattern: `(var:Label)` or `(var)` — in order of appearance. */
const NODE_ATOM = /\(\s*([A-Za-z_]\w*)\s*(?::\s*(`?\$?[A-Za-z_]\w*`?))?\s*[){]/g;
function scopeRef(alias, name) {
    return `(${alias}:\`$${name}\`)`;
}
/** Rename a whole-word variable in pipeline clauses — the view inliner's move. */
function renameVar(stages, from, to) {
    if (from === to)
        return stages;
    const re = new RegExp(`\\b${from}\\b`, 'g');
    return stages.map((s) => s.replace(re, to));
}
function nodeAtoms(pattern) {
    return [...pattern.matchAll(NODE_ATOM)].map((m) => ({ variable: m[1], label: m[2] ?? null }));
}
export function planLine(raw, current, nextAutoName, findByName, findByVariable) {
    const line = raw.trim().replace(/;$/, '');
    if (!line)
        return { kind: 'error', error: 'nothing to run' };
    // pin <name>
    const pin = line.match(/^pin\s+\$?([A-Za-z_]\w*)$/i);
    if (pin)
        return { kind: 'pin', pinTarget: pin[1] };
    // $name — peek, not captured
    const peek = line.match(/^\$([A-Za-z_]\w*)$/);
    if (peek) {
        return {
            kind: 'run',
            cypher: `MATCH ${scopeRef('x', peek[1])} RETURN x LIMIT ${PEEK_LIMIT}`,
            tabular: true,
            note: `peeking $${peek[1]} — first ${PEEK_LIMIT}`,
        };
    }
    // name = MATCH … — explicit binding
    const named = line.match(/^([A-Za-z_]\w*)\s*=\s*(.+)$/s);
    if (named && !/^\s*(WHERE|RETURN|ORDER|LIMIT|SKIP)\b/i.test(named[2])) {
        const [, name, rest] = named;
        const aliased = rest.trim().match(/^\$([A-Za-z_]\w*)$/);
        if (aliased) {
            const source = findByName(aliased[1]);
            if (!source)
                return { kind: 'error', error: `unknown scope '$${aliased[1]}'` };
            return {
                kind: 'run',
                cypher: `MATCH ${scopeRef(source.variable, source.name)} RETURN ${source.variable}`,
                captureAs: name,
                variable: source.variable,
                pipeline: source.pipeline,
            };
        }
        const inner = planLine(rest, current, nextAutoName, findByName, findByVariable);
        if (inner.kind !== 'run' || inner.tabular) {
            return { kind: 'error', error: `'${name} =' needs a MATCH that captures a node set` };
        }
        return { ...inner, captureAs: name };
    }
    // MATCH … — open a set, or continue from variables bound earlier
    if (/^(MATCH|OPTIONAL\s+MATCH)\b/i.test(line)) {
        const atoms = nodeAtoms(line);
        /* CONTINUATION: a bare `(c)` whose variable an earlier line bound is re-anchored on that
         * line's frozen scope. The pipeline keeps the user's clause VERBATIM — after `WITH c` a bare
         * `(c)` is exactly right — which is what makes the transcript real Cypher. */
        const consumed = [];
        let sessionForm = line;
        let pipelineClause = line;
        for (const atom of atoms) {
            if (atom.label === null) {
                // `(c)` where an earlier line bound c — re-anchor on that line's frozen scope.
                const b = findByVariable(atom.variable);
                if (!b)
                    continue;
                consumed.push(b);
                sessionForm = sessionForm.replace(new RegExp(`\\(\\s*${atom.variable}\\s*\\)`), scopeRef(atom.variable, b.name));
            }
            else {
                // An explicit `(x:` + backtick + `$name` + backtick + `)` reference typed by hand:
                // runs as-is, and the PIPELINE splices that binding's own clauses (renamed to the
                // alias) so the saved query stays scope-free.
                const ref = atom.label.match(/^`\$([A-Za-z_]\w*)`$/);
                if (!ref)
                    continue;
                const b = findByName(ref[1]);
                if (!b)
                    continue;
                consumed.push({ ...b, pipeline: renameVar(b.pipeline, b.variable, atom.variable), variable: atom.variable });
                pipelineClause = pipelineClause.replace(new RegExp(`\\(\\s*${atom.variable}\\s*:\\s*\`\\$${ref[1]}\`\\s*\\)`), `(${atom.variable})`);
            }
        }
        const explicit = line.match(SUBSET_RETURN);
        const hasReturn = /\bRETURN\b/i.test(line);
        // The variable the capture will carry: the RETURNed one, else the LAST node the pattern
        // introduces with a label (the thing you traversed TO).
        const introduced = atoms.filter((a) => a.label !== null);
        const captureVar = explicit?.[1] ?? introduced.at(-1)?.variable;
        const capturable = captureVar !== undefined && (
        // labelled in this line, bound earlier, or RETURNing a scope-anchored continuation var
        introduced.some((a) => a.variable === captureVar) || consumed.some((b) => b.variable === captureVar));
        if (hasReturn && !capturable) {
            return {
                kind: 'run',
                cypher: sessionForm,
                tabular: true,
                note: explicit ? `\`${explicit[1]}\` has no label to bind with — label it to capture` : undefined,
                tabularPipeline: pipelineFor(consumed, pipelineClause),
            };
        }
        if (hasReturn) {
            const prefix = pipelineClause.slice(0, pipelineClause.search(/\bRETURN\b/i)).trim();
            return {
                kind: 'run',
                cypher: sessionForm,
                captureAs: nextAutoName,
                variable: captureVar,
                pipeline: pipelineFor(consumed, prefix),
            };
        }
        if (!capturable) {
            return { kind: 'error', error: 'no labelled variable to return — label a node, e.g. MATCH (c:Chunk)' };
        }
        // RETURN implied from the user's own variable; DISTINCT when the pattern fans out.
        const distinct = atoms.length > 1 ? 'DISTINCT ' : '';
        return {
            kind: 'run',
            cypher: `${sessionForm} RETURN ${distinct}${captureVar}`,
            captureAs: nextAutoName,
            variable: captureVar,
            pipeline: pipelineFor(consumed, pipelineClause),
            note: `RETURN ${distinct}${captureVar} implied`,
        };
    }
    // AND … — extends the newest set's WHERE. Runs as a plain narrow (conjunction composes with a
    // frozen set); the PIPELINE appends onto the previous WHERE so the saved query reads as one
    // condition. The condition is parenthesized: `AND a OR b` must not rebind the original clause.
    if (/^AND\b/i.test(line)) {
        if (!current)
            return { kind: 'error', error: 'nothing to narrow — MATCH something first' };
        const cond = line.replace(/^AND\s+/i, '');
        const v = current.variable;
        const last = current.pipeline.at(-1) ?? '';
        const pipeline = /\bWHERE\b/i.test(last)
            ? [...current.pipeline.slice(0, -1), `${last} AND (${cond})`]
            : [...current.pipeline, /^(OPTIONAL\s+)?MATCH\b/i.test(last) ? `WHERE ${cond}` : `WITH ${v} WHERE ${cond}`];
        return {
            kind: 'run',
            cypher: `MATCH ${scopeRef(v, current.name)} WHERE ${cond} RETURN ${v}`,
            captureAs: nextAutoName,
            variable: v,
            pipeline,
        };
    }
    // OR cannot honestly extend a FROZEN set: the members the earlier WHERE dropped are gone, so
    // running `OR …` here would return something different from the saved pipeline. Refuse, and say
    // where the widened query can be written.
    if (/^OR\b/i.test(line)) {
        return {
            kind: 'error',
            error: "OR would WIDEN the set, and a frozen set can only narrow — open the pipeline in the editor (Cypher → Open in editor) and edit its WHERE instead",
        };
    }
    // WHERE … — the next clause of the newest set's MATCH
    if (/^WHERE\b/i.test(line)) {
        if (!current)
            return { kind: 'error', error: 'nothing to narrow — MATCH something first' };
        const v = current.variable;
        const last = current.pipeline.at(-1) ?? '';
        // WHERE legally extends a MATCH that has none yet; anywhere else it needs a WITH stage.
        const stage = /^(OPTIONAL\s+)?MATCH\b/i.test(last) && !/\bWHERE\b/i.test(last) ? line : `WITH ${v} ${line}`;
        return {
            kind: 'run',
            cypher: `MATCH ${scopeRef(v, current.name)} ${line} RETURN ${v}`,
            captureAs: nextAutoName,
            variable: v,
            pipeline: [...current.pipeline, stage],
        };
    }
    // RETURN … / ORDER BY … / LIMIT … / SKIP … — project or shape the newest set. Shown, not captured.
    if (/^(RETURN|ORDER\s+BY|LIMIT|SKIP)\b/i.test(line)) {
        if (!current)
            return { kind: 'error', error: 'nothing to project — MATCH something first' };
        const v = current.variable;
        const clause = /^RETURN\b/i.test(line) ? line : `RETURN ${v} ${line}`;
        return {
            kind: 'run',
            cypher: `MATCH ${scopeRef(v, current.name)} ${clause}`,
            tabular: true,
            tabularPipeline: [...current.pipeline, clause],
        };
    }
    return {
        kind: 'error',
        error: "type a Cypher clause — MATCH …, WHERE …, RETURN … — or 'name = MATCH …', 'pin name', '$name'",
    };
}
/** The new binding's pipeline: continued lines follow their source's clauses across a WITH
 *  boundary (carrying every consumed variable); an opening line stands alone. */
function pipelineFor(consumed, clause) {
    if (consumed.length === 0)
        return [clause];
    const base = consumed[0];
    const vars = consumed.map((b) => b.variable).join(', ');
    return [...base.pipeline, `WITH DISTINCT ${vars}`, clause];
}
/**
 * Complete a RETURN-less `MATCH …` into runnable Cypher by implying `RETURN <last labelled var>`
 * (`DISTINCT` when the pattern fans out) — the Session rule, shared with the Query editor's Run
 * and Capture so `MATCH (c:Chunk)` works everywhere, not just in the transcript.
 */
export function completeQuery(raw) {
    const cypher = raw.trim().replace(/;$/, '');
    if (!/^(MATCH|OPTIONAL\s+MATCH)\b/i.test(cypher) || /\bRETURN\b/i.test(cypher))
        return { cypher };
    const atoms = nodeAtoms(cypher);
    const variable = atoms.filter((a) => a.label !== null).at(-1)?.variable;
    if (!variable)
        return { cypher };
    const distinct = atoms.length > 1 ? 'DISTINCT ' : '';
    return { cypher: `${cypher} RETURN ${distinct}${variable}`, note: `RETURN ${distinct}${variable} implied` };
}
/** The one real query this session has built so far — the Save-as-view text. */
export function pipelineText(stages, returnClause) {
    const body = [...stages];
    if (returnClause)
        body.push(returnClause);
    return body.join('\n');
}
//# sourceMappingURL=session.js.map