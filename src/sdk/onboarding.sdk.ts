import { apiClient } from "@/lib/api-client"
import type {
  OnboardingProfileInput,
  OnboardingQueueInput,
  OnboardingReviewInput,
  OnboardingStatusQueryInput,
  OnboardingSubmitInput,
} from "@/validations/onboarding.validation"
import type { ResidentWithOnboarding } from "@/repositories/residents.repository"
import type { ResidentOnboardingRequirements } from "@/services/onboarding/resident-onboarding.policy"

import type { PaginatedResult } from "./types"

export type ResidentOnboardingOverview = {
  resident: ResidentWithOnboarding
  requirements: ResidentOnboardingRequirements
}

export const onboardingSdk = {
  me(params?: OnboardingStatusQueryInput) {
    return apiClient.get<ResidentOnboardingOverview>("/api/onboarding/me", params)
  },

  updateProfile(input: OnboardingProfileInput) {
    return apiClient.patch<ResidentOnboardingOverview, OnboardingProfileInput>(
      "/api/onboarding/me",
      input
    )
  },

  submit(input: OnboardingSubmitInput) {
    return apiClient.post<ResidentOnboardingOverview, OnboardingSubmitInput>(
      "/api/onboarding/submit",
      input
    )
  },

  queue(params: OnboardingQueueInput) {
    return apiClient.get<PaginatedResult<ResidentWithOnboarding>>(
      "/api/onboarding/queue",
      params
    )
  },

  review(input: OnboardingReviewInput) {
    return apiClient.patch<ResidentOnboardingOverview, OnboardingReviewInput>(
      "/api/onboarding/review",
      input
    )
  },
}
