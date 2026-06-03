"use client"

import Link from "next/link"
import type { Route } from "next"
import { usePathname } from "next/navigation"
import { AlertTriangle, UserRoundCheck } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { useResidentOnboarding } from "@/hooks"
import { useAuth } from "@/lib/auth"

const missingLabels: Record<string, string> = {
  full_name: "full name",
  date_of_birth: "date of birth",
  phone: "phone",
  father_phone: "father phone",
  mother_phone: "mother phone",
  permanent_address: "permanent address",
  rules_acceptance: "hostel rules acceptance",
}

export function ResidentProfileReminder() {
  const pathname = usePathname()
  const { organizationId } = useAuth()
  const onboarding = useResidentOnboarding(organizationId)

  if (
    !organizationId ||
    pathname === "/resident/onboarding" ||
    pathname.startsWith("/resident/onboarding/")
  ) {
    return null
  }

  const requirements = onboarding.data?.requirements

  if (!requirements || requirements.canAccessResidentOperations) {
    return null
  }

  const missingSummary =
    requirements.missing.length > 0
      ? `Missing: ${requirements.missing
          .slice(0, 3)
          .map((item) => missingLabels[item] ?? item)
          .join(", ")}${requirements.missing.length > 3 ? "..." : "."}`
      : "Profile details are ready. Finish onboarding to activate the account."

  return (
    <Alert variant="warning">
      <AlertTriangle className="size-4" aria-hidden="true" />
      <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-center">
        <div>
          <AlertTitle>Complete your resident profile</AlertTitle>
          <AlertDescription>
            {requirements.completionPercent}% complete. {missingSummary} Payments can be
            submitted now, but profile completion is still required.
          </AlertDescription>
        </div>
        <Button asChild size="sm" className="w-full sm:w-auto">
          <Link href={"/resident/onboarding" as Route}>
            <UserRoundCheck className="size-4" aria-hidden="true" />
            Update profile
          </Link>
        </Button>
      </div>
    </Alert>
  )
}
