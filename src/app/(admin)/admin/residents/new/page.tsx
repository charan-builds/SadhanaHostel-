import { ResidentForm } from "@/components/admin/residents/resident-form"
import { PageHeader } from "@/components/shared/page-header"
import { ResponsiveContainer } from "@/components/shared/responsive-container"

export default function NewResidentPage() {
  return (
    <ResponsiveContainer size="wide" className="grid gap-6 px-0 sm:px-0">
      <PageHeader
        title="Add Resident"
        description="Create a new resident profile with room, guardian, fee, and contact details."
      />
      <ResidentForm />
    </ResponsiveContainer>
  )
}
