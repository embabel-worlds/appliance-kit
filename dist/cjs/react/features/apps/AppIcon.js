"use strict";
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
const react_2 = require("@phosphor-icons/react");
const RULES = [
    [/weather|forecast|climate|temperature|rain/, react_2.CloudSun],
    [/planet|earth|globe|world|global|nation/, react_2.Globe],
    [/map|atlas|street|place|region|postcode|suburb|geo|where/, react_2.MapTrifold],
    [/signal|alert|broadcast|watch|notif/, react_2.Broadcast],
    [/hansard|speech|debate|transcript|said|voice|interview/, react_2.Microphone],
    [/grant|money|donation|fund|spend|budget|finance|invoice|payment|price|cost|salary|pay\b/, react_2.CurrencyDollar],
    [/bank|treasury|tax|revenue/, react_2.Bank],
    [/health|patient|care|ndis|clinic|medical|hospital|disability/, react_2.Heartbeat],
    [/pulse|monitor|live|status|uptime|health-check/, react_2.Pulse],
    [/law|legal|court|justice|policy|regulation|complian|scrutin|audit/, react_2.Scales],
    [/intelligen|insight|reason|judge|classif|smart/, react_2.Brain],
    [/pattern|graph|network|entit|relation|knowledge|connect/, react_2.Graph],
    [/record|register|ledger|archive|histor|provenance/, react_2.Archive],
    [/news|press|media|article|headline/, react_2.Newspaper],
    [/calendar|schedule|diary|agenda|meeting|roster/, react_2.CalendarBlank],
    [/people|person|contact|staff|member|team|customer|resident/, react_2.Users],
    [/chart|dashboard|metric|stat|trend|analytic|report\b/, react_2.ChartLine],
    [/mail|email|inbox|message|thread/, react_2.Envelope],
    [/build|property|estate|office|council|premises/, react_2.Buildings],
    [/shop|order|product|retail|cart|sales|stock/, react_2.ShoppingCart],
    [/learn|course|study|school|teach|train/, react_2.GraduationCap],
    [/lens|search|find|explore|browse|query/, react_2.MagnifyingGlass],
    [/doc|paper|note|brief|memo|minutes|file/, react_2.FileText],
    [/code|api|deploy|pipeline|build/, react_2.Code],
];
/** The glyph for an app that declares no icon of its own. Never null — a window is an app. */
function glyphFor(name, description) {
    const text = `${name} ${description ?? ''}`.toLowerCase();
    return RULES.find(([re]) => re.test(text))?.[1] ?? react_2.AppWindow;
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
    if (src && !broken) {
        return (0, jsx_runtime_1.jsx)("img", { className: cls, src: src, alt: "", "aria-hidden": "true", width: size, height: size, onError: () => setBroken(true) });
    }
    const Glyph = glyphFor(name, description);
    return ((0, jsx_runtime_1.jsx)("span", { className: `${cls} appicon-glyph`, "aria-hidden": "true", children: (0, jsx_runtime_1.jsx)(Glyph, { size: size, weight: "duotone" }) }));
}
//# sourceMappingURL=AppIcon.js.map