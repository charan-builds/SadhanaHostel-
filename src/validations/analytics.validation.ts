import { z } from "zod"

import { isoDateSchema } from "./common.validation"

export const dashboardAnalyticsSchema = z.object({
  organizationId: z.uuid(),
  hostelId: z.uuid().optional(),
})

export const advancedAnalyticsSchema = dashboardAnalyticsSchema.extend({
  fromDate: isoDateSchema.optional(),
  toDate: isoDateSchema.optional(),
})
