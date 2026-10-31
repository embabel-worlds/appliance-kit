import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
/*
 * THE PLAN PANEL: what the appliance's planner makes of a goal, shown while it is being written.
 *
 * A goal is the final query someone wants answered, written over facts that may not exist yet —
 * an Issue projected from meeting notes, a TRACKED_BY edge a judging view draws. The planner finds
 * the views and rules that make those facts and compiles them into one statement. This panel asks
 * it, as the goal settles, and shows the answer: which facts the goal reads and what produces each,
 * the chain of steps in the order they run, what each one reaches beyond the stored graph, and the
 * one statement they compile to.
 *
 * TYPING NEVER RUNS ANYTHING. The as-you-type call is `plan`, whose route on the appliance cannot
 * execute a step, call a model or read a source. Running is `runPlan`, behind a button, and nothing
 * else in this file reaches it. A plan whose steps ask a model costs money and time every run; a
 * keystroke must not be what spends it.
 *
 * Every outcome is an answer, and each is shown as one: `unreachable` names the fact nothing
 * produces, `tie` names the rival plans, `refused` says what to change. None is an error state.
 *
 * A step's cost class — stored, API, AI — is read from what the appliance says the step REACHES,
 * not from its numeric cost: the number comes from a heuristic a deployment can replace, and a label
 * inferred from it would be a guess about whichever one is installed.
 *
 * The chain is a list, not a diagram. Nothing either console ships draws Mermaid, and a plan is a
 * sequence; adding a diagram library to draw a sequence would be weight for nothing.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { rowColumns } from "../../../vc/rows.js";
import { RowTable, Status, failureMessage, isAbsent } from "../studio/chrome.js";
const DEFAULT_DEBOUNCE_MS = 700;
/**
 * A fact as the planner writes it, as a person reads it: `node:Issue` is an Issue,
 * `edge:Attendee-RAISED->Issue` is the pattern it would be in a query. Anything else is shown as
 * sent rather than guessed at.
 */
