import assert from 'node:assert/strict'
import { describe as suite, it } from 'node:test'
import {
  TourRecorder,
  TourRun,
  TourFormatError,
  describe as synopsis,
  fitness,
  interpolate,
  parseTour,
  refusal,
  type Tour,
  type TourDictionary,
  type TourHost,
  type TourStep,
  type TourStepStatus,
  type WireTour,
} from '../src/tour/index.ts'

/*
 * The parts both front ends must agree on, or the same tour behaves differently in the console and
 * the Me app: what a step means, whether a surface can run it, what pause and stop do, and what a
 * user is told before any of it happens.
 */

const wire = (steps: Record<string, unknown>[], presentation: Record<string, unknown> = {}): WireTour => ({
  id: `f_${presentation.id ?? 'T'}`,
  declaredId: String(presentation.id ?? 'T'),
  userSaved: false,
  presentation: { name: 'A tour', ...presentation },
  steps: steps.map((presentation) => ({ presentation })),
})

const ME: TourDictionary = {
  surface: 'me',
  version: 1,
  panels: {
    documents: { fields: ['domain'], controls: ['populate'] },
    query: { fields: ['cypher'], controls: ['run'] },
  },
  states: ['ingest.idle'],
  dynamic: ['view', 'verb'],
}

/** A host that records what it was asked to do, and answers everything cheerfully. */
class FakeHost implements TourHost {
  readonly did: string[] = []
  readonly said: string[] = []
  answers: Record<string, string | undefined> = {}
  statuses: Record<number, TourStepStatus> = {}
  arrives = true
  holds = true
  handedOver = 0

  open(t: { text: string }) {
    this.did.push(`open ${t.text}`)
  }
  set(t: { text: string }, value: string) {
    this.did.push(`set ${t.text}=${value}`)
  }
  invoke(t: { text: string }) {
    this.did.push(`invoke ${t.text}`)
  }
  run(t: { text: string }, params: Record<string, string>) {
    this.did.push(`run ${t.text}(${JSON.stringify(params)})`)
  }
  async waitFor(t: { text: string }) {
    this.did.push(`wait ${t.text}`)
    return this.arrives
  }
  async check(t: { text: string }) {
    this.did.push(`check ${t.text}`)
    return this.holds
  }
  say(markdown: string) {
    this.said.push(markdown)
  }
  async ask(name: string) {
    this.did.push(`ask ${name}`)
    return name in this.answers ? this.answers[name] : `answer-for-${name}`
  }
  handedOverStep?: TourStep
  async handOver(step: TourStep) {
    this.handedOver += 1
    this.handedOverStep = step
    this.did.push(`handOver ${step.target?.text ?? step.verb}`)
    return true
  }
  seenParams: Record<string, string> = {}
  async stepStatus(index: number, params: Record<string, string>) {
    this.seenParams = params
    return this.statuses[index] ?? 'TODO'
  }
}

const run = (tour: Tour, host: TourHost, options = {}) => new TourRun(tour, { host, ...options })

suite('the vocabulary', () => {
  it('reads a step by the verb it names, and keeps the rest for the host', () => {
    const tour = parseTour(
      wire([{ invoke: 'button.populate', say: 'This is the slow part', badgeColour: 'amber' }]),
    )
    const step = tour.steps[0]!
    assert.equal(step.verb, 'invoke')
    assert.deepEqual(step.target, { kind: 'button', name: 'populate', text: 'button.populate' })
    assert.equal(step.say, 'This is the slow part')
    assert.equal(step.raw.badgeColour, 'amber')
  })

  it('refuses a step with no verb, rather than skipping it quietly', () => {
    // A quiet skip turns a typo into a tour that runs to the end having done less than it said.
    assert.throws(() => parseTour(wire([{ opne: 'panel.query' }])), TourFormatError)
  })

  it('refuses a target that is not kind.name', () => {
    assert.throws(() => parseTour(wire([{ open: 'documents' }])), /kind\.name/)
  })

  it('refuses a set with nothing to set it to', () => {
    assert.throws(() => parseTour(wire([{ set: 'field.domain' }])), /needs a 'to:'/)
  })

  it('reads durations the way a human writes them', () => {
    const tour = parseTour(wire([{ wait: 'state.ingest.idle', timeout: '10m' }]))
    assert.equal(tour.steps[0]!.timeoutMs, 600_000)
  })

  it('names a step number when a step will not parse, because that is what the author needs', () => {
    assert.throws(() => parseTour(wire([{ say: 'fine' }, { nonsense: true }])), /step 2/)
  })
})

