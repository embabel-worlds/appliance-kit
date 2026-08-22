"use strict";
/*
 * TIP OF THE DAY, shared. One rotation and one card, consumed by the worlds console
 * (React mounts the element) and the Me app (plain DOM) — so what a tip looks like and
 * when it repeats cannot drift between surfaces. The server owns WHICH tips exist
 * (installation tier + the acting user's world tier, realm-shipped included); this module
 * owns only presentation and the seen-set.
 *
 * Framework-neutral on purpose, like the rest of the kit: it returns an HTMLElement and
 * takes callbacks. Markdown is INJECTED (`renderBody`), never bundled — both hosts already
 * carry their own sanitizing pipelines, and a second copy of one is how they diverge.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TipRotation = void 0;
exports.renderTipCard = renderTipCard;
const outcome_ts_1 = require("../client/outcome.js");
const SEEN_KEY = 'embabel-tips-seen';
/** The seen-set is a convenience, not a ledger — cap it so it cannot grow without bound. */
const SEEN_CAP = 200;
/**
 * Hands out tips, avoiding repeats until the pool is exhausted, remembering across visits.
 * All server-side randomness: `next()` is one `/hints/random` call with the seen ids excluded.
 */
class TipRotation {
    options;
    storage;
    constructor(options) {
        this.options = options;
        this.storage = options.storage ?? safeLocalStorage();
    }
    seen() {
        try {
            const raw = this.storage.getItem(SEEN_KEY);
            const parsed = raw ? JSON.parse(raw) : [];
            return Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string') : [];
        }
        catch {
            return [];
        }
    }
    markSeen(id) {
        try {
            const ids = this.seen().filter((x) => x !== id);
            ids.push(id);
            this.storage.setItem(SEEN_KEY, JSON.stringify(ids.slice(-SEEN_CAP)));
        }
        catch {
            /* a full or refusing store costs persistence, never the tip */
        }
    }
    /** The next tip, or undefined when the appliance has none (or the call failed — a tip is
     *  never worth an error surface). */
    async next() {
        const outcome = await this.options.hints.random(this.seen(), this.options.surface);
        if (!(0, outcome_ts_1.isOk)(outcome) || !outcome.value)
            return undefined;
        this.markSeen(outcome.value.id ?? '');
        return outcome.value;
    }
}
exports.TipRotation = TipRotation;
/**
 * One tip as a DOM element, kit-styled (the tip block in `css/components.css`). The body goes through
 * [TipCardOptions.renderBody] when the host provides one — the host owns sanitization,
 * exactly as it does for every other model-authored or realm-authored string it paints.
 */
function renderTipCard(hint, options = {}) {
    const card = document.createElement('div');
    card.className = 'tip-card';
    card.dataset.category = hint.category ?? 'hint';
    const head = document.createElement('div');
    head.className = 'tip-head';
    const title = document.createElement('span');
    title.className = 'tip-title';
    title.textContent = `${hint.icon ? hint.icon + ' ' : ''}${hint.title ?? ''}`;
    head.appendChild(title);
    const badge = document.createElement('span');
    badge.className = 'tip-badge';
    badge.textContent = categoryLabel(hint.category);
    head.appendChild(badge);
    card.appendChild(head);
    const body = document.createElement('div');
    body.className = 'tip-body';
    if (options.renderBody)
        body.innerHTML = options.renderBody(hint.body ?? '');
    else
        body.textContent = hint.body ?? '';
    card.appendChild(body);
    const actions = document.createElement('div');
    actions.className = 'tip-actions';
    if (hint.action && options.onAction) {
        const go = document.createElement('button');
        go.type = 'button';
        go.className = 'tip-action';
        go.textContent = hint.action.label;
        go.addEventListener('click', () => options.onAction?.(hint.action?.chatInput ?? ''));
        actions.appendChild(go);
    }
    if (options.onNext) {
        const next = document.createElement('button');
        next.type = 'button';
        next.className = 'tip-next';
        next.textContent = '\u2192'; // an arrow reads as "next"; a word reads as a second action
        next.setAttribute('aria-label', 'Another tip');
        next.title = 'Another tip';
        next.addEventListener('click', () => options.onNext?.());
        actions.appendChild(next);
    }
    if (options.onDismiss) {
        const dismiss = document.createElement('button');
        dismiss.type = 'button';
        dismiss.className = 'tip-dismiss';
        dismiss.setAttribute('aria-label', 'Dismiss tip');
        dismiss.textContent = '×';
        dismiss.addEventListener('click', () => options.onDismiss?.());
        actions.appendChild(dismiss);
    }
    if (actions.childElementCount > 0)
        card.appendChild(actions);
    return card;
}
function categoryLabel(category) {
    switch ((category ?? '').toLowerCase()) {
        case 'did-you-know':
            return 'Did you know';
        case 'fun-fact':
            return 'Fun fact';
        default:
            return 'Tip';
    }
}
function safeLocalStorage() {
    try {
        // Touch it once: some contexts throw on ACCESS, not on use.
        globalThis.localStorage.getItem(SEEN_KEY);
        return globalThis.localStorage;
    }
    catch {
        const mem = new Map();
        return {
            getItem: (k) => mem.get(k) ?? null,
            setItem: (k, v) => void mem.set(k, v),
        };
    }
}
//# sourceMappingURL=index.js.map