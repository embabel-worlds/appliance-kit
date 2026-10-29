import type { components } from './generated/openapi.ts';
import { type Outcome } from './outcome.ts';
import type { Transport } from './transport.ts';
type Schemas = components['schemas'];
export type ConsolePreferences = Schemas['ConsolePreferences'];
export type ConsolePreferenceEntry = Schemas['ConsolePreferenceEntry'];
export declare class ConsolePreferencesClient {
    private readonly transport;
    constructor(transport: Transport);
    /** What the appliance holds for the signed-in user's active world; version 0 when nothing. */
    get(): Promise<Outcome<ConsolePreferences>>;
    /** Merge [entries] into what is stored; answers the whole document as stored afterwards. */
    change(entries: Record<string, ConsolePreferenceEntry>): Promise<Outcome<ConsolePreferences>>;
}
/** Where this class keeps its own small record: `localStorage` in a browser, a Map in a test. */
export interface PreferenceStorage {
    getItem(key: string): string | null;
    setItem(key: string, value: string): void;
    removeItem(key: string): void;
}
/** Where the values themselves live. `undefined` means not set. */
export interface PreferenceValues {
    read(key: string): unknown;
    write(key: string, value: unknown): void;
}
export interface PreferenceSyncOptions {
    client: Pick<ConsolePreferencesClient, 'get' | 'change'>;
    /** The settings kept in step; anything else in the appliance's document is left alone. */
    keys: readonly string[];
    values: PreferenceValues;
    storage: PreferenceStorage;
    /** The signed-in user; the record is kept per user so one person's settings never show for another. */
    user: string;
    /** Prefix of the record's storage key. */
    recordKey?: string;
    /** How long to wait after a change before sending it. */
    debounceMs?: number;
    now?: () => number;
    setTimer?: (run: () => void, ms: number) => unknown;
    clearTimer?: (timer: unknown) => void;
}
/** Why the last load or send did not reach the appliance, or null when it did. */
export type SyncProblem = {
    kind: Exclude<Outcome<unknown>, {
        ok: true;
    }>['kind'];
    message: string;
} | null;
export type PreferenceListener = (changed: string[]) => void;
export declare class PreferenceSync {
    private readonly options;
    private readonly key;
    private readonly managed;
    private readonly now;
    private record;
    private timer;
    private sending;
    private readonly listeners;
    /** True until this user has synced in this browser: there is nothing applied or pending to go on. */
    readonly firstSync: boolean;
    /** Whether the appliance has answered a load in this session. */
    loaded: boolean;
    problem: SyncProblem;
    constructor(options: PreferenceSyncOptions);
    /** The front end just wrote [key]; send it shortly. */
    changed(key: string): void;
    /** Whether a change to [key] is waiting to be sent. */
    isPending(key: string): boolean;
    subscribe(listener: PreferenceListener): () => void;
    /**
     * Make this browser's values the appliance's, pending changes kept on top, then send what is
     * pending. With [adoptLocal], a setting the appliance does not hold but this browser does is sent
     * up rather than cleared — the migration of values kept here before the appliance kept them.
     * Listeners hear every key whose value this changed. A failure changes nothing here.
     */
    load({ adoptLocal }?: {
        adoptLocal?: boolean;
    }): Promise<void>;
    /** Send every pending change now, rather than after the pause. */
    flush(): Promise<void>;
    private send;
    /** The appliance's entries written into this browser where they are news; [alreadyChanged] joins the report. */
    private apply;
    private readRecord;
    private writeRecord;
}
export {};
//# sourceMappingURL=consolePreferences.d.ts.map