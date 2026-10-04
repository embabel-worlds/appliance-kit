import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
/*
 * AGENTS — the colleagues in a world, whether each is on duty, and what each still needs.
 *
 * An agent is a named role with a job and someone who answers for it (its sponsor), holding the
 * routines and duties it does. Its stage is a ladder people already understand: off duty; on duty,
 * observing (it runs, and writes nothing); on duty. Every word on this surface is chosen for the
 * person who answers for the agent, not for whoever wrote its code: no "handler", no "autonomous".
 *
 * Two things are shown that a tidier screen would hide, because hiding them is how an agent ends
 * up "on" and doing nothing:
 *  - WHAT FIRES, beside what was chosen. An agent can be put on duty and still be off in practice
 *    (no sponsor yet, never signed). Each routine says the stage it actually runs at, and the
 *    agent's needs say why the two differ.
 *  - A REFUSAL, in the appliance's own words, next to the control that was refused.
 *
 * An agent runs as SIGNED. Edits, a realm update or a changed view appear as unsigned changes and
 * reach nothing until the sponsor signs, so the version panel is where an edit takes effect.
 */
import { useCallback, useEffect, useState } from 'react';
import { Status, StudioPanel, failureMessage } from "../studio/chrome.js";
import { SuggestedColleagues } from "./SuggestedColleagues.js";
const STAGES = [
    { stage: 'off', label: 'Off duty' },
    { stage: 'observing', label: 'Observing' },
    { stage: 'on', label: 'On duty' },
];
const STAGE_WORDS = {
    off: 'off duty',
    observing: 'on duty, observing',
    on: 'on duty',
};
const TONE = { off: '', observing: 'caution', on: 'ok' };
/** A date a person reads at a glance; the exact moment stays on the title. */
function when(iso) {
    if (!iso)
        return '';
    const date = new Date(iso);
    return Number.isNaN(date.getTime()) ? iso : date.toLocaleString();
}
/* Whether the duty may go on duty as it stands: a test run of the version that will run, or not yet. */
function testedWords(duty, version) {
    if (duty.testedVersion == null)
        return 'Not tested yet';
    const on = duty.testedAt ? ` on ${when(duty.testedAt)}` : '';
    return duty.testedVersion === version
        ? `Tested on version ${version}${on}`
        : `Last tested on version ${duty.testedVersion}${on}; version ${version} needs a test run`;
}
/* What a test run just found, and what the repair would have done about it. */
function CheckFound({ check }) {
    return check ? _jsx("p", { className: "hint", children: checkWords(check) }) : null;
}
function checkWords(check) {
    const found = check.state === 'unknown'
        ? `Could not tell: ${check.reason ?? 'no reason given'}`
        : check.state === 'upheld' ? 'Upheld: nothing to repair'
            : `${check.state === 'neglected' ? 'Neglected, its requests are being rejected' : 'Lapsed'}: ${check.violations} violation${check.violations === 1 ? '' : 's'}`;
    const would = check.wouldHaveCalled.length > 0 ? `; would have called ${check.wouldHaveCalled.join(', ')}` : '';
    const failed = check.repairFailures > 0 ? `; ${check.repairFailures} repair${check.repairFailures === 1 ? '' : 's'} failed` : '';
    return `${found}${would}${failed}.`;
}
/** The highest stage any routine actually fires at: what the agent is doing, in one pill. */
export function firingOf(agent) {
    if (agent.routines.some((r) => r.firing === 'on'))
        return 'on';
    if (agent.routines.some((r) => r.firing === 'observing'))
        return 'observing';
    return 'off';
}
/**
 * @deprecated A host built on desk draws state with desk's `Led` and the words beside it, not this
 * pill: see "Hosts built on desk" in the README. The pill is `display: flex`, so anywhere but a
 * flex row it stretches to the width of its container and reads as a text field.
 */
export function StagePill({ stage }) {
    return (_jsxs("span", { className: `pill ${TONE[stage]}`.trim(), children: [_jsx("span", { className: "dot", "aria-hidden": "true" }), STAGE_WORDS[stage]] }));
}
/*
 * THE KILL SWITCH, on the roster: one control that stops every agent, and while they are stopped,
 * says so above everything else with who did it and why. Stopping asks for a reason in the page —
 * the next person to read it needs one — and starting again asks nothing more than the press,
 * because every agent goes back to exactly the stage it had.
 */
