import { readFileSync } from "node:fs"
import path from "node:path"

import { describe, expect, it } from "vitest"

function source(relativePath: string) {
  return readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

describe("payment reminder smart scheduling contract", () => {
  it("runs the daily reminder job against a seven-day lookahead window", () => {
    const registry = source("src/jobs/scheduler/cron-registry.ts")

    expect(registry).toMatch(/dueBeforeDate:\s*toDateOnly\(addDays\(now,\s*7\)\)/)
    expect(registry).toMatch(/runDate:\s*toDateOnly\(now\)/)
  })

  it("classifies exact due windows and deduplicates reminders per run date", () => {
    const job = source("src/jobs/payment-reminder.job.ts")

    expect(job).toMatch(/paymentDueTemplateForDays\(daysUntilDue\)/)
    expect(job).toMatch(/\[0,\s*1,\s*3,\s*7\]\.includes\(daysUntilDue\)/)
    expect(job).toMatch(/weekly_collection_reminder/)
    expect(job).toMatch(/findByTemplateRecipientPayload/)
    expect(job).toMatch(/reminder_date:\s*runDate/)
  })
})
