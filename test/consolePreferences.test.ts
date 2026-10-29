import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  ConsolePreferencesClient,
  PreferenceSync,
  type ConsolePreferenceEntry,
  type ConsolePreferences,
  type PreferenceStorage,
} from '../src/client/index.ts'
import { failure, ok, type Outcome } from '../src/client/outcome.ts'
import type { RequestSpec, Transport } from '../src/client/transport.ts'

/*
 * The browser's half of console preferences: values stay where the front end keeps them, changes go
 * up after a pause, the appliance's answer comes back down, and the last change wins setting by
 * setting. The fake appliance below merges exactly as the server does (an entry replaces the stored
 * one unless it is older), so two syncs over it behave like two browsers over one appliance.
 */

class FakeAppliance {
  doc: ConsolePreferences = { schema: 1, version: 0, entries: {} }
  up = true
  puts = 0

  client(): Pick<ConsolePreferencesClient, 'get' | 'change'> {
    return {
      get: async (): Promise<Outcome<ConsolePreferences>> =>
        this.up ? ok(structuredClone(this.doc)) : failure('unreachable', 'down'),
      change: async (entries: Record<string, ConsolePreferenceEntry>): Promise<Outcome<ConsolePreferences>> => {
        if (!this.up) return failure('unreachable', 'down')
        this.puts++
        const accepted = Object.entries(entries).filter(([key, e]) => !this.doc.entries[key] || e.at >= this.doc.entries[key].at)
        if (accepted.length) {
          this.doc = { ...this.doc, version: this.doc.version + 1, entries: { ...this.doc.entries, ...Object.fromEntries(accepted) } }
        }
        return ok(structuredClone(this.doc))
      },
    }
  }
}

class MapStorage implements PreferenceStorage {
  readonly map = new Map<string, string>()
  getItem(key: string) { return this.map.get(key) ?? null }
  setItem(key: string, value: string) { this.map.set(key, value) }
  removeItem(key: string) { this.map.delete(key) }
}

/** One browser: its own storage, holding the values under their own keys, as the console does. */
function browser(appliance: FakeAppliance, user = 'rod', clock = { t: 1000 }, storage = new MapStorage()) {
  const timers: (() => void)[] = []
  const values = {
    read: (key: string) => storage.getItem(key) ?? undefined,
    write: (key: string, value: unknown) => (value === undefined || value === null ? storage.removeItem(key) : storage.setItem(key, String(value))),
  }
  const sync = new PreferenceSync({
    client: appliance.client(),
    keys: ['theme', 'pins', 'layout'],
    values,
    storage,
    user,
    now: () => clock.t,
    setTimer: (run) => { timers.push(run); return timers.length },
    clearTimer: () => { timers.length = 0 },
  })
  const heard: string[][] = []
  sync.subscribe((keys) => heard.push(keys))
  /** The console writes its value as it always did, then tells the sync. */
  const choose = (key: string, value: string) => { storage.setItem(key, value); sync.changed(key) }
  const tick = async () => { timers.splice(0).forEach((run) => run()); await sync.flush() }
  return { sync, storage, values, choose, tick, heard, timers }
}

