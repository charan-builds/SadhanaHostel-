"use client"

import { useQuery } from "@tanstack/react-query"

import { auditSdk } from "@/sdk"
import type { AuditCategory, AuditListInput } from "@/validations/audit.validation"

export function useAuditLogs(
  category: AuditCategory,
  params: AuditListInput | undefined
) {
  return useQuery({
    queryKey: ["audit", category, params],
    queryFn: () => auditSdk.list(category, params as AuditListInput),
    enabled: Boolean(params?.organizationId),
  })
}
