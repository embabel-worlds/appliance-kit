"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CronClient = void 0;
class CronClient {
    transport;
    constructor(transport) {
        this.transport = transport;
    }
    compileSchedule(schedule) {
        return this.transport.send({ method: 'POST', path: '/api/v1/cron/compile-schedule', body: { schedule }, timeoutMs: 60_000 });
    }
}
exports.CronClient = CronClient;
//# sourceMappingURL=cron.js.map