function HaltBar({ services, onChanged }) {
    const [halt, setHalt] = useState(null);
    const [arming, setArming] = useState(false);
    const [reason, setReason] = useState('');
    const [busy, setBusy] = useState(false);
    const [problem, setProblem] = useState('');
    useEffect(() => {
        void services.haltStatus?.().then((r) => {
            if (r.ok)
                setHalt(r.value);
            else
                setProblem(failureMessage(r, 'load whether every agent is stopped'));
        });
    }, [services]);
    async function change(stop) {
        if (busy)
            return;
        setBusy(true);
        const result = stop ? await services.halt?.(reason.trim()) : await services.resume?.();
        setBusy(false);
        if (!result)
            return;
        if (!result.ok) {
            setProblem(failureMessage(result, stop ? 'stop every agent' : 'start every agent again'));
            return;
        }
        setProblem('');
        setHalt(result.value);
        setArming(false);
        setReason('');
        onChanged();
    }
    if (!services.haltStatus || !services.halt || !services.resume)
        return null;
    if (problem)
        return _jsx(Status, { tone: "error", children: problem });
    if (halt?.halted) {
        return (_jsxs("div", { className: "agent-halt halted", role: "alert", children: [_jsxs("p", { children: [_jsx("strong", { children: "Every agent is stopped" }), halt.by ? `, by ${halt.by}` : '', halt.at ? ` on ${when(halt.at)}` : '', halt.reason ? `: ${halt.reason}` : '.'] }), _jsx("button", { className: "btn", disabled: busy, onClick: () => void change(false), children: "Start them again" })] }));
    }
    return arming ? (_jsxs("div", { className: "agent-halt row", children: [_jsx("input", { "aria-label": "Why stop every agent", placeholder: "Why? The next person to look will read this.", value: reason, onChange: (e) => setReason(e.target.value) }), _jsx("button", { className: "btn arm", disabled: busy || !reason.trim(), onClick: () => void change(true), children: "Stop them" }), _jsx("button", { className: "btn ghost", disabled: busy, onClick: () => setArming(false), children: "Cancel" })] })) : (_jsx("div", { className: "agent-halt row", children: _jsx("button", { className: "btn ghost tiny", onClick: () => setArming(true), children: "Stop every agent\u2026" }) }));
}
export function AgentsSurface({ services, host, initialAgent }) {
    const [agents, setAgents] = useState([]);
    const [loaded, setLoaded] = useState(false);
    const [absent, setAbsent] = useState(false);
    const [problem, setProblem] = useState('');
    const [selected, setSelected] = useState(initialAgent ?? null);
    const load = useCallback(async () => {
        const result = await services.listAgents();
        setLoaded(true);
        if (!result.ok) {
            setAbsent(result.kind === 'unsupported');
            setProblem(failureMessage(result, 'list agents'));
            return;
        }
        setAbsent(false);
        setProblem('');
        setAgents(result.value);
        setSelected((current) => current ?? result.value[0]?.name ?? null);
    }, [services]);
    useEffect(() => {
        void load();
    }, [load]);
    /** Replace one agent with the server's answer after a change, keeping the roster's order. */
    const replace = useCallback((agent) => {
        setAgents((all) => all.map((a) => (a.name === agent.name ? agent : a)));
    }, []);
    const agent = agents.find((a) => a.name === selected) ?? null;
    return (_jsxs("div", { className: "kit-feature kit-feature-agents agentdesk", children: [_jsx(StudioPanel, { title: "Colleagues", aside: _jsx("button", { className: "btn ghost tiny", onClick: () => void load(), children: "Refresh" }), children: absent ? (_jsx(Status, { tone: "caution", children: problem })) : (_jsxs(_Fragment, { children: [_jsx(HaltBar, { services: services, onChanged: () => void load() }), problem && _jsx(Status, { tone: "error", children: problem }), loaded && agents.length === 0 && !problem && (_jsx("p", { className: "hint", children: "No agents yet. An agent is a colleague with a job: write one in the world, or adopt one a realm proposes." })), _jsx("ul", { className: "agentroster", role: "listbox", "aria-label": "Agents", children: agents.map((a) => (_jsx("li", { children: _jsxs("button", { role: "option", "aria-selected": a.name === selected, className: `agentrow${a.name === selected ? ' is-on' : ''}`, onClick: () => setSelected(a.name), children: [_jsx("span", { className: "agentrow-name", children: a.name }), _jsx("span", { className: "agentrow-job", children: a.job }), _jsxs("span", { className: "agentrow-meta", children: [_jsx(StagePill, { stage: firingOf(a) }), a.origin === 'migrated' && _jsx("span", { className: "agentrow-tag", children: "gathered from existing routines" }), a.origin !== 'world' && a.origin !== 'migrated' && _jsxs("span", { className: "agentrow-tag", children: ["from ", a.origin] }), a.needs.length > 0 && _jsxs("span", { className: "agentrow-needs", children: ["needs ", a.needs.length === 1 ? 'one thing' : `${a.needs.length} things`] })] })] }) }, a.name))) }), _jsx(SuggestedColleagues, { services: services, onOpen: (name) => { setSelected(name); void load(); }, onDrafted: (name) => { setSelected(name); void load(); } })] })) }), agent && _jsx(AgentDetail, { agent: agent, services: services, host: host, onChanged: replace }, agent.name)] }));
}
function AgentDetail({ agent, services, host, onChanged, }) {
    const [refusal, setRefusal] = useState('');
    const [busy, setBusy] = useState(false);
    const [history, setHistory] = useState(null);
    const [checked, setChecked] = useState({});
    async function move(stage, routine) {
        if (busy)
            return;
        setBusy(true);
        const result = await services.setStage(agent.name, stage, routine);
        setBusy(false);
        if (!result.ok) {
            setRefusal(failureMessage(result, `change the stage of ${agent.name}`));
            return;
        }
        setRefusal('');
        onChanged(result.value);
    }
    async function sign() {
        if (busy)
            return;
        if (host?.confirmSign && !(await host.confirmSign(agent)))
            return;
        setBusy(true);
        const result = await services.sign(agent.name);
        setBusy(false);
        if (!result.ok) {
            setRefusal(failureMessage(result, `sign ${agent.name}`));
            return;
        }
        setRefusal('');
        setHistory(null);
        onChanged(result.value);
    }
    /*
     * A TEST RUN from the card: the duty's check, now. Off duty it only observes, so it is safe to try,
     * and it is what going on duty asks for. The card is re-read afterwards, since the check moves its
     * status and, when it passes, what it was tested on.
     */
    async function testRun(duty) {
        if (busy || !services.checkDuty)
            return;
        setBusy(true);
        const result = await services.checkDuty(agent.name, duty.name);
        if (result.ok) {
            setChecked((prior) => ({ ...prior, [duty.name]: result.value }));
            const fresh = await services.listAgents();
            const now = fresh.ok ? fresh.value.find((a) => a.name === agent.name) : undefined;
            if (now)
                onChanged(now);
            setRefusal('');
        }
        else {
            setRefusal(failureMessage(result, `check ${agent.name}'s duty ${duty.name}`));
        }
        setBusy(false);
    }
    async function showHistory() {
        const result = await services.versions(agent.name);
        if (!result.ok) {
            setRefusal(failureMessage(result, `list earlier versions of ${agent.name}`));
            return;
        }
        setHistory(result.value);
    }
    const declared = agent.origin !== 'migrated';
    const signable = declared && (agent.version === 0 || agent.unsignedChanges.length > 0);
    return (_jsxs(StudioPanel, { title: agent.name, aside: _jsx(StagePill, { stage: firingOf(agent) }), children: [_jsx("p", { className: "agent-job", children: agent.job }), _jsxs("div", { className: "row agent-stage", children: [_jsx("div", { className: "stageladder", role: "group", "aria-label": `Stage for ${agent.name}`, children: STAGES.map(({ stage, label }) => (_jsx("button", { className: `stagebtn${agent.stage === stage ? ' is-on' : ''}`, "aria-pressed": agent.stage === stage, disabled: busy, onClick: () => void move(stage), children: label }, stage))) }), _jsx("span", { className: "hint", children: "Off never runs. Observing runs and writes nothing. On duty may write." })] }), refusal && _jsx(Status, { tone: "error", children: refusal }), agent.needs.length > 0 && (_jsxs("div", { className: "agent-needs", children: [_jsx("span", { className: "caption", children: "Before it can go on duty, it needs" }), _jsx("ul", { children: agent.needs.map((n) => _jsx("li", { children: n }, n)) })] })), _jsxs("dl", { className: "agent-facts", children: [agent.routing && (_jsxs(_Fragment, { children: [_jsx("dt", { children: "Ask it about" }), _jsx("dd", { children: agent.routing })] })), _jsx("dt", { children: "Sponsor" }), _jsx("dd", { children: agent.sponsor ?? _jsx("span", { className: "hint", children: "nobody yet" }) }), agent.owners.length > 0 && (_jsxs(_Fragment, { children: [_jsx("dt", { children: "Owners" }), _jsx("dd", { children: agent.owners.join(', ') })] })), agent.operators.length > 0 && (_jsxs(_Fragment, { children: [_jsx("dt", { children: "Operators" }), _jsx("dd", { children: agent.operators.join(', ') })] })), agent.persona && (_jsxs(_Fragment, { children: [_jsx("dt", { children: "Persona" }), _jsx("dd", { children: agent.persona })] })), _jsx("dt", { children: "State" }), _jsx("dd", { children: agent.state })] }), _jsx("h3", { className: "caption", children: "Routines" }), agent.routines.length === 0 ? (_jsx("p", { className: "hint", children: "No routines." })) : (_jsx("div", { className: "tablewrap", children: _jsxs("table", { className: "results-table agent-routines", children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { children: "Routine" }), _jsx("th", { children: "When" }), _jsx("th", { children: "Chosen" }), _jsx("th", { children: "Runs" }), _jsx("th", { "aria-label": "actions" })] }) }), _jsx("tbody", { children: agent.routines.map((r) => (_jsxs("tr", { className: r.missing ? 'is-missing' : undefined, children: [_jsxs("td", { children: [_jsx("code", { children: r.name }), r.description && _jsx("div", { className: "hint", children: r.description })] }), _jsx("td", { children: r.trigger }), _jsx("td", { children: _jsx("select", { "aria-label": `Stage for routine ${r.name}`, value: r.stage, disabled: busy || r.missing, onChange: (event) => void move(event.target.value, r.name), children: STAGES.map(({ stage, label }) => _jsx("option", { value: stage, children: label }, stage)) }) }), _jsx("td", { children: _jsx(StagePill, { stage: r.firing }) }), _jsx("td", { children: host?.editRoutine && !r.missing && (_jsx("button", { className: "btn ghost tiny", onClick: () => host.editRoutine?.(r.name), children: "Edit" })) })] }, r.name))) })] }) })), agent.duties.length > 0 && (_jsxs(_Fragment, { children: [_jsx("h3", { className: "caption", children: "Duties" }), _jsx("ul", { className: "agent-duties", children: agent.duties.map((d) => (_jsxs("li", { children: [_jsx("strong", { children: d.text || d.name }), _jsxs("span", { className: "hint", children: [" \u00B7 ", d.holds, d.every ? ` · ${d.every}` : '', d.timezone ? ` · ${d.timezone}` : '', " \u00B7 ", d.status] }), _jsxs("div", { className: "row", children: [_jsx("span", { className: "hint", title: d.testedAt ?? undefined, children: testedWords(d, agent.version) }), services.checkDuty && (_jsx("button", { className: "btn ghost tiny", disabled: busy, onClick: () => void testRun(d), children: "Test run" }))] }), _jsx(CheckFound, { check: checked[d.name] })] }, d.name))) })] })), declared && (_jsxs("div", { className: "agent-version", children: [_jsx("h3", { className: "caption", children: "Version" }), agent.version === 0 ? (_jsx("p", { className: "hint", children: "Never signed. It runs nothing until its sponsor signs version 1." })) : (_jsxs("p", { title: agent.signedAt ?? undefined, children: ["Running version ", agent.version, ", signed by ", agent.signedBy, " ", agent.signedAt ? `on ${when(agent.signedAt)}` : '', "."] })), agent.unsignedChanges.length > 0 && (_jsxs("div", { className: "agent-unsigned", children: [_jsx("span", { className: "caption", children: "Not yet in effect" }), _jsx("ul", { children: agent.unsignedChanges.map((c) => _jsx("li", { children: c }, c)) })] })), _jsxs("div", { className: "row", children: [_jsxs("button", { className: "btn primary", disabled: !signable || busy, onClick: () => void sign(), children: ["Sign version ", agent.version + 1] }), _jsx("button", { className: "btn ghost", onClick: () => void showHistory(), children: "Earlier versions" })] }), history && (history.length === 0 ? _jsx("p", { className: "hint", children: "No signed versions yet." }) : (_jsx("ul", { className: "agent-history", children: history.map((v) => (_jsxs("li", { title: v.digest, children: ["Version ", v.version, " \u00B7 ", v.signedBy, " \u00B7 ", when(v.signedAt), " \u00B7 ", v.routines.length, " routine", v.routines.length === 1 ? '' : 's'] }, v.version))) })))] }))] }));
}
//# sourceMappingURL=AgentsSurface.js.map