import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
/*
 * HANDLER STUDIO — the sibling of Query Studio, for TypeScript event handlers: smallish programs
 * handed the triggering `signal` (or a cron tick) that read the graph and take effects through the
 * typed `gateway.*` surface.
 *
 * The honesty guarantees are Query Studio's, transplanted:
 *
 *  - Completion reads the appliance's OWN generated surface (`interfaces.ts`, parsed by the kit's
 *    `code-surface`) — the same file that types code-mode — so what the editor offers and what
 *    compiles cannot drift apart.
 *  - Validity is the engine's own `tsc` gate, debounced as you type; save runs the same gate as a
 *    hard stop, so "valid here" and "saved there" agree.
 *  - The safe verb is primary: dry-run is observe-only ON THE APPLIANCE, against a real recent
 *    signal it names in the result. Enabling and scheduling — the acts that let a handler actually
 *    act on the world — are separate, and marked.
 *  - Cypher inside `kg` calls completes through the kit's vc semantics, the same package Query
 *    Studio composes from.
 *
 * Until recently this could not have been written here at all: the appliance's handler endpoints
 * answered untyped maps and were outside the guarded snapshot, so there was nothing to generate a
 * client from. They are typed and guarded now, and this is the first surface built on that.
 */
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { isOk } from "../../../client/outcome.js";
import { gatewayPathAt, membersOf, parseSurface } from "../../../code-surface/index.js";
import { cypherFragmentCompletions, formatDuration } from "../../../studio-kit/index.js";
import * as Vc from "../../../vc/index.js";
import { CodeMirror, useEditor } from "../studio/editor.js";
import { CopyButton, Status, StudioPanel, failureMessage, isAbsent } from "../studio/chrome.js";
/** `try { … } catch { '' }` as an expression — used where a bad value must not break a render. */
function runCatching(f) {
    try {
        return f();
    }
    catch {
        return '';
    }
}
/** The ambient vocabulary a handler body has in scope, beyond the gateway. */
const KEYWORDS = [
    'await', 'const', 'let', 'if', 'else', 'for', 'of', 'return', 'try', 'catch', 'throw',
    'gateway', 'signal', 'trigger', 'now', 'dryRun', 'console.log', 'JSON.stringify',
];
const STARTER = `// A handler reacts: \`signal\` is the triggering event (or undefined on a cron
// tick), and \`gateway.*\` is your typed surface — Ctrl-Space completes both.
// Dry-run is observe-only: effects are suppressed, output comes back here.

console.log('triggered by', signal?.typeName ?? 'cron tick')
`;
/*
 * Completion state lives outside the component for the same reason Query Studio's schema does: the
 * hint is registered against the CodeMirror singleton, once, and must read the CURRENT surface
 * rather than whatever had arrived when it was installed.
 */
