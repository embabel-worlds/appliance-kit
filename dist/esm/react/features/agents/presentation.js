/*
 * HOW AN AGENT IS PRESENTED, read off what the server already sends rather than told by it.
 *
 * A CONVERSATIONAL agent is a colleague people talk to: it has a persona and nothing it does on its
 * own, no routines and no duties. For one of those the worker's card is mostly noise — a ladder about
 * writing, a pill that always says "off duty" because nothing fires, empty schedules — so the card
 * leads with who it is and whether it can be talked to. Anything holding a routine or a duty is a
 * WORKER, persona or not, and keeps the full card: the moment it does work unattended, the ladder and
 * what fires are what its sponsor needs to see.
 *
 * Nothing here is a field. Should the server one day say what kind of agent it is, this is the one
 * place to stop guessing.
 */
export function presentationOf(agent) {
    return agent.persona && agent.routines.length === 0 && agent.duties.length === 0 ? 'conversational' : 'worker';
}
/**
 * Why a conversational agent cannot be talked to right now, in a sponsor's words; empty when it can.
 * It needs four things, all already on the agent: a signed version, a sponsor, to be active, and not off.
 */
export function unavailableBecause(agent) {
    const why = [];
    if (agent.version === 0)
        why.push('never signed');
    if (!agent.sponsor)
        why.push('nobody sponsors it');
    if (agent.state !== 'active')
        why.push(`it is ${agent.state}`);
    if (agent.stage === 'off')
        why.push('it is set unavailable');
    return why;
}
export function canTalkNow(agent) {
    return unavailableBecause(agent).length === 0;
}
//# sourceMappingURL=presentation.js.map