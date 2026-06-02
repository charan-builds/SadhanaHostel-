import type { Metadata } from "next"

import { PasswordUpdateCard } from "@/components/auth/password-reset-gate"
import { PageHeader } from "@/components/shared/page-header"

export const metadata: Metadata = {
  title: "Change Password",
}

export default function ResidentSecurityPage() {
  return (
    <div className="grid gap-6">
      <PageHeader
        title="Change Password"
        description="Set a private password for your resident portal login."
      />

      <div className="max-w-xl">
        <PasswordUpdateCard
          title="Change resident password"
          description="Replace your temporary password with a private password."
          submitLabel="Update password"
        />
      </div>
    </div>
  )
}
