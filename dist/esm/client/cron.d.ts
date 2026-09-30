import type { Outcome } from './outcome.ts';
import type { Transport } from './transport.ts';
export interface CompiledSchedule {
    /** The six-field cron, when the words were a schedule. */
    cron?: string | null;
    /** Why the words were not a schedule, in the appliance's words. */
    error?: string | null;
}
export declare class CronClient {
    private readonly transport;
    constructor(transport: Transport);
    compileSchedule(schedule: string): Promise<Outcome<CompiledSchedule>>;
}
//# sourceMappingURL=cron.d.ts.map