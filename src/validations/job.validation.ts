import { z } from "zod"

export const runJobSchema = z.object({
  name: z.enum([
    "monthly_fee_generation",
    "payment_reminder",
    "leave_notification",
    "stale_upload_cleanup",
    "invoice_cleanup",
    "scheduled_notices",
  ]),
  organizationId: z.uuid(),
  payload: z.record(z.string(), z.unknown()),
})
