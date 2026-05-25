export type ResidentLifecycleStatus =
  | "draft"
  | "active"
  | "suspended"
  | "checked_out"
  | "archived"

export type ResidentOnboardingLifecycleStatus =
  | "invited"
  | "activated"
  | "profile_incomplete"
  | "documents_pending"
  | "verification_pending"
  | "verified"
  | "rejected"
  | "suspended"
  | string
  | null
  | undefined

export type ResidentLifecycleRow = {
  id?: string | null
  status: ResidentLifecycleStatus | string | null
  is_active?: boolean | null
  user_id?: string | null
  checkout_on?: string | null
  onboarding_status?: ResidentOnboardingLifecycleStatus
}

export type ResidentLifecycleSummary = {
  registeredResidents: number
  activeResidents: number
  draftResidents: number
  onboardingResidents: number
  verifiedResidents: number
  suspendedResidents: number
  checkedOutResidents: number
  archivedResidents: number
  pendingVerification: number
}

const ONBOARDING_BACKLOG_STATUSES = new Set([
  "invited",
  "activated",
  "profile_incomplete",
  "documents_pending",
  "verification_pending",
  "rejected",
])

const VERIFICATION_BACKLOG_STATUSES = new Set([
  "documents_pending",
  "verification_pending",
  "rejected",
])

export function buildResidentLifecycleSummary(
  residents: ResidentLifecycleRow[]
): ResidentLifecycleSummary {
  const summary: ResidentLifecycleSummary = {
    registeredResidents: residents.length,
    activeResidents: 0,
    draftResidents: 0,
    onboardingResidents: 0,
    verifiedResidents: 0,
    suspendedResidents: 0,
    checkedOutResidents: 0,
    archivedResidents: 0,
    pendingVerification: 0,
  }

  for (const resident of residents) {
    const status = resident.status ?? "draft"
    const onboardingStatus = resident.onboarding_status ?? null
    const isOperational = isOperationalResident(resident)

    if (isOperational) {
      summary.activeResidents += 1
    }

    if (status === "draft") {
      summary.draftResidents += 1
    }

    if (status === "suspended" || onboardingStatus === "suspended") {
      summary.suspendedResidents += 1
    }

    if (status === "checked_out") {
      summary.checkedOutResidents += 1
    }

    if (status === "archived") {
      summary.archivedResidents += 1
    }

    if (isCurrentVerifiedResident(resident)) {
      summary.verifiedResidents += 1
    }

    if (isOnboardingBacklog(status, onboardingStatus)) {
      summary.onboardingResidents += 1
    }

    if (isPendingVerification(onboardingStatus)) {
      summary.pendingVerification += 1
    }
  }

  return summary
}

export function isOperationalResident(resident: ResidentLifecycleRow) {
  return (
    resident.status === "active" &&
    resident.onboarding_status === "verified" &&
    resident.is_active !== false &&
    Boolean(resident.user_id) &&
    !resident.checkout_on
  )
}

export function isResidentEligibleForOccupancy(resident: ResidentLifecycleRow) {
  return isOperationalResident(resident)
}

export function isResidentEligibleForBilling(resident: ResidentLifecycleRow) {
  return isOperationalResident(resident)
}

export function isResidentEligibleForAnalytics(resident: ResidentLifecycleRow) {
  return isOperationalResident(resident)
}

export function isCurrentVerifiedResident(resident: ResidentLifecycleRow) {
  return (
    resident.onboarding_status === "verified" &&
    resident.status !== "checked_out" &&
    resident.status !== "archived" &&
    resident.status !== "suspended" &&
    resident.is_active !== false &&
    Boolean(resident.user_id) &&
    !resident.checkout_on
  )
}

function isOnboardingBacklog(
  status: string,
  onboardingStatus: ResidentOnboardingLifecycleStatus
) {
  if (status === "draft" || status === "invited" || status === "onboarding_pending") {
    return true
  }

  return Boolean(onboardingStatus && ONBOARDING_BACKLOG_STATUSES.has(onboardingStatus))
}

function isPendingVerification(onboardingStatus: ResidentOnboardingLifecycleStatus) {
  return Boolean(onboardingStatus && VERIFICATION_BACKLOG_STATUSES.has(onboardingStatus))
}
