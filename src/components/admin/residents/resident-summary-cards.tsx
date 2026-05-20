import { CreditCard, UserCheck, Users } from "lucide-react"

import { StatCard } from "@/components/shared/stat-card"
import type { MockResident } from "@/types/frontend"

type ResidentSummaryCardsProps = {
  residents: MockResident[]
}

export function ResidentSummaryCards({ residents }: ResidentSummaryCardsProps) {
  const activeResidents = residents.filter((resident) => resident.status === "active")
  const students = residents.filter((resident) => resident.residentType === "student")
  const employees = residents.filter((resident) => resident.residentType === "employee")
  const pendingFees = residents.filter((resident) => resident.paymentStatus !== "paid")

  return (
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
      <StatCard
        title="Total Residents"
        value={residents.length}
        description="All resident records"
        icon={Users}
        tone="info"
      />
      <StatCard
        title="Active Residents"
        value={activeResidents.length}
        description="Currently staying"
        icon={UserCheck}
        tone="success"
      />
      <StatCard
        title="Students"
        value={students.length}
        description="College residents"
        icon={Users}
        tone="default"
      />
      <StatCard
        title="Employees"
        value={employees.length}
        description="Working professionals"
        icon={Users}
        tone="default"
      />
      <StatCard
        title="Pending Fees"
        value={pendingFees.length}
        description="Need fee follow-up"
        icon={CreditCard}
        tone="warning"
      />
    </section>
  )
}
