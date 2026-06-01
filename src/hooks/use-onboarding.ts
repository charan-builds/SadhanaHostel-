"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { queryKeys } from "@/lib/react-query"
import { onboardingSdk } from "@/sdk"
import type {
  OnboardingProfileInput,
  OnboardingQueueInput,
  OnboardingReviewInput,
  OnboardingSubmitInput,
} from "@/validations/onboarding.validation"

export function useResidentOnboarding(organizationId?: string | null) {
  return useQuery({
    queryKey: queryKeys.onboarding.me({ organizationId }),
    queryFn: () =>
      onboardingSdk.me(organizationId ? { organizationId } : undefined),
    enabled: Boolean(organizationId),
    retry: false,
  })
}

export function useUpdateResidentOnboardingProfile() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: OnboardingProfileInput) => onboardingSdk.updateProfile(input),
    onSuccess: async (result) => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: queryKeys.onboarding.me({
            organizationId: result.resident.organization_id,
            hostelId: result.resident.hostel_id,
          }),
        }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.residents.detail(
            {
              organizationId: result.resident.organization_id,
              hostelId: result.resident.hostel_id,
            },
            "me"
          ),
        }),
      ])
    },
  })
}

export function useSubmitResidentOnboarding() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: OnboardingSubmitInput) => onboardingSdk.submit(input),
    onSuccess: async (result) => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: queryKeys.onboarding.me({
            organizationId: result.resident.organization_id,
            hostelId: result.resident.hostel_id,
          }),
        }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.residents.detail(
            {
              organizationId: result.resident.organization_id,
              hostelId: result.resident.hostel_id,
            },
            "me"
          ),
        }),
      ])
    },
  })
}

export function useOnboardingQueue(params: OnboardingQueueInput) {
  return useQuery({
    queryKey: queryKeys.onboarding.queue(params, params),
    queryFn: () => onboardingSdk.queue(params),
    enabled: Boolean(params.organizationId),
  })
}

export function useReviewOnboarding() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: OnboardingReviewInput) => onboardingSdk.review(input),
    onSuccess: async (result) => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: queryKeys.onboarding.queue(
            {
              organizationId: result.resident.organization_id,
              hostelId: result.resident.hostel_id,
            },
            {}
          ),
        }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.residents.all({
            organizationId: result.resident.organization_id,
            hostelId: result.resident.hostel_id,
          }),
        }),
      ])
    },
  })
}
