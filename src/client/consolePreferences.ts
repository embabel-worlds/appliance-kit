import type { components } from './generated/openapi.ts'
import { isOk, type Outcome } from './outcome.ts'
import type { Transport } from './transport.ts'

/*
 * CONSOLE PREFERENCES, KEPT BY THE APPLIANCE.
 *
 * The theme somebody chose, their wallpaper, where they left their windows, the apps on their dock:
 * the appliance keeps these in the signed-in user's world (`/api/v1/profile/console`), so a second
 * browser opens the console the way the first left it, and an exported world takes them along.
 *
 * The server treats each setting as an opaque JSON value under a key, stamped with when it was
 * changed (`at`). A write replaces a setting only if it is not older than the stored one: last write
 * wins, setting by setting, so two browsers changing different things never undo each other.
 */

type Schemas = components['schemas']

export type ConsolePreferences = Schemas['ConsolePreferences']
export type ConsolePreferenceEntry = Schemas['ConsolePreferenceEntry']

const PATH = '/api/v1/profile/console'

export class ConsolePreferencesClient {
  constructor(private readonly transport: Transport) {}

  /** What the appliance holds for the signed-in user's active world; version 0 when nothing. */
  get(): Promise<Outcome<ConsolePreferences>> {
    return this.transport.send({ method: 'GET', path: PATH })
  }

  /** Merge [entries] into what is stored; answers the whole document as stored afterwards. */
  change(entries: Record<string, ConsolePreferenceEntry>): Promise<Outcome<ConsolePreferences>> {
    return this.transport.send({ method: 'PUT', path: PATH, body: { entries } })
  }
}

/*
 * THE BROWSER'S SIDE: VALUES WHERE THEY ALWAYS WERE, AND WHAT HAS NOT BEEN SENT.
 *
 * Reads are synchronous — a theme is painted, a window opened, before anything could be fetched —
 * so the values stay where the front end already keeps them (its `values` adapter: localStorage
 * keys, in the console), and this class keeps them in step with the appliance. Its own record is
 * small: for each setting, the `at` of the appliance's copy it last applied, and the time of any
 * change made here that the appliance has not acknowledged. A change is written by the front end as
 * before, then `changed(key)` marks it pending, and it is sent after a short pause, so a window being
 * dragged costs one write, not fifty.
 *
 * WHO WINS. The appliance's document is the truth; a pending change rides on top of it until sent,
 * and the server decides between it and anything newer from another browser by `at`. A change that
 * fails to send stays pending — offline, or an appliance too old to keep preferences — and goes with
 * the next attempt. The record is kept per user, and a load makes the browser's values the user's
 * own: a setting the appliance does not hold for them is cleared rather than inherited from
 * whoever used this browser before, unless the caller asks to adopt what is here (`adoptLocal`, for
 * the one migration of values kept before the appliance kept them).
 */

/** Where this class keeps its own small record: `localStorage` in a browser, a Map in a test. */
export interface PreferenceStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

/** Where the values themselves live. `undefined` means not set. */
export interface PreferenceValues {
  read(key: string): unknown
  write(key: string, value: unknown): void
}

export interface PreferenceSyncOptions {
  client: Pick<ConsolePreferencesClient, 'get' | 'change'>
  /** The settings kept in step; anything else in the appliance's document is left alone. */
  keys: readonly string[]
  values: PreferenceValues
  storage: PreferenceStorage
  /** The signed-in user; the record is kept per user so one person's settings never show for another. */
  user: string
  /** Prefix of the record's storage key. */
  recordKey?: string
  /** How long to wait after a change before sending it. */
  debounceMs?: number
  now?: () => number
  setTimer?: (run: () => void, ms: number) => unknown
  clearTimer?: (timer: unknown) => void
}

interface SyncRecord {
  /** Per setting, the `at` of the appliance's entry last applied here. */
  applied: Record<string, number>
  /** Per setting, when it was changed here without the appliance having acknowledged it. */
  pending: Record<string, number>
}

/** Why the last load or send did not reach the appliance, or null when it did. */
export type SyncProblem = { kind: Exclude<Outcome<unknown>, { ok: true }>['kind']; message: string } | null

export type PreferenceListener = (changed: string[]) => void

export class PreferenceSync {
  private readonly options: PreferenceSyncOptions
  private readonly key: string
  private readonly managed: Set<string>
  private readonly now: () => number
  private record: SyncRecord
  private timer: unknown = null
  private sending: Promise<void> = Promise.resolve()
  private readonly listeners = new Set<PreferenceListener>()
  /** True until this user has synced in this browser: there is nothing applied or pending to go on. */
  readonly firstSync: boolean
  /** Whether the appliance has answered a load in this session. */
  loaded = false
  problem: SyncProblem = null

