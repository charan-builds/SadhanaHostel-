import { z } from "zod"

export const runJobSchema = z.object({
  name: z.enum([
    "monthly_fee_generation",
    "payment_reminder",
    "leave_notification",
    "stale_upload_cleanup",
    "invoice_cleanup",
    "scheduled_notices",
    "reservation_expiry",
    "resident_invite_expiry",
    "admission_follow_up",
    "inactive_inquiry_cleanup",
    "occupancy_recalculation",
    "consistency_validation",
    "onboarding_aging",
    "checkout_reconciliation",
  ]),
  organizationId: z.uuid(),
  payload: z.record(z.string(), z.unknown()),
})
