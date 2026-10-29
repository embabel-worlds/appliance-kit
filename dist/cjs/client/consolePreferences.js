"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PreferenceSync = exports.ConsolePreferencesClient = void 0;
const outcome_ts_1 = require("./outcome.js");
const PATH = '/api/v1/profile/console';
class ConsolePreferencesClient {
    transport;
    constructor(transport) {
        this.transport = transport;
    }
    /** What the appliance holds for the signed-in user's active world; version 0 when nothing. */
    get() {
        return this.transport.send({ method: 'GET', path: PATH });
    }
    /** Merge [entries] into what is stored; answers the whole document as stored afterwards. */
    change(entries) {
        return this.transport.send({ method: 'PUT', path: PATH, body: { entries } });
    }
}
exports.ConsolePreferencesClient = ConsolePreferencesClient;
class PreferenceSync {
    options;
    key;
    managed;
    now;
    record;
    timer = null;
    sending = Promise.resolve();
    listeners = new Set();
    /** True until this user has synced in this browser: there is nothing applied or pending to go on. */
    firstSync;
    /** Whether the appliance has answered a load in this session. */
    loaded = false;
    problem = null;
    constructor(options) {
        this.options = options;
        this.key = `${options.recordKey ?? 'embabel.console-preferences'}:${options.user}`;
        this.managed = new Set(options.keys);
        this.now = options.now ?? (() => Date.now());
        const stored = this.readRecord();
        this.firstSync = stored === null;
        this.record = stored ?? { applied: {}, pending: {} };
    }
    /** The front end just wrote [key]; send it shortly. */
    changed(key) {
        if (!this.managed.has(key))
            return;
        this.record.pending[key] = Math.max(this.now(), (this.record.pending[key] ?? 0) + 1);
        this.writeRecord();
        if (this.timer !== null)
            (this.options.clearTimer ?? clearTimeout)(this.timer);
        this.timer = (this.options.setTimer ?? setTimeout)(() => {
            this.timer = null;
            void this.flush();
        }, this.options.debounceMs ?? 800);
    }
    /** Whether a change to [key] is waiting to be sent. */
    isPending(key) {
        return key in this.record.pending;
    }
    subscribe(listener) {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }
    /**
     * Make this browser's values the appliance's, pending changes kept on top, then send what is
     * pending. With [adoptLocal], a setting the appliance does not hold but this browser does is sent
     * up rather than cleared — the migration of values kept here before the appliance kept them.
     * Listeners hear every key whose value this changed. A failure changes nothing here.
     */
    async load({ adoptLocal = false } = {}) {
        const outcome = await this.options.client.get();
        if (!(0, outcome_ts_1.isOk)(outcome)) {
            this.problem = { kind: outcome.kind, message: outcome.message };
            return;
        }
        this.problem = null;
        this.loaded = true;
        const held = outcome.value.entries ?? {};
        const now = this.now();
        const absent = [...this.managed].filter((key) => !(key in held) && !this.isPending(key));
        const adopted = adoptLocal ? absent.filter((key) => this.options.values.read(key) !== undefined) : [];
        adopted.forEach((key) => { this.record.pending[key] = now; });
        const cleared = absent.filter((key) => !adopted.includes(key) && this.options.values.read(key) !== undefined);
        cleared.forEach((key) => this.options.values.write(key, undefined));
        this.apply(outcome.value, cleared);
        if (Object.keys(this.record.pending).length)
            await this.flush();
    }
    /** Send every pending change now, rather than after the pause. */
    flush() {
        if (this.timer !== null) {
            ;
            (this.options.clearTimer ?? clearTimeout)(this.timer);
            this.timer = null;
        }
        // One write at a time; a change made while one is in flight goes with the next.
        this.sending = this.sending.then(() => this.send());
        return this.sending;
    }
    async send() {
        const sent = { ...this.record.pending };
        if (!Object.keys(sent).length)
            return;
        const entries = Object.fromEntries(Object.entries(sent).map(([key, at]) => {
            const value = this.options.values.read(key);
            return [key, { value: (value === undefined ? null : value), at }];
        }));
        const outcome = await this.options.client.change(entries);
        if (!(0, outcome_ts_1.isOk)(outcome)) {
            this.problem = { kind: outcome.kind, message: outcome.message };
            return;
        }
        this.problem = null;
        // Only what was sent, and not changed again since, stops being pending.
        for (const [key, at] of Object.entries(sent)) {
            if (this.record.pending[key] === at)
                delete this.record.pending[key];
        }
        this.apply(outcome.value, []);
    }
    /** The appliance's entries written into this browser where they are news; [alreadyChanged] joins the report. */
    apply(doc, alreadyChanged) {
        const changed = Object.entries(doc.entries ?? {})
            .filter(([key]) => this.managed.has(key) && !this.isPending(key))
            .filter(([key, entry]) => {
            const news = this.record.applied[key] !== entry.at || !sameValue(this.options.values.read(key), entry.value);
            this.record.applied[key] = entry.at;
            if (news && !sameValue(this.options.values.read(key), entry.value)) {
                this.options.values.write(key, entry.value ?? undefined);
                return true;
            }
            return false;
        })
            .map(([key]) => key);
        this.writeRecord();
        const all = [...new Set([...alreadyChanged, ...changed])].sort();
        if (all.length)
            this.listeners.forEach((listener) => listener(all));
    }
    readRecord() {
        try {
            const raw = this.options.storage.getItem(this.key);
            if (!raw)
                return null;
            const parsed = JSON.parse(raw);
            return {
                applied: parsed.applied && typeof parsed.applied === 'object' ? parsed.applied : {},
                pending: parsed.pending && typeof parsed.pending === 'object' ? parsed.pending : {},
            };
        }
        catch {
            return null;
        }
    }
    writeRecord() {
        try {
            this.options.storage.setItem(this.key, JSON.stringify(this.record));
        }
        catch {
            // Storage refused: the settings still apply for this page, and the appliance keeps them.
        }
    }
}
exports.PreferenceSync = PreferenceSync;
function sameValue(a, b) {
    return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}
//# sourceMappingURL=consolePreferences.js.map