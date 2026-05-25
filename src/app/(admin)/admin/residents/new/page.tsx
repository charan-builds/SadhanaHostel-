import { ResidentForm } from "@/components/admin/residents/resident-form"
import { PageHeader } from "@/components/shared/page-header"
import { ResponsiveContainer } from "@/components/shared/responsive-container"

export default function NewResidentPage() {
  return (
    <ResponsiveContainer size="wide" className="grid gap-6 px-0 sm:px-0">
      <PageHeader
        title="Quick Resident Admission"
        description="Create a draft resident with only name, phone, type, and optional room or fee details. The resident completes the full profile from their activation link."
      />
      <ResidentForm />
    </ResponsiveContainer>
  )
}
