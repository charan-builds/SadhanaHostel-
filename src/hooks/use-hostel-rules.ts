"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { queryKeys } from "@/lib/react-query"
import { hostelRulesSdk } from "@/sdk"
import type {
  AcceptHostelRulesInput,
  CreateHostelRuleInput,
  DeleteHostelRuleInput,
  HostelRulesListInput,
  ReorderHostelRulesInput,
  UpdateHostelRuleInput,
} from "@/validations/hostel-rule.validation"

export function useHostelRules(params: HostelRulesListInput) {
  return useQuery({
    queryKey: queryKeys.hostelRules.list(params, params),
    queryFn: () => hostelRulesSdk.list(params),
    enabled: Boolean(params.organizationId),
  })
}

export function useResidentHostelRules(params: HostelRulesListInput) {
  return useQuery({
    queryKey: queryKeys.hostelRules.residentStatus(params, params),
    queryFn: () => hostelRulesSdk.residentStatus(params),
    enabled: Boolean(params.organizationId),
    retry: false,
  })
}

export function useCreateHostelRule() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: CreateHostelRuleInput) => hostelRulesSdk.create(input),
    onSuccess: (rule) => invalidateRules(queryClient, rule.organization_id, rule.hostel_id),
  })
}

export function useUpdateHostelRule() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: UpdateHostelRuleInput) => hostelRulesSdk.update(input),
    onSuccess: (rule) => invalidateRules(queryClient, rule.organization_id, rule.hostel_id),
  })
}

export function useDeleteHostelRule() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: DeleteHostelRuleInput) => hostelRulesSdk.delete(input),
    onSuccess: (rule) => invalidateRules(queryClient, rule.organization_id, rule.hostel_id),
  })
}

export function useReorderHostelRules() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: ReorderHostelRulesInput) => hostelRulesSdk.reorder(input),
    onSuccess: (rules) => {
      const firstRule = rules[0]

      if (firstRule) {
        invalidateRules(queryClient, firstRule.organization_id, firstRule.hostel_id)
      }
    },
  })
}

export function useAcceptHostelRules() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: AcceptHostelRulesInput) => hostelRulesSdk.accept(input),
    onSuccess: (acceptance) => {
      invalidateRules(queryClient, acceptance.organization_id, acceptance.hostel_id)
    },
  })
}

function invalidateRules(
  queryClient: ReturnType<typeof useQueryClient>,
  organizationId: string,
  hostelId?: string | null
) {
  void queryClient.invalidateQueries({
    queryKey: queryKeys.hostelRules.all({
      organizationId,
      hostelId,
    }),
  })
}
