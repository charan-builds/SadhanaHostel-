import type { ResidentWithOnboarding } from "@/repositories/residents.repository"

export type OnboardingRequirementKey =
  | "full_name"
  | "date_of_birth"
  | "phone"
  | "guardian"
  | "emergency_contact"
  | "permanent_address"
  | "aadhaar_document"
  | "profile_photo"
  | "student_id"
  | "room_allocation"

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
  if (!resident.parent_name || !resident.parent_phone) missing.push("guardian")
  if (!resident.emergency_contact_name || !resident.emergency_contact_phone) {
    missing.push("emergency_contact")
  }
  if (!resident.permanent_address) missing.push("permanent_address")
  if (!resident.aadhaar_document_id) missing.push("aadhaar_document")
  if (!resident.profile_image_document_id) missing.push("profile_photo")
  if (!resident.student_id_document_id) missing.push("student_id")
  if (!resident.hostel_id) missing.push("room_allocation")

  const totalRequirements = 10
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