export function factLabel(fact) {
    if (fact.startsWith('node:'))
        return fact.slice('node:'.length);
    if (fact.startsWith('input:'))
        return `${fact.slice('input:'.length)} input`;
    const edge = /^edge:([^-]+)-([^-]+)->(.+)$/.exec(fact);
    if (edge)
        return `(${edge[1]})-[:${edge[2]}]->(${edge[3]})`;
    return fact;
}
/** Stored, API or AI: what a step goes beyond the graph for, from what it reaches. */
export function costClass(step) {
    const api = step.reaches.includes('api');
    const model = step.reaches.includes('model');
    if (api && model)
        return 'API + AI';
    if (model)
        return 'AI';
    if (api)
        return 'API';
    return 'stored';
}
/* Only inputs with a name and a value are sent: a row still being filled in is not an input yet. */
function inputsOf(rows) {
    const inputs = {};
    for (const row of rows) {
        const name = row.name.trim();
        if (name && row.value.trim())
            inputs[name] = { type: row.type.trim() || 'text', value: row.value };
    }
    return inputs;
}
function Fact({ fact }) {
    return _jsx("code", { className: "planfact", title: fact, children: factLabel(fact) });
}
function Producers({ answer }) {
    const reads = answer.reads ?? [];
    if (!reads.length)
        return null;
    const steps = answer.steps ?? [];
    return (_jsxs("div", { className: "planreads", children: [_jsx("h3", { children: "What the goal reads" }), _jsx("ul", { children: reads.map((fact) => {
                    const makers = steps.filter((step) => step.adds.includes(fact)).map((step) => step.from);
                    return (_jsxs("li", { children: [_jsx(Fact, { fact: fact }), _jsx("span", { className: "planfrom", children: fact.startsWith('input:') ? ' ← what you supply' : makers.length ? ` ← ${makers.join(', ')}` : '' })] }, fact));
                }) })] }));
}
function Chain({ steps }) {
    return (_jsx("ol", { className: "planchain", children: steps.map((step) => (_jsxs("li", { className: "planstep", children: [_jsxs("div", { className: "planstep-head", children: [_jsx("strong", { children: step.from }), _jsx("span", { className: "plantag", children: step.kind }), _jsx("span", { className: `plantag plancost plancost-${costClass(step).replace(/\W+/g, '').toLowerCase()}`, title: `Cost ${step.cost} in the planner's units`, children: costClass(step) }), step.realm && _jsxs("span", { className: "hint", children: ["from ", step.realm] }), !step.runs && _jsx("span", { className: "hint", children: "fires when read" })] }), step.adds.length > 0 && _jsxs("div", { className: "planstep-facts", children: ["adds ", step.adds.map((f) => _jsx(Fact, { fact: f }, f))] }), step.requires.length > 0 && _jsxs("div", { className: "planstep-facts", children: ["needs ", step.requires.map((f) => _jsx(Fact, { fact: f }, f))] })] }, step.from))) }));
}
function Quote({ answer }) {
    const quote = answer.quote;
    if (!quote)
        return null;
    const parts = [];
    if (quote.modelCalls != null)
        parts.push(`~${quote.modelCalls} model call(s)`);
    if (quote.apiCalls != null)
        parts.push(`~${quote.apiCalls} API call(s)`);
    return (_jsxs("div", { className: "planquote", children: [parts.length > 0 && _jsxs("div", { className: "hint", children: ["Quote: ", parts.join(', ')] }), quote.wouldRefuse && _jsxs(Status, { tone: "caution", children: ["The cost gate would refuse this run: ", quote.wouldRefuse] }), quote.unpriced.map((line) => _jsx("div", { className: "hint", children: line }, line))] }));
}
/** The answer itself, one branch per outcome. */
function Outcome({ answer }) {
    switch (answer.outcome) {
        case 'planned':
            /* A goal over stored data alone needs no step; the planner says so by choosing none. */
            if (!(answer.steps ?? []).length) {
                return _jsx("div", { className: "hint planstored", children: "This reads only what the world already holds: no step is needed, so it runs as written." });
            }
            return (_jsxs(_Fragment, { children: [_jsx(Producers, { answer: answer }), _jsx("h3", { children: "The chain" }), _jsx(Chain, { steps: answer.steps ?? [] }), _jsx(Quote, { answer: answer })] }));
        case 'unreachable':
            return (_jsxs("div", { className: "planunreachable", children: [(answer.missing ?? []).map((fact) => (_jsxs(Status, { tone: "caution", children: ["Nothing produces ", _jsx(Fact, { fact: fact }), "."] }, fact))), answer.detail && _jsx("div", { className: "hint", children: answer.detail })] }));
        case 'tie':
            return (_jsxs("div", { className: "plantie", children: [_jsxs(Status, { tone: "caution", children: [(answer.plans ?? []).length, " plans reach this at the same cost. Make the goal more specific to choose between them."] }), _jsx("ul", { children: (answer.plans ?? []).map((plan) => _jsx("li", { children: plan.join(' → ') }, plan.join('>'))) })] }));
        /* The two English-mode answers. The panel sends a goal, so these arrive only from a host that asks a question. */
        case 'needsInput':
            return (_jsxs(Status, { tone: "caution", children: ["This needs ", answer.needsInput?.type === 'text' ? 'some text' : `a ${answer.needsInput?.type}`, " as input: ", answer.needsInput?.why] }));
        case 'declined':
            return (_jsxs("div", { className: "planunreachable", children: [answer.reason && _jsx(Status, { tone: "caution", children: answer.reason }), (answer.missing ?? []).map((fact) => (_jsxs(Status, { tone: "caution", children: ["Nothing produces ", _jsx(Fact, { fact: fact }), "."] }, fact)))] }));
        default:
            return (_jsx("div", { className: "planrefused", children: (answer.reasons ?? []).map((reason) => _jsx(Status, { tone: "error", children: reason }, reason)) }));
    }
}
const HEADLINE = {
    planned: 'Planned',
    unreachable: 'Not reachable',
    tie: 'Tied',
    refused: 'Cannot plan this as written',
    needsInput: 'Needs an input',
    declined: 'Declined',
};
export function PlanPanel({ services, goal, debounceMs = DEFAULT_DEBOUNCE_MS, onShowCompiled }) {
    const [answer, setAnswer] = useState(null);
    const [planning, setPlanning] = useState(false);
    const [problem, setProblem] = useState('');
    const [absent, setAbsent] = useState(false);
    const [rows, setRows] = useState([]);
    const [inputsOpen, setInputsOpen] = useState(false);
    const [compiledOpen, setCompiledOpen] = useState(false);
    const [run, setRun] = useState(null);
    const [running, setRunning] = useState(false);
    const [saveOpen, setSaveOpen] = useState(false);
    const [viewName, setViewName] = useState('');
    const [viewDescription, setViewDescription] = useState('');
    const [saveStatus, setSaveStatus] = useState(null);
    const nextRow = useRef(1);
    const latest = useRef(0);
    const inputs = useMemo(() => inputsOf(rows), [rows]);
    const inputsKey = JSON.stringify(inputs);
    const trimmed = goal.trim();
    /*
     * The dry run, once the goal and inputs have been still for `debounceMs`. Each request takes a
     * number and only the newest may land, so a slow answer about an older goal never overwrites the
     * answer about the current one. Unmounting bumps the number too.
     */
    useEffect(() => {
        const n = ++latest.current;
        setRun(null);
        if (!trimmed || absent) {
            setAnswer(null);
            setPlanning(false);
            if (!absent)
                setProblem('');
            return;
        }
        setPlanning(true);
        const timer = setTimeout(async () => {
            const result = await services.plan(trimmed, JSON.parse(inputsKey));
            if (n !== latest.current)
                return;
            setPlanning(false);
            if (!result.ok) {
                /* An appliance without a planner says so once and then stays quiet, rather than on every keystroke. */
                if (isAbsent(result))
                    setAbsent(true);
                setProblem(failureMessage(result, 'plan this goal'));
                setAnswer(null);
                return;
            }
            setProblem('');
            setAnswer(result.value);
        }, debounceMs);
        return () => clearTimeout(timer);
    }, [trimmed, inputsKey, services, debounceMs, absent]);
    useEffect(() => () => { latest.current++; }, []);
    async function runIt() {
        if (!trimmed || running)
            return;
        setRunning(true);
        const result = await services.runPlan(trimmed, inputs);
        setRunning(false);
        setRun(result.ok ? { answer: result.value } : { problem: failureMessage(result, 'run this plan') });
    }
    async function save(event) {
        event.preventDefault();
        const name = viewName.trim();
        if (!name || !services.saveGoalView)
            return;
        const result = await services.saveGoalView({ name, goal: trimmed, description: viewDescription.trim() });
        setSaveStatus(result.ok
            ? { tone: 'ok', text: `Saved as ${result.value.name ?? name}.` }
            : { tone: 'error', text: failureMessage(result, 'save this goal as a view') });
    }
    function updateRow(id, patch) {
        setRows((current) => current.map((row) => row.id === id ? { ...row, ...patch } : row));
    }
    if (!trimmed) {
        return (_jsx("div", { className: "kit-feature kit-feature-plan plan", children: _jsx("p", { className: "hint", children: "Write the query you want answered, over the facts you want made, and the plan shows here." }) }));
    }
    const planned = answer?.outcome === 'planned';
    return (_jsxs("div", { className: "kit-feature kit-feature-plan plan", "aria-busy": planning, children: [_jsxs("div", { className: "planhead", children: [_jsx("strong", { children: answer ? HEADLINE[answer.outcome] ?? answer.outcome : planning ? 'Planning…' : 'Plan' }), answer && planning && _jsx("span", { className: "hint", children: "updating\u2026" })] }), problem && _jsx(Status, { tone: absent ? null : 'error', children: problem }), answer && _jsx(Outcome, { answer: answer }), answer?.diagnostics && answer.diagnostics.length > 0 && (_jsxs("details", { className: "plandiagnostics", children: [_jsxs("summary", { children: [answer.diagnostics.length, " step(s) left out of planning"] }), _jsx("ul", { children: answer.diagnostics.map((line) => _jsx("li", { children: line }, line)) })] })), _jsxs("div", { className: "row planactions", children: [_jsx("button", { className: "btn", disabled: !planned, onClick: () => (onShowCompiled && answer?.compiled ? onShowCompiled(answer.compiled) : setCompiledOpen((open) => !open)), children: compiledOpen && !onShowCompiled ? 'Hide compiled' : 'Show compiled' }), _jsx("button", { className: "btn", "aria-expanded": inputsOpen, onClick: () => setInputsOpen((open) => !open), children: "Run with input\u2026" }), services.saveGoalView && (_jsx("button", { className: "btn", "aria-expanded": saveOpen, onClick: () => setSaveOpen((open) => !open), children: "Save as goal view" }))] }), compiledOpen && !onShowCompiled && planned && answer?.compiled && (_jsx("pre", { className: "plancompiled", children: answer.compiled })), inputsOpen && (_jsxs("div", { className: "planinputs", children: [rows.map((row) => (_jsxs("div", { className: "row planinput", children: [_jsx("input", { "aria-label": "Input name", placeholder: "name, e.g. notes", value: row.name, onChange: (e) => updateRow(row.id, { name: e.target.value }) }), _jsx("input", { "aria-label": "Input type", placeholder: "text, or a spine label", value: row.type, onChange: (e) => updateRow(row.id, { type: e.target.value }) }), row.type.trim() === 'text' || !row.type.trim()
                                ? _jsx("textarea", { "aria-label": "Input value", placeholder: "the text \u2014 an email, meeting notes", value: row.value, onChange: (e) => updateRow(row.id, { value: e.target.value }) })
                                : _jsx("input", { "aria-label": "Input value", placeholder: "the entity's key", value: row.value, onChange: (e) => updateRow(row.id, { value: e.target.value }) }), _jsx("button", { className: "btn", onClick: () => setRows((current) => current.filter((r) => r.id !== row.id)), children: "Remove" })] }, row.id))), _jsxs("div", { className: "row", children: [_jsx("button", { className: "btn", onClick: () => setRows((current) => [...current, { id: nextRow.current++, name: '', type: 'text', value: '' }]), children: "Add input" }), _jsx("button", { className: "btn primary", disabled: !planned || running, onClick: () => void runIt(), children: running ? 'Running…' : 'Run plan' })] }), !planned && _jsx("div", { className: "hint", children: "Run is offered once the goal plans." })] })), run?.problem && _jsx(Status, { tone: "error", children: run.problem }), run?.answer && _jsx(RunResult, { answer: run.answer }), saveOpen && services.saveGoalView && (_jsxs("form", { className: "plansave", onSubmit: (e) => void save(e), children: [_jsx("input", { "aria-label": "View name", placeholder: "ViewName", value: viewName, onChange: (e) => setViewName(e.target.value) }), _jsx("input", { "aria-label": "View description", placeholder: "what it answers, in one line", value: viewDescription, onChange: (e) => setViewDescription(e.target.value) }), _jsx("button", { className: "btn primary", type: "submit", disabled: !viewName.trim(), children: "Save" }), saveStatus && _jsx(Status, { tone: saveStatus.tone, children: saveStatus.text })] }))] }));
}
/* A run that did not plan comes back as that outcome, so it is shown the way the dry run would be. */
function RunResult({ answer }) {
    if (answer.outcome !== 'planned')
        return _jsx(Outcome, { answer: answer });
    const rows = (answer.rows ?? []);
    return (_jsxs("div", { className: "planrun", children: [answer.error && _jsx(Status, { tone: "error", children: answer.error }), (answer.warnings ?? []).map((warning) => _jsx(Status, { tone: "caution", children: warning }, warning)), !answer.error && (rows.length
                ? _jsx(RowTable, { rows: rows, columns: rowColumns(rows) })
                : _jsx("div", { className: "hint", children: "No rows." }))] }));
}
//# sourceMappingURL=PlanPanel.js.map