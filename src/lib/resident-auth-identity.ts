export const RESIDENT_AUTH_EMAIL_DOMAIN = "auth.sadhanahostel.invalid"

export function buildResidentInternalAuthEmail(residentId: string) {
  return `resident-${residentId.replace(/-/g, "").toLowerCase()}@${RESIDENT_AUTH_EMAIL_DOMAIN}`
}

export function normalizeEmailCandidate(value: unknown) {
  if (typeof value !== "string") {
    return null
  }

  const email = value.trim().toLowerCase()

  return email && email.includes("@") ? email : null
}

export function isResidentInternalAuthEmail(value: unknown) {
  return normalizeEmailCandidate(value)?.endsWith(`@${RESIDENT_AUTH_EMAIL_DOMAIN}`) ?? false
}

export function getResidentMetadataAuthLoginEmail(metadata: Record<string, unknown>) {
  return (
    normalizeEmailCandidate(metadata.auth_login_email) ??
    normalizeEmailCandidate(metadata.internal_auth_email)
  )
}

export function getResidentMetadataInternalAuthEmail(metadata: Record<string, unknown>) {
  const internalAuthEmail = normalizeEmailCandidate(metadata.internal_auth_email)

  if (internalAuthEmail) {
    return internalAuthEmail
  }

  const authLoginEmail = normalizeEmailCandidate(metadata.auth_login_email)

  return isResidentInternalAuthEmail(authLoginEmail) ? authLoginEmail : null
}

export function resolveResidentAuthLoginEmail(input: {
  residentId: string
  profileMetadata?: Record<string, unknown>
  authMetadata?: Record<string, unknown>
  profileEmail?: string | null
  authEmail?: string | null
  residentEmail?: string | null
}) {
  return (
    getResidentMetadataAuthLoginEmail(input.profileMetadata ?? {}) ??
    getResidentMetadataAuthLoginEmail(input.authMetadata ?? {}) ??
    normalizeEmailCandidate(input.profileEmail) ??
    normalizeEmailCandidate(input.authEmail) ??
    normalizeEmailCandidate(input.residentEmail) ??
    buildResidentInternalAuthEmail(input.residentId)
  )
}

export function resolveResidentInternalAuthEmail(input: {
  residentId: string
  profileMetadata?: Record<string, unknown>
  authMetadata?: Record<string, unknown>
  profileEmail?: string | null
  authEmail?: string | null
  residentEmail?: string | null
}) {
  return (
    getResidentMetadataInternalAuthEmail(input.profileMetadata ?? {}) ??
    getResidentMetadataInternalAuthEmail(input.authMetadata ?? {}) ??
    (isResidentInternalAuthEmail(input.profileEmail)
      ? normalizeEmailCandidate(input.profileEmail)
      : null) ??
    (isResidentInternalAuthEmail(input.authEmail)
      ? normalizeEmailCandidate(input.authEmail)
      : null) ??
    (normalizeEmailCandidate(input.residentEmail)
      ? null
      : buildResidentInternalAuthEmail(input.residentId))
  )
}