describe('console preferences', () => {
  it('the client reads and merges at /api/v1/profile/console', async () => {
    const sent: RequestSpec[] = []
    const transport: Transport = { send: async <T>(spec: RequestSpec) => { sent.push(spec); return ok({} as T) } }
    const client = new ConsolePreferencesClient(transport)
    await client.get()
    await client.change({ theme: { value: 'midnight', at: 5 } })
    assert.deepEqual(sent.map((s) => [s.method, s.path]), [['GET', '/api/v1/profile/console'], ['PUT', '/api/v1/profile/console']])
    assert.deepEqual(sent[1]?.body, { entries: { theme: { value: 'midnight', at: 5 } } })
  })

  it('a change is sent after the pause, once, however often it was made', async () => {
    const appliance = new FakeAppliance()
    const a = browser(appliance)
    await a.sync.load()
    a.choose('layout', '{"x":1}')
    a.choose('layout', '{"x":2}')
    a.choose('layout', '{"x":3}')
    assert.equal(appliance.puts, 0, 'nothing is sent before the pause')
    await a.tick()
    assert.equal(appliance.puts, 1)
    assert.equal(appliance.doc.entries.layout?.value, '{"x":3}')
    assert.equal(a.sync.isPending('layout'), false)
  })

  it('a second browser opens with what the first chose', async () => {
    const appliance = new FakeAppliance()
    const first = browser(appliance)
    await first.sync.load()
    first.choose('theme', 'midnight')
    first.choose('pins', '[{"id":"x"}]')
    await first.tick()

    const second = browser(appliance)
    assert.equal(second.storage.getItem('theme'), null, 'a new browser starts with nothing')
    await second.sync.load()
    assert.equal(second.storage.getItem('theme'), 'midnight')
    assert.equal(second.storage.getItem('pins'), '[{"id":"x"}]')
    assert.deepEqual(second.heard, [['pins', 'theme']], 'listeners hear what changed, so the console can repaint')
  })

  it('the last change wins, setting by setting, whichever browser sends first', async () => {
    const appliance = new FakeAppliance()
    const clock = { t: 1000 }
    const a = browser(appliance, 'rod', clock)
    const b = browser(appliance, 'rod', clock)
    await a.sync.load()
    await b.sync.load()
    a.choose('theme', 'ember') // at 1000
    clock.t = 2000
    b.choose('theme', 'aurora') // at 2000, newer
    b.choose('layout', 'b-layout')
    await b.tick()
    await a.tick() // older, sent later: refused by the appliance, and a takes the newer value
    assert.equal(appliance.doc.entries.theme?.value, 'aurora')
    assert.equal(a.storage.getItem('theme'), 'aurora')
    assert.equal(a.storage.getItem('layout'), 'b-layout')
  })

  it('offline, a change stays pending and goes with the next load', async () => {
    const appliance = new FakeAppliance()
    const a = browser(appliance)
    await a.sync.load()
    appliance.up = false
    a.choose('theme', 'neon')
    await a.tick()
    assert.equal(a.sync.isPending('theme'), true)
    assert.equal(a.sync.problem?.kind, 'unreachable')
    assert.equal(a.storage.getItem('theme'), 'neon', 'the browser keeps showing what was chosen')

    appliance.up = true
    // A reload: a new sync over the same storage picks up what was pending.
    const again = browser(appliance, 'rod', { t: 5000 }, a.storage)
    await again.sync.load()
    assert.equal(appliance.doc.entries.theme?.value, 'neon')
    assert.equal(again.sync.isPending('theme'), false)
  })

  it('migration adopts what this browser held before the appliance kept it, once', async () => {
    const appliance = new FakeAppliance()
    const storage = new MapStorage()
    storage.setItem('theme', 'slate')
    storage.setItem('pins', '[1]')
    const a = browser(appliance, 'rod', { t: 1000 }, storage)
    assert.equal(a.sync.firstSync, true)
    await a.sync.load({ adoptLocal: true })
    assert.equal(appliance.doc.entries.theme?.value, 'slate')
    assert.equal(appliance.doc.entries.pins?.value, '[1]')
    assert.equal(browser(appliance, 'rod', { t: 1000 }, storage).sync.firstSync, false)
  })

  it('what the appliance already holds beats an unsent value from before', async () => {
    const appliance = new FakeAppliance()
    appliance.doc.entries.theme = { value: 'midnight', at: 10 }
    const storage = new MapStorage()
    storage.setItem('theme', 'slate')
    const a = browser(appliance, 'rod', { t: 1000 }, storage)
    await a.sync.load({ adoptLocal: true })
    assert.equal(storage.getItem('theme'), 'midnight')
    assert.equal(appliance.doc.entries.theme?.value, 'midnight')
  })

  it("another user in the same browser sees their own settings, not the last user's", async () => {
    const rods = new FakeAppliance()
    rods.doc.entries.theme = { value: 'midnight', at: 10 }
    const storage = new MapStorage()
    const rod = browser(rods, 'rod', { t: 1000 }, storage)
    await rod.sync.load()
    rod.choose('pins', '[1]')
    await rod.tick()

    const anns = new FakeAppliance()
    const ann = browser(anns, 'ann', { t: 2000 }, storage)
    await ann.sync.load()
    assert.equal(storage.getItem('theme'), null, "rod's theme is cleared, not inherited")
    assert.equal(storage.getItem('pins'), null)
    assert.equal(anns.puts, 0, "nothing of rod's is sent as ann's")
    assert.deepEqual(ann.heard, [['pins', 'theme']])
  })

  it('a key the front end does not keep in step is left alone', async () => {
    const appliance = new FakeAppliance()
    appliance.doc.entries.other = { value: 'x', at: 1 }
    const a = browser(appliance)
    await a.sync.load()
    a.storage.setItem('unmanaged', 'y')
    a.sync.changed('unmanaged')
    await a.tick()
    assert.equal(appliance.puts, 0)
    assert.equal(a.storage.getItem('other'), null)
  })
})
