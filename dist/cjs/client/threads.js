"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ThreadsClient = void 0;
const THREADS = '/api/v1/threads';
class ThreadsClient {
    transport;
    constructor(transport) {
        this.transport = transport;
    }
    async list() {
        const listed = await this.transport.send({ method: 'GET', path: THREADS });
        return listed.ok ? { ok: true, value: listed.value.threads } : listed;
    }
    get(id) {
        return this.transport.send({ method: 'GET', path: `${THREADS}/${encodeURIComponent(id)}` });
    }
    create(title) {
        return this.transport.send({ method: 'POST', path: THREADS, body: { title } });
    }
    /** Post in a thread. Every agent the text @mentions answers in it, in the background. */
    post(id, text, attachments = []) {
        return this.transport.send({ method: 'POST', path: `${THREADS}/${encodeURIComponent(id)}/messages`, body: { text, attachments } });
    }
}
exports.ThreadsClient = ThreadsClient;
//# sourceMappingURL=threads.js.map