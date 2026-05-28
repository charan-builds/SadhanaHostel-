export type ResidentIdentityMode = "phone_only" | "email_only" | "hybrid"

export function getResidentIdentityMode(input: {
  email?: string | null
  phone?: string | null
}): ResidentIdentityMode {
  const hasEmail = Boolean(input.email?.trim())
  const hasPhone = Boolean(input.phone?.trim())

  if (hasEmail && hasPhone) {
    return "hybrid"
  }

  return hasEmail ? "email_only" : "phone_only"
}

export function formatResidentIdentityMode(mode: ResidentIdentityMode) {
  switch (mode) {
    case "phone_only":
      return "Phone Only"
    case "email_only":
      return "Email Only"
    case "hybrid":
      return "Hybrid"
  }
}

export function getResidentIdentityRequirement(mode: ResidentIdentityMode) {
  return {
    emailRequired: mode === "email_only",
    phoneRequired: mode === "phone_only",
  }
}