suite('what a surface can run', () => {
  it('checks the STEPS, not only what the file remembered to declare', () => {
    // An author who forgets `requires:` must not thereby get a tour that dies halfway.
    const tour = parseTour(wire([{ open: 'panel.nowhere' }]))
    assert.deepEqual(
      fitness(tour, ME).missing.map((t) => t.text),
      ['panel.nowhere'],
    )
  })

  it('defers the kinds whose names are data rather than layout', () => {
    // Views arrive with realms and change while the app runs; they cannot be declared up front.
    const tour = parseTour(wire([{ run: 'view.EsgCoverage' }]))
    const verdict = fitness(tour, ME)
    assert.equal(verdict.ok, true)
    assert.deepEqual(
      verdict.deferred.map((t) => t.text),
      ['view.EsgCoverage'],
    )
  })

  it('refuses the whole tour up front, naming exactly what is missing', () => {
    const tour = parseTour(wire([{ open: 'panel.documents' }, { invoke: 'button.nope' }]))
    assert.match(refusal(tour, ME), /button\.nope/)
    assert.match(refusal(tour, ME), /me/)
  })

  it('says nothing when the tour fits', () => {
    assert.equal(refusal(parseTour(wire([{ open: 'panel.query' }])), ME), '')
  })
})

suite('what the user is told before consenting', () => {
  it('derives the synopsis from the file, never from what its author claims', () => {
    const tour = parseTour(
      wire(
        [
          { say: 'ESG reports are PDFs nobody reads.' },
          { open: 'panel.documents' },
          { set: 'field.domain', to: '{{ domain }}' },
          { invoke: 'button.populate' },
          { run: 'view.EsgCoverage' },
          { open: 'panel.query', by: 'user', hint: 'It is in the sidebar' },
        ],
        { name: 'ESG, first look', params: { domain: { ask: 'Whose disclosures?' } } },
      ),
    )
    const s = synopsis(tour, ME)

    assert.equal(s.title, 'ESG, first look')
    const text = s.lines.join('\n')
    assert.match(text, /Will ask you for domain/)
    assert.match(text, /Opens documents and query/)
    assert.match(text, /Fills in domain/)
    assert.match(text, /Presses populate/)
    assert.match(text, /Runs EsgCoverage/)
    assert.match(text, /1 step is yours to do/)
    // The two constants, stated every time rather than inferred from the absence of alarm.
    assert.match(text, /runs no code of its own/)
    assert.match(text, /Pause or stop at any step/)
  })

  it('says so when this surface cannot run it', () => {
    const s = synopsis(parseTour(wire([{ open: 'panel.nowhere' }])), ME)
    assert.match(s.blocked ?? '', /panel\.nowhere/)
  })
})

