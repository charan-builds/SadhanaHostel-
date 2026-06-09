import type { ResidentWithOnboarding } from "@/repositories/residents.repository"

export type OnboardingRequirementKey =
  | "full_name"
  | "date_of_birth"
  | "phone"
  | "father_phone"
  | "mother_phone"
  | "permanent_address"
  | "room_allocation"
  | "rules_acceptance"

export type ResidentOnboardingRequirements = {
  status: string
  completionPercent: number
  missing: OnboardingRequirementKey[]
  canSubmitForVerification: boolean
  canCompleteOnboarding: boolean
  canAccessResidentOperations: boolean
}

export function getResidentOnboardingRequirements(
  resident: ResidentWithOnboarding
): ResidentOnboardingRequirements {
  const missing: OnboardingRequirementKey[] = []

  if (!resident.full_name) missing.push("full_name")
  if (!resident.date_of_birth) missing.push("date_of_birth")
  if (!resident.phone) missing.push("phone")
  if (!resident.parent_phone) missing.push("father_phone")
  if (!resident.emergency_contact_phone) missing.push("mother_phone")
  if (!resident.permanent_address) missing.push("permanent_address")
  if (!resident.hostel_id) missing.push("room_allocation")
  if (!hasAcceptedCurrentHostelRules(resident) && !isResidentOperationallyVerified(resident)) {
    missing.push("rules_acceptance")
  }

  const totalRequirements = 8
  const completionPercent = Math.round(
    ((totalRequirements - missing.length) / totalRequirements) * 100
  )
  const status = getResidentOnboardingStatus(resident)

  return {
    status,
    completionPercent,
    missing,
    canSubmitForVerification: missing.length === 0,
    canCompleteOnboarding: missing.length === 0,
    canAccessResidentOperations: isResidentOperationallyVerified(resident),
  }
}

export function getResidentOnboardingStatus(resident: ResidentWithOnboarding) {
  if (resident.onboarding_status) {
    return resident.onboarding_status
  }

  return "profile_incomplete"
}

export function isResidentOperationallyVerified(resident: ResidentWithOnboarding) {
  const status = getResidentOnboardingStatus(resident)

  return (
    status === "verified" &&
    resident.status === "active" &&
    resident.is_active !== false &&
    Boolean(resident.user_id) &&
    !resident.checkout_on
  )
}

export function isResidentSelfOnboardingComplete(resident: ResidentWithOnboarding) {
  return (
    getResidentOnboardingRequirements(resident).missing.length === 0 &&
    resident.is_active !== false &&
    Boolean(resident.user_id) &&
    !resident.checkout_on
  )
}

export function hasAcceptedCurrentHostelRules(resident: ResidentWithOnboarding) {
  const metadata = recordFromUnknown(resident.metadata)
  const onboarding = recordFromUnknown(metadata.onboarding)
  const acceptance = recordFromUnknown(onboarding.hostelRulesAcceptance)

  return (
    acceptance.accepted === true &&
    typeof acceptance.version === "string" &&
    acceptance.version.length >= 8 &&
    typeof acceptance.acceptedAt === "string"
  )
}

function recordFromUnknown(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}
