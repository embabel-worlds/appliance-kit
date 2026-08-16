"use strict";
/*
 * WHAT YOU CAN ASK ABOUT, AND HOW.
 *
 * The engine's real primitives, per `realm-spec/VIRTUAL_CYPHER.md`. Lifted out of
 * me-app's Query Studio, where they were entangled with the DOM controls that
 * happened to render them — so the Worlds console, which has no composer at all,
 * can offer the same thing without a second reading of the spec.
 *
 * The shape worth preserving: RELEVANCE IS AN EDGE, and the mode is chosen AT the
 * edge. No `via` is a vector search (about X); `via:'keyword'` is lexical
 * (mentions X); `via:'agentic-rag'` with an `intent` is a bounded LLM loop
 * judging every candidate against a brief. Three modes because they are three
 * different questions, not three settings.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.AI_KEYS = exports.VIA_VALUES = exports.TARGETS = exports.esc = void 0;
/** Cypher string-literal escape: backslashes first, then quotes. Order matters. */
const esc = (s) => s.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
exports.esc = esc;
exports.TARGETS = {
    documents: {
        name: 'Documents',
        what: 'your ingested knowledge base',
        seedLabel: 'Search for',
        modes: ['about', 'mentions', 'judged'],
        tags: true,
        dates: true,
    },
    files: {
        name: 'Files',
        what: 'shared folders, walked live',
        seedLabel: 'Term or idea',
        modes: ['mentions', 'judged'],
        tags: false,
        dates: false,
    },
    threads: {
        name: 'Email threads',
        what: 'relevance over thread summaries',
        seedLabel: 'Seed',
        modes: ['semantic'],
        tags: false,
        dates: false,
        anchors: {
            topic: { label: 'Topic (Concept)', pattern: (v) => `(:Concept {value:'${(0, exports.esc)(v)}'})`, placeholder: 'the renewal' },
            person: { label: 'Person', pattern: (v) => `(:Person {name:'${(0, exports.esc)(v)}'})`, placeholder: 'Ada Lovelace' },
            organization: { label: 'Organization', pattern: (v) => `(:Organization {name:'${(0, exports.esc)(v)}'})`, placeholder: 'Acme' },
            meeting: { label: 'Meeting', pattern: (v) => `(:Meeting {subject:'${(0, exports.esc)(v)}'})`, placeholder: 'Q3 planning' },
        },
    },
    canvas: {
        name: 'Blank canvas',
        what: 'the whole graph, your shapes',
        modes: [],
        tags: false,
        dates: false,
    },
};
/** The `via` vocabulary, for an editor offering completions. */
exports.VIA_VALUES = ['keyword', 'agentic-rag'];
/** The `{ai:{…}}` steering keys. Nested map, not the retired `ai_*` flat keys. */
exports.AI_KEYS = ['hint', 'model', 'temperature', 'confidence', 'fresh'];
//# sourceMappingURL=targets.js.map