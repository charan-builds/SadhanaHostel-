import { apiClient } from "@/lib/api-client"
import type { Tables } from "@/types/database"
import type { AuditCategory, AuditListInput } from "@/validations/audit.validation"

import type { PaginatedResult } from "./types"

export const auditSdk = {
  list(category: AuditCategory, params: AuditListInput) {
    return apiClient.get<PaginatedResult<Tables<"audit_logs">>>(
      `/api/v1/audit/${category}`,
      params
    )
  },
}
