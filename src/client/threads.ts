import type { Outcome } from './outcome.ts'
import type { Transport } from './transport.ts'

/*
 * THREADS: conversations a person and their agents share (embabel/me#1779). A person posts and
 * @mentions agents; each answers in the thread as itself, and agents asking each other land here
 * too, so what colleagues say to each other is always readable.
 *
 * Hand-typed for the reason agents.ts gives: newer than the published Worlds API document.
 */

export type SenderKind = 'PERSON' | 'AGENT' | 'APPLIANCE'

export interface Sender {
  kind: SenderKind
  name: string
}

export type AttachmentKind = 'ENTITY' | 'VIEW' | 'REQUEST'

/** A typed thing from the world on a message: the payload, as the words are the envelope. */
export interface Attachment {
  kind: AttachmentKind
  /** The entity's label, the view's name, or `request`. */
  label: string
  id: string | null
  title: string
  properties: Record<string, unknown>
  rows: Record<string, unknown>[]
  args: Record<string, unknown>
  capturedAt: string | null
}

export interface ThreadMessage {
  id: string
  threadId: string
  from: Sender
  text: string
  attachments: Attachment[]
  mentions: string[]
  inReplyTo: string | null
  /** True on an agent's answer to a message that carried no attachment. */
  wordsOnly: boolean
  createdAt: string
}

export interface Thread {
  id: string
  ownerId: string
  title: string
  createdAt: string
  updatedAt: string
}

/** A thread, its messages, and the agents still answering. */
export interface ThreadView {
  thread: Thread
  messages: ThreadMessage[]
  waitingOn: string[]
}

/** What a person attaches: a record as they see it, a view to run and freeze now, or a request. */
export interface AttachmentRequest {
  kind: AttachmentKind
  label?: string
  id?: string
  title?: string
  properties?: Record<string, unknown>
  args?: Record<string, unknown>
}

const THREADS = '/api/v1/threads'

export class ThreadsClient {
  constructor(private readonly transport: Transport) {}

  async list(): Promise<Outcome<Thread[]>> {
    const listed = await this.transport.send<{ threads: Thread[] }>({ method: 'GET', path: THREADS })
    return listed.ok ? { ok: true, value: listed.value.threads } : listed
  }

  get(id: string): Promise<Outcome<ThreadView>> {
    return this.transport.send({ method: 'GET', path: `${THREADS}/${encodeURIComponent(id)}` })
  }

  create(title: string): Promise<Outcome<Thread>> {
    return this.transport.send({ method: 'POST', path: THREADS, body: { title } })
  }

  /** Post in a thread. Every agent the text @mentions answers in it, in the background. */
  post(id: string, text: string, attachments: AttachmentRequest[] = []): Promise<Outcome<ThreadMessage>> {
    return this.transport.send({ method: 'POST', path: `${THREADS}/${encodeURIComponent(id)}/messages`, body: { text, attachments } })
  }
}
