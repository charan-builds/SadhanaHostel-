import { apiClient } from "@/lib/api-client"
import type { HostelRuleAcceptance, HostelRulesOverview } from "@/types/hostel-rules"
import type { Tables } from "@/types/database"
import type {
  AcceptHostelRulesInput,
  CreateHostelRuleInput,
  DeleteHostelRuleInput,
  HostelRulesListInput,
  ReorderHostelRulesInput,
  UpdateHostelRuleInput,
} from "@/validations/hostel-rule.validation"

export const hostelRulesSdk = {
  list(params: HostelRulesListInput) {
    return apiClient.get<HostelRulesOverview>("/api/hostel-rules", params)
  },

  residentStatus(params: HostelRulesListInput) {
    return apiClient.get<HostelRulesOverview>("/api/hostel-rules/acceptance", params)
  },

  create(input: CreateHostelRuleInput) {
    return apiClient.post<Tables<"hostel_rules">, CreateHostelRuleInput>(
      "/api/hostel-rules",
      input
    )
  },

  update(input: UpdateHostelRuleInput) {
    const { ruleId, ...body } = input

    return apiClient.patch<Tables<"hostel_rules">, Omit<UpdateHostelRuleInput, "ruleId">>(
      `/api/hostel-rules/${ruleId}`,
      body
    )
  },

  delete(input: DeleteHostelRuleInput) {
    return apiClient.delete<Tables<"hostel_rules">>(
      `/api/hostel-rules/${input.ruleId}`,
      {
        organizationId: input.organizationId,
      }
    )
  },

  reorder(input: ReorderHostelRulesInput) {
    return apiClient.patch<Tables<"hostel_rules">[], ReorderHostelRulesInput>(
      "/api/hostel-rules/reorder",
      input
    )
  },

  accept(input: AcceptHostelRulesInput) {
    return apiClient.post<HostelRuleAcceptance, AcceptHostelRulesInput>(
      "/api/hostel-rules/acceptance",
      input
    )
  },
}
