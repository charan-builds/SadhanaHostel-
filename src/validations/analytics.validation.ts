import { z } from "zod"

export const dashboardAnalyticsSchema = z.object({
  organizationId: z.uuid(),
  hostelId: z.uuid().optional(),
})