suite('running one', () => {
  it('performs each step in order, substituting collected parameters', async () => {
    const tour = parseTour(
      wire(
        [
          { open: 'panel.documents' },
          { set: 'field.domain', to: '{{ domain }}' },
          { invoke: 'button.populate' },
          { run: 'view.EsgExtract', with: { domain: '{{ domain }}' } },
        ],
        { params: { domain: { ask: 'Whose?' } } },
      ),
    )
    const host = new FakeHost()
    host.answers = { domain: 'acme.com' }

    const end = await run(tour, host).start()

    assert.equal(end.state, 'done')
    assert.deepEqual(host.did, [
      'ask domain',
      'open panel.documents',
      'set field.domain=acme.com',
      'invoke button.populate',
      'run view.EsgExtract({"domain":"acme.com"})',
    ])
  })

  it('SKIPS a step the appliance says is already satisfied', async () => {
    // The whole reason a tour can be left and come back to: work already done is not redone.
    const tour = parseTour(wire([{ invoke: 'button.populate' }, { run: 'view.EsgCoverage' }]))
    const host = new FakeHost()
    host.statuses = { 0: 'DONE' }

    const end = await run(tour, host).start()

    assert.deepEqual(host.did, ['run view.EsgCoverage({})'])
    assert.equal(end.skipped, 1)
  })

  it('hands the collected parameters to the precondition', async () => {
    // Without them the only expressible conditions are those that depend on no answer — which
    // excludes every expensive step a tour most wants to skip. Found live: a `doneWhen` naming
    // $domain came back "Expected parameter(s): domain" and the guard never fired.
    const tour = parseTour(
      wire([{ invoke: 'button.populate' }], { params: { domain: { ask: 'Whose?' } } }),
    )
    const host = new FakeHost()
    host.answers = { domain: 'acme.com' }

    await run(tour, host).start()

    assert.deepEqual(host.seenParams, { domain: 'acme.com' })
  })

  it('runs a step whose precondition could not be answered', async () => {
    // The fail-soft direction. Repeating a step is visible and recoverable; silently skipping one
    // means the user never learns what they missed.
    const tour = parseTour(wire([{ invoke: 'button.populate' }]))
    const host = new FakeHost()
    host.statuses = { 0: 'UNKNOWN' }

    await run(tour, host).start()

    assert.deepEqual(host.did, ['invoke button.populate'])
  })

  it('hands a `by: user` step over and waits, rather than performing it', async () => {
    const tour = parseTour(wire([{ open: 'panel.query', by: 'user', hint: 'It is in the sidebar' }]))
    const host = new FakeHost()

    await run(tour, host).start()

    assert.equal(host.handedOver, 1)
    assert.deepEqual(host.did, ['handOver panel.query'])
  })

  it('does NOT narrate the hint — it belongs beside the buttons that act on it', async () => {
    // Narrating it first made the hand-over a two-stage prompt: read the instruction, press Next,
    // and only then get the Done/Skip that acts on it. The host gets the step, hint and all.
    const tour = parseTour(wire([{ open: 'panel.query', by: 'user', hint: 'It is in the sidebar' }]))
    const host = new FakeHost()

    await run(tour, host).start()

    assert.deepEqual(host.said, [], 'the hint is the hand-over prompt, not a caption before it')
    assert.equal(host.handedOverStep?.hint, 'It is in the sidebar')
  })

  it('stops on an unmet expectation, saying the author’s own sentence', async () => {
    const tour = parseTour(wire([{ expect: 'state.ingest.idle', else: 'Nothing landed for that domain.' }]))
    const host = new FakeHost()
    host.holds = false

    const end = await run(tour, host).start()

    assert.equal(end.state, 'stopped')
    assert.deepEqual(host.said, ['Nothing landed for that domain.'])
  })

  it('stops rather than crashing when a wait times out', async () => {
    const tour = parseTour(wire([{ wait: 'state.ingest.idle', timeout: '1s' }, { open: 'panel.query' }]))
    const host = new FakeHost()
    host.arrives = false

    const end = await run(tour, host).start()

    assert.equal(end.state, 'stopped')
    assert.ok(!host.did.includes('open panel.query'), 'the tour must not walk past a wait it gave up on')
  })

  it('ends when the user declines to answer', async () => {
    const tour = parseTour(wire([{ open: 'panel.query' }], { params: { domain: { ask: 'Whose?' } } }))
    const host = new FakeHost()
    host.answers = { domain: undefined }

    const end = await run(tour, host).start()

    assert.equal(end.state, 'stopped')
    assert.deepEqual(host.did, ['ask domain'])
  })

  it('pauses BETWEEN steps and resumes where it stopped', async () => {
    const tour = parseTour(wire([{ open: 'panel.documents' }, { open: 'panel.query' }]))
    const host = new FakeHost()
    const running = run(tour, host)
    // Pause the moment the first step has been performed.
    const originalOpen = host.open.bind(host)
    host.open = (t: { text: string }) => {
      originalOpen(t)
      running.pause()
    }

    const finished = running.start()
    await new Promise((r) => setTimeout(r, 10))

    assert.equal(running.state, 'paused')
    assert.deepEqual(host.did, ['open panel.documents'], 'a pause must not land mid-step')

    running.resume()
    const end = await finished
    assert.equal(end.state, 'done')
    assert.deepEqual(host.did, ['open panel.documents', 'open panel.query'])
  })

  it('stops for good when asked, and does not run the rest', async () => {
    const tour = parseTour(wire([{ open: 'panel.documents' }, { open: 'panel.query' }]))
    const host = new FakeHost()
    const running = run(tour, host)
    const originalOpen = host.open.bind(host)
    host.open = (t: { text: string }) => {
      originalOpen(t)
      running.stop()
    }

    const end = await running.start()

    assert.equal(end.state, 'stopped')
    assert.deepEqual(host.did, ['open panel.documents'])
  })

  it('goes BACK a step, and re-runs it even if its precondition says it is done', async () => {
    // Somebody pressing Back is asking to see the step again; a doneWhen that skipped them
    // forward again would make the button look broken.
    const tour = parseTour(wire([{ open: 'panel.documents' }, { open: 'panel.query' }]))
    const host = new FakeHost()
    host.statuses = { 0: 'DONE' }
    const running = run(tour, host)
    const originalOpen = host.open.bind(host)
    let went = false
    host.open = (t: { text: string }) => {
      originalOpen(t)
      // Step back once, the first time we reach the second panel.
      if (t.text === 'panel.query' && !went) { went = true; running.back() }
    }

    const end = await running.start()

    assert.equal(end.state, 'done')
    assert.deepEqual(host.did, [
      'open panel.query',      // step 0 was skipped as DONE, so we land on step 1
      'open panel.documents',  // Back — and it RUNS despite reporting DONE
      'open panel.query',      // forward again
    ])
  })

  it('will not step back from the first step', async () => {
    const tour = parseTour(wire([{ open: 'panel.documents' }]))
    const host = new FakeHost()
    const running = run(tour, host)
    running.back()
    const end = await running.start()
    assert.equal(end.state, 'done')
    assert.deepEqual(host.did, ['open panel.documents'])
  })

  it('can start partway in, with what was already collected', async () => {
    const tour = parseTour(
      wire([{ open: 'panel.documents' }, { set: 'field.domain', to: '{{ domain }}' }], {
        params: { domain: { ask: 'Whose?' } },
      }),
    )
    const host = new FakeHost()

    await run(tour, host, { from: 1, params: { domain: 'acme.com' } }).start()

    assert.deepEqual(host.did, ['set field.domain=acme.com'], 'neither re-asked nor re-opened')
  })
})

