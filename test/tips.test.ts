import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { HintsClient, type Hint } from '../src/client/hints.ts'
import { ok, failure, type Outcome } from '../src/client/outcome.ts'
import type { RequestSpec, Transport } from '../src/client/transport.ts'
import { TipRotation } from '../src/tips/index.ts'

/*
 * Same posture as handlers.test.ts for the client half — the RequestSpec IS the contract the
 * Me bridge forwards — plus the rotation's seen-set behaviour, which is the part both consoles
 * must agree on or the same tip repeats on one surface and not the other.
 */

class RecordingTransport implements Transport {
  readonly sent: RequestSpec[] = []
  constructor(private readonly replies: unknown[] = [{}]) {}
  async send<T>(spec: RequestSpec): Promise<Outcome<T>> {
    this.sent.push(spec)
    const reply = this.replies.length > 1 ? this.replies.shift() : this.replies[0]
    return ok(reply as T)
  }
  get last(): RequestSpec {
    const spec = this.sent.at(-1)
    assert.ok(spec, 'nothing was sent')
    return spec
  }
}

const hint = (id: string): Hint =>
  ({ id, category: 'hint', title: id, body: 'b' }) as Hint

class MemoryStorage {
  private readonly map = new Map<string, string>()
  getItem(k: string): string | null {
    return this.map.get(k) ?? null
  }
  setItem(k: string, v: string): void {
    this.map.set(k, v)
  }
}

describe('HintsClient', () => {
  it('all() is GET /api/v1/hints with the surface it was given', async () => {
    const transport = new RecordingTransport([[]])
    await new HintsClient(transport).all('console')
    assert.equal(transport.last.method, 'GET')
    assert.equal(transport.last.path, '/api/v1/hints')
    assert.deepEqual(transport.last.query, { surface: 'console' })
  })

  it('random() joins the exclusions and omits empty params', async () => {
    const transport = new RecordingTransport([hint('a')])
    await new HintsClient(transport).random(['x', 'y'], 'me')
    assert.deepEqual(transport.last.query, { exclude: 'x,y', surface: 'me' })
    await new HintsClient(transport).random()
    assert.deepEqual(transport.last.query, {})
  })
})

describe('TipRotation', () => {
  it('sends the seen ids as the exclusion list on the next call', async () => {
    const transport = new RecordingTransport([hint('a'), hint('b')])
    const storage = new MemoryStorage()
    const rotation = new TipRotation({ hints: new HintsClient(transport), surface: 'me', storage })
    await rotation.next()
    await rotation.next()
    assert.equal(transport.last.query?.exclude, 'a')
    assert.equal(transport.last.query?.surface, 'me')
    // A second rotation over the SAME storage starts already knowing both.
    const transport2 = new RecordingTransport([hint('c')])
    await new TipRotation({ hints: new HintsClient(transport2), surface: 'me', storage }).next()
    assert.equal(transport2.last.query?.exclude, 'a,b')
  })

  it('a failed call or an exhausted pool yields undefined, never an error', async () => {
    const failing: Transport = {
      async send<T>(): Promise<Outcome<T>> {
        return failure('failed', 'boom', 500)
      },
    }
    const rotation = new TipRotation({ hints: new HintsClient(failing), surface: 'me', storage: new MemoryStorage() })
    assert.equal(await rotation.next(), undefined)
    const empty = new RecordingTransport([undefined])
    const rotation2 = new TipRotation({ hints: new HintsClient(empty), surface: 'me', storage: new MemoryStorage() })
    assert.equal(await rotation2.next(), undefined)
  })
})