  constructor(options: PreferenceSyncOptions) {
    this.options = options
    this.key = `${options.recordKey ?? 'embabel.console-preferences'}:${options.user}`
    this.managed = new Set(options.keys)
    this.now = options.now ?? (() => Date.now())
    const stored = this.readRecord()
    this.firstSync = stored === null
    this.record = stored ?? { applied: {}, pending: {} }
  }

  /** The front end just wrote [key]; send it shortly. */
  changed(key: string): void {
    if (!this.managed.has(key)) return
    this.record.pending[key] = Math.max(this.now(), (this.record.pending[key] ?? 0) + 1)
    this.writeRecord()
    if (this.timer !== null) (this.options.clearTimer ?? clearTimeout)(this.timer as ReturnType<typeof setTimeout>)
    this.timer = (this.options.setTimer ?? setTimeout)(() => {
      this.timer = null
      void this.flush()
    }, this.options.debounceMs ?? 800)
  }

  /** Whether a change to [key] is waiting to be sent. */
  isPending(key: string): boolean {
    return key in this.record.pending
  }

  subscribe(listener: PreferenceListener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  /**
   * Make this browser's values the appliance's, pending changes kept on top, then send what is
   * pending. With [adoptLocal], a setting the appliance does not hold but this browser does is sent
   * up rather than cleared — the migration of values kept here before the appliance kept them.
   * Listeners hear every key whose value this changed. A failure changes nothing here.
   */
  async load({ adoptLocal = false }: { adoptLocal?: boolean } = {}): Promise<void> {
    const outcome = await this.options.client.get()
    if (!isOk(outcome)) {
      this.problem = { kind: outcome.kind, message: outcome.message }
      return
    }
    this.problem = null
    this.loaded = true
    const held = outcome.value.entries ?? {}
    const now = this.now()
    const absent = [...this.managed].filter((key) => !(key in held) && !this.isPending(key))
    const adopted = adoptLocal ? absent.filter((key) => this.options.values.read(key) !== undefined) : []
    adopted.forEach((key) => { this.record.pending[key] = now })
    const cleared = absent.filter((key) => !adopted.includes(key) && this.options.values.read(key) !== undefined)
    cleared.forEach((key) => this.options.values.write(key, undefined))
    this.apply(outcome.value, cleared)
    if (Object.keys(this.record.pending).length) await this.flush()
  }

  /** Send every pending change now, rather than after the pause. */
  flush(): Promise<void> {
    if (this.timer !== null) {
      ;(this.options.clearTimer ?? clearTimeout)(this.timer as ReturnType<typeof setTimeout>)
      this.timer = null
    }
    // One write at a time; a change made while one is in flight goes with the next.
    this.sending = this.sending.then(() => this.send())
    return this.sending
  }

  private async send(): Promise<void> {
    const sent = { ...this.record.pending }
    if (!Object.keys(sent).length) return
    const entries = Object.fromEntries(Object.entries(sent).map(([key, at]) => {
      const value = this.options.values.read(key)
      return [key, { value: (value === undefined ? null : value) as ConsolePreferenceEntry['value'], at }]
    }))
    const outcome = await this.options.client.change(entries)
    if (!isOk(outcome)) {
      this.problem = { kind: outcome.kind, message: outcome.message }
      return
    }
    this.problem = null
    // Only what was sent, and not changed again since, stops being pending.
    for (const [key, at] of Object.entries(sent)) {
      if (this.record.pending[key] === at) delete this.record.pending[key]
    }
    this.apply(outcome.value, [])
  }

  /** The appliance's entries written into this browser where they are news; [alreadyChanged] joins the report. */
  private apply(doc: ConsolePreferences, alreadyChanged: string[]): void {
    const changed = Object.entries(doc.entries ?? {})
      .filter(([key]) => this.managed.has(key) && !this.isPending(key))
      .filter(([key, entry]) => {
        const news = this.record.applied[key] !== entry.at || !sameValue(this.options.values.read(key), entry.value)
        this.record.applied[key] = entry.at
        if (news && !sameValue(this.options.values.read(key), entry.value)) {
          this.options.values.write(key, entry.value ?? undefined)
          return true
        }
        return false
      })
      .map(([key]) => key)
    this.writeRecord()
    const all = [...new Set([...alreadyChanged, ...changed])].sort()
    if (all.length) this.listeners.forEach((listener) => listener(all))
  }

  private readRecord(): SyncRecord | null {
    try {
      const raw = this.options.storage.getItem(this.key)
      if (!raw) return null
      const parsed = JSON.parse(raw) as Partial<SyncRecord>
      return {
        applied: parsed.applied && typeof parsed.applied === 'object' ? parsed.applied : {},
        pending: parsed.pending && typeof parsed.pending === 'object' ? parsed.pending : {},
      }
    } catch {
      return null
    }
  }

  private writeRecord(): void {
    try {
      this.options.storage.setItem(this.key, JSON.stringify(this.record))
    } catch {
      // Storage refused: the settings still apply for this page, and the appliance keeps them.
    }
  }
}

function sameValue(a: unknown, b: unknown): boolean {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null)
}