suite('interpolation', () => {
  it('replaces what it knows and leaves what it does not', () => {
    assert.equal(interpolate('{{ a }} and {{ b }}', { a: 'one' }), 'one and {{ b }}')
  })
})

suite('recording', () => {
  it('coalesces typing into one step, because a draft with forty is not editable', () => {
    const recorder = new TourRecorder()
    recorder.observe({ verb: 'open', target: 'panel.documents' })
    recorder.observe({ verb: 'set', target: 'field.domain', value: 'a' })
    recorder.observe({ verb: 'set', target: 'field.domain', value: 'ac' })
    recorder.observe({ verb: 'set', target: 'field.domain', value: 'acme.com' })
    recorder.observe({ verb: 'invoke', target: 'button.populate' })

    assert.equal(recorder.actions.length, 3)
    assert.equal(recorder.actions[1]!.value, 'acme.com')
  })

  it('writes a file that says it is a draft, and marks what a recorder cannot know', () => {
    // Narration and preconditions are the two things that make a tour worth running, and neither
    // can be observed from a click. Saying so in the file is the honest alternative to pretending.
    const recorder = new TourRecorder()
    recorder.observe({ verb: 'invoke', target: 'button.populate' })
    const yaml = recorder.toYaml({ id: 'Recorded', name: 'Recorded walk' })

    assert.match(yaml, /RECORDED, AND THEREFORE A DRAFT/)
    assert.match(yaml, /doneWhen: "TODO/)
    assert.match(yaml, /say: "TODO/)
  })

  it('round-trips: what it writes is a tour this kit can read back', () => {
    const recorder = new TourRecorder()
    recorder.narrate('Here is why this matters.')
    recorder.observe({ verb: 'open', target: 'panel.documents' })
    recorder.observe({ verb: 'set', target: 'field.domain', value: 'acme.com' })

    const draft = recorder.draft({ id: 'Recorded', name: 'Recorded walk' })
    const steps = (draft.steps as Record<string, unknown>[]).map((presentation) => ({ presentation }))
    const tour = parseTour({ id: 'f_Recorded', declaredId: 'Recorded', userSaved: true, presentation: draft, steps })

    assert.deepEqual(
      tour.steps.map((s) => s.verb),
      ['say', 'open', 'set'],
    )
    assert.equal(tour.steps[2]!.value, 'acme.com')
    assert.equal(fitness(tour, ME).ok, true)
  })
})