const state = { surface: null, schema: null, sample: null };
/** Cypher inside a `kg` call — the fragment doubles as its own alias source. */
function cypherContext(before) {
    // The last unterminated single- or backtick-quoted string, when it looks like Cypher. Small and
    // stable enough to read directly; anything more would be parsing TypeScript to complete it.
    const match = before.match(/(?:kg\.\w+\(\s*\{[^}]*?(?:query|cypher)\s*:\s*)(['`])((?:[^'`\\]|\\.)*)$/);
    return match ? match[2] ?? null : null;
}
let hintRegistered = false;
function registerHint() {
    if (hintRegistered)
        return;
    hintRegistered = true;
    const CM = CodeMirror;
    /* The return is CodeMirror's hint shape — `{list, from, to}` with `Pos` values CM5 exports no
     * type for. Stated as `any` at the boundary rather than restated here, which would be a second
     * declaration of someone else's structure. */
    CM.registerHelper('hint', 'javascript', (editor) => {
        const cursor = editor.getCursor();
        const before = editor.getLine(cursor.line).slice(0, cursor.ch);
        const found = (list, from) => ({
            list: [...list].sort((a, b) => a.localeCompare(b)),
            from: CM.Pos(cursor.line, from),
            to: CM.Pos(cursor.line, cursor.ch),
        });
        // gateway.… → the appliance's own generated surface, never an invented list.
        const path = gatewayPathAt(before);
        if (path) {
            const members = membersOf(state.surface, path.path);
            return found(members.filter((m) => m.name.toLowerCase().startsWith(path.stem.toLowerCase())).map((m) => m.name), cursor.ch - path.stem.length);
        }
        // signal.… → the keys of the sampled signal, so what you complete is what will be bound.
        let m;
        if ((m = before.match(/\bsignal\.(\w*)$/))) {
            const stem = m[1] ?? '';
            const keys = state.sample ? Object.keys(state.sample) : [];
            return found(keys.filter((k) => k.toLowerCase().startsWith(stem.toLowerCase())), cursor.ch - stem.length);
        }
        const embedded = cypherContext(before);
        if (embedded !== null) {
            const c = cypherFragmentCompletions(Vc, state.schema, embedded, embedded);
            if (c)
                return found(c.list, cursor.ch - c.stemLength);
        }
        if ((m = before.match(/(\w+)$/))) {
            const stem = m[1] ?? '';
            return found(KEYWORDS.filter((w) => w.toLowerCase().startsWith(stem.toLowerCase())), cursor.ch - stem.length);
        }
        return null;
    });
}
/**
 * The gateway surface arrives as TypeScript SOURCE, not JSON, so it cannot go through the kit's
 * transport — which parses every body as JSON. Same origin, same ambient credentials as everything
 * else here.
 */
async function fetchSurface(services) {
    const outcome = await services.gatewayInterfaces();
    return outcome.ok ? parseSurface(outcome.value) : null;
}
const HandlerRuntimeContext = createContext(null);
function useHandlerRuntime() {
    const runtime = useContext(HandlerRuntimeContext);
    if (!runtime)
        throw new Error('HandlerStudioSurface runtime is missing');
    return runtime;
}
export function HandlerStudioSurface({ services, draft, onDraftConsumed, }) {
    return (_jsx(HandlerRuntimeContext.Provider, { value: { services }, children: _jsx(HandlerStudioBody, { draft: draft, onDraftConsumed: onDraftConsumed }) }));
}
function HandlerStudioBody({ draft, onDraftConsumed }) {
    const { services } = useHandlerRuntime();
    const [surface, setSurface] = useState(null);
    const [catalogue, setCatalogue] = useState(null);
    /* The skills bundled with the agent being authored. Owned here because BOTH halves need them:
       Ask hands them to the writing model, Save persists them with the action. */
    const [skills, setSkills] = useState([]);
    const [installed, setInstalled] = useState([]);
    const [yours, setYours] = useState([]);
    const [available, setAvailable] = useState([]);
    const [listError, setListError] = useState('');
    const [openName, setOpenName] = useState(null);
    const [validity, setValidity] = useState({ tone: null, text: '', violations: [] });
    const [runStatus, setRunStatus] = useState({ tone: null, text: '' });
    const [output, setOutput] = useState(null);
    const [busy, setBusy] = useState(false);
    /*
     * ARRIVING FROM A WATCH. The Views tab writes `{signalType, view}` and sends the browser here,
     * so "Write an agent for it" lands on an editor whose trigger is already the signal the watch
     * publishes — the step where the journey used to end, with somebody copying a signal type by
     * hand and getting it subtly wrong.
     *
     * Read once and CLEARED, because it is a handoff rather than a preference: coming back to this
     * tab later should not silently re-prefill a trigger nobody asked for this time.
     */
    const [signalType, setSignalType] = useState(draft?.signalType ?? '');
    useEffect(() => {
        if (!draft)
            return;
        setSignalType(draft.signalType);
        onDraftConsumed?.();
    }, [draft, onDraftConsumed]);
    const validateSupported = useRef(true);
    const validateTimer = useRef(null);
    // A compile spins the sandbox, so an edit that undid itself must not buy the same verdict twice.
    const lastValidated = useRef(null);
    const dryRunRef = useRef(() => { });
    /* Both callbacks go through refs rather than being passed directly. `scheduleValidation`
     * reaches `validateNow`, which reads `handle` — which comes out of this very call — so naming it
     * here would be a circular inference TypeScript gives up on. The ref breaks the cycle and, as a
     * bonus, keeps the editor from caring that a callback identity moved. */
    const editRef = useRef(() => { });
    const { ref: editorRef, handle } = useEditor({
        mode: 'text/typescript',
        onRun: () => dryRunRef.current(),
        onEdit: () => editRef.current(),
    });
    registerHint();
    useEffect(() => {
        void (async () => {
            const parsed = await fetchSurface(services);
            state.surface = parsed;
            setSurface(parsed);
            const schema = await services.kg.schema();
            state.schema = isOk(schema) ? schema.value : null;
        })();
    }, [services]);
    // The editor starts with the starter rather than empty: an empty box does not tell you that
    // `signal` and `gateway` are in scope, and that is the whole shape of a handler.
    const seeded = useRef(false);
    useEffect(() => {
        if (seeded.current || !handle.editor)
            return;
        seeded.current = true;
        handle.setText(STARTER);
    }, [handle]);
    const loadHandlers = useCallback(async () => {
        const outcome = await services.handlers.list();
        if (!isOk(outcome))
            return setListError(failureMessage(outcome, 'the handlers surface'));
        setListError('');
        setYours(outcome.value.yours ?? []);
        setAvailable(outcome.value.available ?? []);
    }, [services]);
    useEffect(() => { void loadHandlers(); }, [loadHandlers]);
    /* WHAT THIS WORLD CAN NOTICE — fetched once. A null catalogue means the appliance predates the
       endpoint, and the trigger falls back to a free-text box rather than an empty list, which would
       read as "this world notices nothing". */
    useEffect(() => {
        let stop = false;
        void (async () => {
            const [types, world] = await Promise.all([
                services.signalTypes(),
                services.worldSkills(),
            ]);
            if (stop)
                return;
            setCatalogue(types.ok ? types.value : null);
            setInstalled(world.ok ? world.value : []);
        })();
        return () => { stop = true; };
    }, [services]);
    // ── validation: the appliance's tsc gate ────────────────────────────────────────────────────
    const validateNow = useCallback(async () => {
        const source = handle.getText().trim();
        if (!source)
            return setValidity({ tone: null, text: '', violations: [] });
        if (source === lastValidated.current)
            return;
        const outcome = await services.handlers.validate(source);
        if (!isOk(outcome)) {
            if (isAbsent(outcome))
                validateSupported.current = false;
            return setValidity({ tone: null, text: '', violations: [] });
        }
        lastValidated.current = source;
        const { valid, violations = [], durationMs } = outcome.value;
        setValidity(valid
            ? { tone: 'ok', text: `✓ compiles · ${formatDuration(durationMs ?? 0)}`, violations: [] }
            : { tone: 'error', text: `${violations.length} type error(s)`, violations });
    }, [handle, services]);
    const scheduleValidation = useCallback(() => {
        if (!validateSupported.current)
            return;
        if (validateTimer.current)
            clearTimeout(validateTimer.current);
        setValidity((v) => ({ ...v, tone: null, text: '…' }));
        // Generous next to Query Studio's 700ms: this one spins a sandbox and runs tsc.
        validateTimer.current = setTimeout(() => void validateNow(), 1500);
    }, [validateNow]);
    editRef.current = scheduleValidation;
    // ── the safe verb ───────────────────────────────────────────────────────────────────────────
    const dryRun = useCallback(async () => {
        const source = handle.getText().trim();
        if (!source)
            return;
        setBusy(true);
        setOutput(null);
        setRunStatus({ tone: null, text: 'Running observe-only on the appliance…' });
        const outcome = await services.handlers.dryRun(source, signalType || undefined);
        setBusy(false);
        if (!isOk(outcome))
            return setRunStatus({ tone: 'error', text: failureMessage(outcome, 'handler dry runs') });
        const result = outcome.value;
        // What it RAN AGAINST, not what was asked for: a signal type with nothing on record falls back
        // to a cron tick, and reporting the request would tell you it saw an event it never saw.
        const ranAgainst = `${result.ranAgainst?.signalType ?? '?'} · ${result.ranAgainst?.signalId ?? '?'}`;
        setOutput({ stdout: result.stdout ?? '', ranAgainst });
        setRunStatus(result.ok
            ? { tone: 'ok', text: `ran against ${ranAgainst}` }
            : { tone: 'error', text: result.error ?? 'the handler threw' });
    }, [handle, signalType, services]);
    dryRunRef.current = () => void dryRun();
    async function open(name) {
        const outcome = await services.handlers.open(name);
        if (!isOk(outcome))
            return setRunStatus({ tone: 'error', text: failureMessage(outcome, 'opening handlers') });
        const spec = outcome.value;
        handle.setText(spec.source ?? '');
        setOpenName(spec.name ?? name);
        setSignalType(spec.signalType && spec.signalType !== '*' ? spec.signalType : '');
        // Round-tripped, or saving an edit would quietly unbundle every skill the agent had.
        setSkills((spec.skills) ?? []);
        lastValidated.current = null;
        scheduleValidation();
    }
    async function setEnabled(name, enabled) {
        const outcome = await services.handlers.setEnabled(name, enabled);
        if (!isOk(outcome))
            return setListError(failureMessage(outcome, 'enabling handlers'));
        void loadHandlers();
    }
    async function remove(name) {
        if (!confirm(`Delete the agent '${name}'?`))
            return;
        const outcome = await services.handlers.delete(name);
        if (!isOk(outcome))
            return setListError(failureMessage(outcome, 'deleting handlers'));
        if (openName === name)
            setOpenName(null);
        void loadHandlers();
    }
    return (_jsxs("div", { className: "kit-feature kit-feature-handlers studio", children: [_jsxs("div", { className: "studio-side", children: [_jsx(HandlersList, { yours: yours, available: available, error: listError, openName: openName, onOpen: (n) => void open(n), onToggle: (n, on) => void setEnabled(n, on), onDelete: (n) => void remove(n) }), _jsx(SignalsPanel, { catalogue: catalogue, onPick: (t) => setSignalType(t) }), _jsx(SurfacePanel, { surface: surface })] }), _jsxs("div", { className: "studio-main", children: [_jsx(Ask, { onLand: (source) => { handle.setText(source); lastValidated.current = null; scheduleValidation(); }, current: () => handle.getText(), installed: installed, skills: skills, onSkills: setSkills }), _jsxs(StudioPanel, { title: openName ? `Agent · ${openName}` : 'Agent', aside: _jsx(Status, { tone: validity.tone, children: validity.text }), children: [_jsx("div", { className: "editor-host", ref: editorRef }), validity.violations.length > 0 && (_jsx("div", { className: "verdict", children: validity.violations.map((v, i) => _jsx("div", { className: "violation", children: v }, i)) })), _jsxs("div", { className: "row studio-actions", children: [_jsx("button", { className: "btn primary", disabled: busy, onClick: () => void dryRun(), children: busy ? 'running…' : 'Dry run' }), _jsxs("label", { className: "field inline", children: [_jsx("span", { children: "against" }), _jsx("input", { value: signalType, placeholder: "most recent signal \u00B7 blank = cron tick", onChange: (e) => setSignalType(e.target.value) })] }), _jsx(CopyButton, { label: "Copy", text: handle.getText() })] }), _jsx("p", { className: "hint", children: "Dry run is observe-only and happens on the appliance \u2014 effects are suppressed. Saving, enabling and scheduling are what let a handler act; they are below, and separate." }), _jsx(Status, { tone: runStatus.tone, children: runStatus.text })] }), _jsx(StudioPanel, { title: "Output", aside: output && _jsxs("span", { className: "hint", children: ["ran against ", output.ranAgainst] }), children: !output ? _jsx("p", { className: "hint", children: "Dry run output appears here." }) :
                            output.stdout.trim() === '' ? _jsx("p", { className: "hint", children: "The handler logged nothing." }) :
                                _jsx("pre", { className: "runoutput", children: output.stdout }) }), _jsx(SavePanel, { source: () => handle.getText(), defaultName: openName ?? '', defaultSignalType: signalType, catalogue: catalogue, skills: skills, onSaved: () => { void loadHandlers(); } })] })] }));
}
export function stageOf(h) {
    if (!h.active)
        return 'proposed';
    return h.autonomous ? 'acting' : 'watching';
}
const STAGE_SAYS = {
    proposed: 'Saved and idle. It fires at nothing and changes nothing.',
    watching: 'Live, observe-only. It runs for real on real events and logs what it WOULD do.',
    acting: 'Live and permitted to apply effects. This is the state with consequences.',
};
// ── the handlers list ─────────────────────────────────────────────────────────────────────────
function HandlersList({ yours, available, error, openName, onOpen, onToggle, onDelete }) {
    return (_jsx(StudioPanel, { title: "Agents", children: error ? _jsx(Status, { tone: "error", children: error }) : (_jsxs(_Fragment, { children: [yours.length === 0 && available.length === 0 && (
                /*
                 * AN EMPTY LIST IS A MENU, NOT A SENTENCE.
                 *
                 * "No agents yet" beside an empty editor is the original problem in miniature: it tells
                 * somebody the tab is empty and leaves them to invent what could fill it. These are the
                 * three real routes in, in the order they cost effort — the cheapest first, because the
                 * point is to own one agent today, not to write the best one.
                 */
                _jsxs("div", { className: "emptymenu", children: [_jsx("p", { className: "hint", children: "Nothing runs unattended in this world yet. Three ways to start:" }), _jsxs("a", { className: "emptyroute", href: "#views", children: [_jsx("strong", { children: "Watch a saved view" }), _jsx("small", { children: "a question you already trust, on a schedule \u2014 it publishes a signal when the answer moves" })] }), _jsxs("button", { className: "emptyroute", onClick: () => document.querySelector('.ask-row.tall textarea')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), children: [_jsx("strong", { children: "Describe one in English" }), _jsx("small", { children: "the Ask above writes it, type-checks it against this world, and lands it in the editor" })] }), _jsxs("a", { className: "emptyroute", href: "#realms", children: [_jsx("strong", { children: "Install a realm that ships agents" }), _jsx("small", { children: "a realm brings its own \u2014 observe-only until you adopt them" })] })] })), yours.length > 0 && _jsx("div", { className: "subhead", children: "yours" }), yours.map((h) => (_jsxs("div", { className: `handler-row ${h.name === openName ? 'active' : ''}`, children: [_jsxs("button", { className: "handlername", onClick: () => onOpen(h.name), children: [_jsx("strong", { children: h.name }), _jsxs("small", { children: [h.signalType && h.signalType !== '*' ? `on ${h.signalType}` : 'no trigger', h.schedule ? ` · cron ${h.schedule}` : '', ' · ', _jsx("span", { className: `stage ${stageOf(h)}`, title: STAGE_SAYS[stageOf(h)], children: stageOf(h) })] })] }), _jsx("button", { className: `btn tiny ${h.active ? 'ghost' : 'arm'}`, onClick: () => onToggle(h.name, !h.active), children: h.active ? 'Stand down' : 'Start watching' }), _jsx("button", { className: "btn ghost tiny", onClick: () => onDelete(h.name), children: "Delete" })] }, h.name))), available.length > 0 && _jsx("div", { className: "subhead", children: "available to adopt" }), available.map((h) => (_jsxs("div", { className: "handler-row", children: [_jsxs("button", { className: "handlername", onClick: () => onOpen(h.name), children: [_jsx("strong", { children: h.name }), _jsxs("small", { children: [h.signalType && h.signalType !== '*' ? `on ${h.signalType}` : 'no trigger', " \u00B7 from a realm"] })] }), _jsx("button", { className: "btn tiny arm", onClick: () => onToggle(h.name, true), children: "Adopt" })] }, h.name)))] })) }));
}
// ── ask ───────────────────────────────────────────────────────────────────────────────────────
/**
 * English → handler, with the compiler's verdict already attached. Generation only: what comes
 * back lands in the editor and is never run, for the same reason Query Studio generates without
 * asking.
 */
function Ask({ onLand, current, installed, skills, onSkills }) {
    const { services } = useHandlerRuntime();
    const [english, setEnglish] = useState('');
    const [instruction, setInstruction] = useState('');
    const [busy, setBusy] = useState(false);
    const [status, setStatus] = useState({ tone: null, text: '' });
    async function go(refine) {
        /* TWO BOXES, TWO QUESTIONS — Query Studio's arrangement, and for its reason: one describes the
           agent you want, the other the change you want made to the one on screen. Shared, "refine"
           reads as a second Write and the text you wrote for one is wrong for the other. */
        const text = (refine ? instruction : english).trim();
        if (!text)
            return;
        setBusy(true);
        setStatus({ tone: null, text: `The appliance is ${refine ? 'revising' : 'writing'} your agent — an LLM call plus a compile…` });
        const r = await services.generateHandler(text, refine ? current() : undefined, skills);
        setBusy(false);
        if (!r.ok)
            return setStatus({ tone: 'error', text: r.message });
        const generated = r.value;
        onLand(generated.source ?? '');
        // `attempts` of 2 means the model was handed its own type errors and fixed them — worth
        // saying, because it explains the wait.
        const attempts = (generated.attempts ?? 1) > 1 ? ` after ${generated.attempts} attempts` : '';
        setStatus(generated.valid
            ? { tone: 'ok', text: `Written and it compiles${attempts}.` }
            : { tone: 'caution', text: `Written${attempts}, but it does not compile — the errors are on the editor.` });
    }
    /* ⌘/Ctrl-Enter, not Enter. Query Studio's asks are one-line inputs where Enter can submit; an
       agent is described in a paragraph — what it reacts to, what it should check, when it should
       stay quiet — so Enter has to make a new line and the shortcut moves to the modifier. */
    const submitOn = (refine) => (e) => {
        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            void go(refine);
        }
    };
    return (_jsxs(StudioPanel, { title: "Ask", children: [_jsxs("div", { className: "ask-row tall", children: [_jsx("textarea", { rows: 5, value: english, placeholder: 'when a review is requested on one of my PRs, tell me whether the author has contributed before\n\nevery weekday at 8, digest the PRs waiting on me — one message, not one each', onChange: (e) => setEnglish(e.target.value), onKeyDown: submitOn(false) }), _jsx("button", { className: "btn primary", disabled: busy, onClick: () => void go(false), children: "Write it" })] }), _jsxs("div", { className: "ask-row tall", children: [_jsx("textarea", { rows: 2, value: instruction, placeholder: "refine what's in the editor: only for my own repos \u00B7 skip drafts \u00B7 say nothing when there is nothing", onChange: (e) => setInstruction(e.target.value), onKeyDown: submitOn(true) }), _jsx("button", { className: "btn", disabled: busy || !current().trim(), onClick: () => void go(true), children: "Refine" })] }), _jsx(SkillPicker, { installed: installed, chosen: skills, onChange: onSkills }), _jsx(Status, { tone: status.tone, children: status.text }), _jsx("p", { className: "hint", children: "\u2318/Ctrl-Enter submits; Enter is a new line." })] }));
}
/*
 * BUNDLING SKILLS WITH AN AGENT.
 *
 * A skill is a realm's own account of how to work with it — `realm-github` ships one that teaches
 * search-then-get, safe pagination and the pitfalls. None of that reached the model that writes
 * agents, so it re-derived idioms the realm had already documented and got them subtly wrong.
 *
 * Chosen by the AUTHOR rather than judged by the model: chat activates a skill because the LLM
 * decides relevance mid-conversation, but somebody bundling one here has already decided. The
 * chosen set is saved with the agent, so refining it a month later is briefed exactly as it was
 * written.
 */
function SkillPicker({ installed, chosen, onChange }) {
    if (installed.length === 0) {
        return (_jsxs("p", { className: "hint", children: ["No skills installed. The ", _jsx("a", { href: "#skills", children: "Skills" }), " tab brings them in \u2014 a realm's own instructions make a better agent than a model guessing at its idioms."] }));
    }
    const toggle = (name) => onChange(chosen.includes(name) ? chosen.filter((n) => n !== name) : [...chosen, name]);
    return (_jsxs("div", { className: "skillpicker", children: [_jsx("div", { className: "subhead", children: "Bundle skills" }), _jsx("div", { className: "skillchips", children: installed.map((s) => (_jsx("button", { className: `skillchip${chosen.includes(s.name) ? ' is-on' : ''}`, title: s.description || s.name, "aria-pressed": chosen.includes(s.name), onClick: () => toggle(s.name), children: s.name }, s.name))) }), _jsx("p", { className: "hint", children: chosen.length === 0
                    ? 'None bundled — the model writes from the world’s schema and gateway surface alone.'
                    : `${chosen.length} bundled — put in front of the model that writes and refines this agent, and saved with it.` })] }));
}
// ── the gateway surface browser ───────────────────────────────────────────────────────────────
/** The appliance's own generated `interfaces.ts`, read for names and docs — not type-checked. */
function SurfacePanel({ surface }) {
    const [filter, setFilter] = useState('');
    const needle = filter.trim().toLowerCase();
    const matches = (m) => !needle || m.name.toLowerCase().includes(needle);
    return (_jsx(StudioPanel, { title: "Gateway", children: surface == null ? (_jsx("p", { className: "hint", children: "The appliance did not offer a generated surface \u2014 completion falls back to the ambient vocabulary." })) : (_jsxs(_Fragment, { children: [_jsx("input", { value: filter, placeholder: "filter verbs", onChange: (e) => setFilter(e.target.value) }), _jsxs("div", { className: "surfacelist", children: [surface.methods.filter(matches).map((m) => (_jsxs("div", { className: "surfacerow", children: [_jsxs("code", { children: ["gateway.", m.signature] }), m.doc && _jsx("small", { children: m.doc })] }, m.name))), surface.namespaces.map((ns) => {
                            const shown = ns.methods.filter(matches);
                            if (shown.length === 0)
                                return null;
                            return (_jsxs("div", { className: "surfacens", children: [_jsxs("div", { className: "subhead", children: ["gateway.", ns.name] }), shown.map((m) => (_jsxs("div", { className: "surfacerow", children: [_jsx("code", { children: m.signature }), m.doc && _jsx("small", { children: m.doc })] }, m.name)))] }, ns.name));
                        })] })] })) }));
}
// ── saving, and the acts that let a handler act ───────────────────────────────────────────────
/**
 * Save is tsc-gated on the appliance — a handler that does not compile is never persisted, so a
 * false `ok` here is the compiler's verdict rather than a failed request.
 *
 * Enabling and scheduling are deliberately NOT folded into save. A saved handler that is off
 * changes nothing; the moment it is on, it runs unattended on real events. That is a different
 * decision from "keep this text", and it reads as one.
 */
function SavePanel({ source, defaultName, defaultSignalType, catalogue, skills, onSaved }) {
    const { services } = useHandlerRuntime();
    const [name, setName] = useState(defaultName);
    const [signalType, setSignalType] = useState(defaultSignalType);
    const [schedule, setSchedule] = useState('');
    const [autonomous, setAutonomous] = useState(false);
    const [busy, setBusy] = useState(false);
    const [status, setStatus] = useState({ tone: null, text: '' });
    // Opening a handler renames the box, so saving edits to it does not silently fork a copy.
    useEffect(() => { setName(defaultName); }, [defaultName]);
    useEffect(() => { setSignalType(defaultSignalType); }, [defaultSignalType]);
    async function save() {
        const handlerName = name.trim();
        if (!handlerName)
            return setStatus({ tone: 'error', text: 'a handler needs a name' });
        setBusy(true);
        const r = await services.saveHandler({
            name: handlerName,
            source: source(),
            signalType: signalType.trim() || '*',
            schedule: schedule.trim() || undefined,
            autonomous,
            skills,
        });
        setBusy(false);
        if (!r.ok)
            return setStatus({ tone: 'error', text: r.message });
        setStatus({ tone: r.value.ok ? 'ok' : 'error', text: r.value.message ?? '' });
        if (r.value.ok)
            onSaved();
    }
    return (_jsxs(StudioPanel, { title: "Save", children: [_jsxs("div", { className: "saveform", children: [_jsxs("label", { className: "field", children: [_jsx("span", { children: "Name" }), _jsx("input", { value: name, placeholder: "pr-triage", onChange: (e) => setName(e.target.value) })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Fires on" }), _jsx("input", { value: signalType, list: "signal-types", placeholder: catalogue && catalogue.length > 0
                                    ? `${catalogue[0].typeName} · blank = no signal trigger`
                                    : 'PullRequestOpened · blank = no signal trigger', onChange: (e) => setSignalType(e.target.value) }), _jsx("datalist", { id: "signal-types", children: (catalogue ?? []).map((t) => _jsx("option", { value: t.typeName }, t.typeName)) })] }), _jsxs("label", { className: "field", children: [_jsx("span", { children: "Cron" }), _jsx("input", { value: schedule, placeholder: "0 0 9 * * * \u00B7 blank = not scheduled", onChange: (e) => setSchedule(e.target.value) })] }), _jsxs("label", { className: "field checkbox", children: [_jsx("input", { type: "checkbox", checked: autonomous, onChange: (e) => setAutonomous(e.target.checked) }), _jsx("span", { children: "May act \u2014 apply real effects, not just observe" })] })] }), _jsx("button", { className: "btn", disabled: busy, onClick: () => void save(), children: busy ? 'saving…' : 'Save agent' }), skills.length > 0 && (_jsxs("p", { className: "hint", children: ["Bundled skills: ", skills.join(', '), " \u2014 saved with it, and used when you refine it."] })), _jsxs("p", { className: "hint", children: ["Saving stores it. It stays ", _jsx("em", { children: "proposed" }), " until you start it watching \u2014 that is the act that lets it run unattended, and letting it ", _jsx("em", { children: "act" }), " is a second one."] }), _jsx(Status, { tone: status.tone, children: status.text })] }));
}
/** One signal type this world receives, as the catalogue reports it. */
/*
 * WHAT THIS WORLD CAN NOTICE — the question that has to occur to somebody before they can write an
 * agent at all, and which this console could not answer until now. `action_brief` has handed the
 * same catalogue to coding agents all along; the human surface offered a text box and a
 * placeholder, so the only people who could name a trigger were the ones who already knew one.
 *
 * The COUNT is not decoration. A type with four hundred events last month and one with a single
 * event in March are both "available", and are completely different propositions to build on. The
 * old box presented them identically, which is how somebody writes an agent for an event that will
 * never fire again.
 */
function SignalsPanel({ catalogue, onPick }) {
    const [filter, setFilter] = useState('');
    const [open, setOpen] = useState(null);
    if (catalogue == null) {
        return (_jsx(StudioPanel, { title: "What this world notices", children: _jsx("p", { className: "hint", children: "This appliance does not publish a signal catalogue \u2014 the trigger stays a typed name." }) }));
    }
    const needle = filter.trim().toLowerCase();
    const shown = catalogue.filter((t) => !needle || t.typeName.toLowerCase().includes(needle));
    return (_jsx(StudioPanel, { title: "What this world notices", children: catalogue.length === 0 ? (_jsxs("p", { className: "hint", children: ["No signals on record yet. Install a realm that produces events, or watch a view \u2014 a watch publishes ", _jsx("code", { children: "view.<name>.changed" }), ", which is a signal like any other."] })) : (_jsxs(_Fragment, { children: [_jsx("input", { value: filter, placeholder: "filter signal types", onChange: (e) => setFilter(e.target.value) }), _jsxs("div", { className: "surfacelist", children: [shown.map((t) => (_jsxs("div", { className: "signalrow", children: [_jsxs("button", { className: "signalname", onClick: () => setOpen(open === t.typeName ? null : t.typeName), children: [_jsx("code", { children: t.typeName }), _jsxs("small", { children: [t.count > 0 ? `${t.count} in 30 days` : 'none in 30 days', t.lastSeen ? ` · last ${t.lastSeen.slice(0, 10)}` : ''] })] }), _jsx("button", { className: "btn ghost tiny", onClick: () => onPick(t.typeName), children: "Use" }), open === t.typeName && (_jsx("div", { className: "signalfields", children: t.fields.length === 0
                                        ? _jsx("small", { className: "hint", children: "No fields sampled." })
                                        : t.fields.map((f) => _jsxs("code", { children: ["signal.", f] }, f)) }))] }, t.typeName))), shown.length === 0 && _jsx("p", { className: "hint", children: "Nothing matches that filter." })] })] })) }));
}
//# sourceMappingURL=HandlerStudioSurface.js.map