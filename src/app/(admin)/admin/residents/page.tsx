import Link from "next/link"
import type { Route } from "next"
import { Plus } from "lucide-react"

import { ResidentSummaryCards } from "@/components/admin/residents/resident-summary-cards"
import { ResidentsTable } from "@/components/admin/residents/residents-table"
import { PageHeader } from "@/components/shared/page-header"
import { ResponsiveContainer } from "@/components/shared/responsive-container"
import { Button } from "@/components/ui/button"
import { mockResidents } from "@/data/admin"

export default function AdminResidentsPage() {
  return (
    <ResponsiveContainer size="wide" className="grid gap-6 px-0 sm:px-0">
      <PageHeader
        title="Residents"
        description="Manage students, employees, room assignments, fee status, and resident records."
        actions={
          <Button asChild>
            <Link href={"/admin/residents/new" as Route}>
              <Plus className="size-4" aria-hidden="true" />
              Add Resident
            </Link>
          </Button>
        }
      />
      <ResidentSummaryCards residents={mockResidents} />
      <ResidentsTable residents={mockResidents} />
    </ResponsiveContainer>
  )
}
