"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.glyphFor = glyphFor;
exports.AppIcon = AppIcon;
const jsx_runtime_1 = require("react/jsx-runtime");
/*
 * WHAT AN APP LOOKS LIKE IN A LIST.
 *
 * The appliance already answers this properly: an app that declares
 * `<link rel="icon" href="something-it-ships">` gets an `iconUrl` in the artifact
 * listing, and that URL is what belongs here. The server is strict about it — the href
 * has to resolve to a file the app actually ships, through the same lookup that will
 * serve it — so an `iconUrl` never 404s into a hole in the rail.
 *
 * The trouble is that almost no app declares one, and a wall of identical initials is
 * not an icon set; it is a wall. So where an app says nothing, this GUESSES from what
 * the app is called and what it says it does, against a small table of glyphs. A guess
 * is honest here in a way it would not be elsewhere: the name is right beside it, the
 * icon is only there to make one row findable among twenty, and a wrong glyph costs a
 * glance. An app that wants to be sure declares an icon and this stops guessing.
 *
 * Matching runs on name AND description, first rule wins, so ORDER IS THE RULE. The
 * specific sits above the general: `street-lens` is a map before it is a lens, and
 * `grants-atlas` is money before it is an atlas.
 */
const react_1 = require("react");
const RULES = [
    [/weather|forecast|climate|temperature|rain/, 'CloudSun'],
    [/planet|earth|globe|world|global|nation/, 'Globe'],
    [/map|atlas|street|place|region|postcode|suburb|geo|where/, 'MapTrifold'],
    [/signal|alert|broadcast|watch|notif/, 'Broadcast'],
    [/hansard|speech|debate|transcript|said|voice|interview/, 'Microphone'],
    [/grant|money|donation|fund|spend|budget|finance|invoice|payment|price|cost|salary|pay\b/, 'CurrencyDollar'],
    [/bank|treasury|tax|revenue/, 'Bank'],
    [/health|patient|care|ndis|clinic|medical|hospital|disability/, 'Heartbeat'],
    [/pulse|monitor|live|status|uptime|health-check/, 'Pulse'],
    [/law|legal|court|justice|policy|regulation|complian|scrutin|audit/, 'Scales'],
    [/intelligen|insight|reason|judge|classif|smart/, 'Brain'],
    [/pattern|graph|network|entit|relation|knowledge|connect/, 'Graph'],
    [/record|register|ledger|archive|histor|provenance/, 'Archive'],
    [/news|press|media|article|headline/, 'Newspaper'],
    [/calendar|schedule|diary|agenda|meeting|roster/, 'CalendarBlank'],
    [/people|person|contact|staff|member|team|customer|resident/, 'Users'],
    [/chart|dashboard|metric|stat|trend|analytic|report\b/, 'ChartLine'],
    [/mail|email|inbox|message|thread/, 'Envelope'],
    [/build|property|estate|office|council|premises/, 'Buildings'],
    [/shop|order|product|retail|cart|sales|stock/, 'ShoppingCart'],
    [/learn|course|study|school|teach|train/, 'GraduationCap'],
    [/lens|search|find|explore|browse|query/, 'MagnifyingGlass'],
    [/doc|paper|note|brief|memo|minutes|file/, 'FileText'],
    [/code|api|deploy|pipeline|build/, 'Code'],
];
/** The glyph for an app that declares no icon of its own. Never null — a window is an app. */
function glyphFor(name, description) {
    const text = `${name} ${description ?? ''}`.toLowerCase();
    return RULES.find(([re]) => re.test(text))?.[1] ?? 'AppWindow';
}
/**
 * An app's own icon where it ships one, a guessed glyph where it does not.
 *
 * `onError` matters more than it looks: the server checks the icon file exists when it
 * builds the listing, but a PIN outlives the listing that made it, and the app it names
 * can be deleted or its realm uninstalled. Without this, a stale pin shows as a broken
 * image in the shell of every tab.
 */
function AppIcon({ src, name, description, size = 16, className = '' }) {
    const [broken, setBroken] = (0, react_1.useState)(false);
    const cls = `appicon ${className}`.trim();
    const glyph = glyphFor(name, description);
    const [Glyph, setGlyph] = (0, react_1.useState)(null);
    (0, react_1.useEffect)(() => {
        if (src && !broken)
            return;
        let active = true;
        void Promise.resolve().then(() => __importStar(require('@phosphor-icons/react'))).then((icons) => {
            if (active)
                setGlyph(() => icons[glyph]);
        });
        return () => { active = false; };
    }, [broken, glyph, src]);
    if (src && !broken) {
        return (0, jsx_runtime_1.jsx)("img", { className: cls, src: src, alt: "", "aria-hidden": "true", width: size, height: size, onError: () => setBroken(true) });
    }
    return ((0, jsx_runtime_1.jsx)("span", { className: `${cls} appicon-glyph`, "aria-hidden": "true", children: Glyph
            ? (0, jsx_runtime_1.jsx)(Glyph, { size: size, weight: "duotone" })
            : (0, jsx_runtime_1.jsx)("svg", { width: size, height: size, viewBox: "0 0 16 16", children: (0, jsx_runtime_1.jsx)("rect", { x: "2", y: "3", width: "12", height: "10", rx: "1", fill: "none", stroke: "currentColor" }) }) }));
}
//# sourceMappingURL=AppIcon.js.map