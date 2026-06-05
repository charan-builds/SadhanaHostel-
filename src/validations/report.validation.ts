import { z } from "zod"

import { isoDateSchema, uuidSchema } from "./common.validation"

export const reportTypeSchema = z.enum([
  "payments",
  "monthly_fees",
  "invoices",
  "residents",
  "leaves",
])

export const reportFormatSchema = z.enum(["csv", "xlsx"]).default("csv")

export const reportRequestSchema = z.object({
  organizationId: uuidSchema,
  hostelId: uuidSchema.optional(),
  fromDate: isoDateSchema.optional(),
  toDate: isoDateSchema.optional(),
  dateBasis: z.enum(["revenue", "activity"]).default("revenue"),
  format: reportFormatSchema,
  maxRows: z.coerce.number().int().positive().max(50_000).default(10_000),
})

export type ReportType = z.infer<typeof reportTypeSchema>
export type ParsedReportRequest = z.infer<typeof reportRequestSchema>
export type ReportRequestInput = Omit<
  ParsedReportRequest,
  "dateBasis" | "format" | "maxRows"
> &
  Partial<Pick<ParsedReportRequest, "dateBasis" | "format" | "maxRows">>
