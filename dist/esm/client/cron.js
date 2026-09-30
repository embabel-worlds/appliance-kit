export class CronClient {
    transport;
    constructor(transport) {
        this.transport = transport;
    }
    compileSchedule(schedule) {
        return this.transport.send({ method: 'POST', path: '/api/v1/cron/compile-schedule', body: { schedule }, timeoutMs: 60_000 });
    }
}
//# sourceMappingURL=cron.js.map