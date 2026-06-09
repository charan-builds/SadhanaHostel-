import type { Json } from "@/types/database"

export const DEFAULT_LEAVE_REVIEW_NOTICE =
  "Leave requests are usually reviewed within 1–2 days. Please submit your request as early as possible."

export type LeaveManagementSettings = {
  whatsappSupportNumber: string
  reviewNotice: string
  urgentWhatsappEscalationEnabled: boolean
}

export function readLeaveManagementSettings(settings: unknown): LeaveManagementSettings {
  const root = recordFromUnknown(settings)
  const leaveManagement = recordFromUnknown(root.leaveManagement)
  const operationalControls = recordFromUnknown(root.operationalControls)
  const support = recordFromUnknown(operationalControls.support)

  return {
    whatsappSupportNumber:
      stringFromRecord(leaveManagement, "whatsappSupportNumber") ??
      stringFromRecord(support, "whatsapp") ??
      "",
    reviewNotice:
      stringFromRecord(leaveManagement, "reviewNotice") ??
      DEFAULT_LEAVE_REVIEW_NOTICE,
    urgentWhatsappEscalationEnabled: booleanFromRecord(
      leaveManagement,
      "urgentWhatsappEscalationEnabled",
      true
    ),
  }
}

export function buildUrgentLeaveWhatsappMessage(input: {
  studentName?: string | null
  mobileNumber?: string | null
}) {
  return [
    "Hello, I have submitted an urgent leave request and would appreciate faster review.",
    "",
    `Student Name: ${input.studentName?.trim() ?? ""}`,
    `Mobile Number: ${input.mobileNumber?.trim() ?? ""}`,
  ].join("\n")
}

export function createLeaveRequestMetadata(input: {
  fullName: string
  mobileNumber: string
  whatsappNumber: string
}) {
  return {
    workflow: "simplified_leave_request",
    submittedStudentName: input.fullName,
    submittedMobileNumber: input.mobileNumber,
    submittedWhatsappNumber: input.whatsappNumber,
  } satisfies Json
}

function recordFromUnknown(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function stringFromRecord(record: Record<string, unknown>, key: string) {
  const value = record[key]

  return typeof value === "string" && value.trim() ? value.trim() : undefined
}

function booleanFromRecord(
  record: Record<string, unknown>,
  key: string,
  fallback: boolean
) {
  const value = record[key]

  return typeof value === "boolean" ? value : fallback
}
