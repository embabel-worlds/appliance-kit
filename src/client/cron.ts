import type { Outcome } from './outcome.ts'
import type { Transport } from './transport.ts'

/*
 * SCHEDULES IN WORDS. The appliance turns "every weekday at 8" into a Spring six-field cron with a
 * model call, so a person never has to know that the hour is the third field. A description that is
 * not a schedule comes back as a 200 carrying `error` rather than `cron`: it is an answer about the
 * words, not a failure of the call, and a surface shows it as such.
 *
 * Hand-typed, like `agents.ts`, until the Worlds API document guards the cron surface.
 */

export interface CompiledSchedule {
  /** The six-field cron, when the words were a schedule. */
  cron?: string | null
  /** Why the words were not a schedule, in the appliance's words. */
  error?: string | null
}

export class CronClient {
  constructor(private readonly transport: Transport) {}

  compileSchedule(schedule: string): Promise<Outcome<CompiledSchedule>> {
    return this.transport.send({ method: 'POST', path: '/api/v1/cron/compile-schedule', body: { schedule }, timeoutMs: 60_000 })
  }
}
