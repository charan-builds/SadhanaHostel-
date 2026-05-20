import { WorkspacePage } from "@/components/shared/workspace-page"

export default function AdminDashboardPage() {
  return (
    <WorkspacePage
      title="Admin Dashboard"
      description="Operational snapshot for occupancy, payments, leaves, notices, and website publishing."
      metrics={[
        { label: "Occupancy", value: "0%", detail: "Connect rooms and residents in the database phase." },
        { label: "Fees Due", value: "0", detail: "Payment schedules will appear after fee schema setup." },
        { label: "Open Leaves", value: "0", detail: "Leave requests will feed this queue." },
      ]}
      workItems={[
        {
          title: "Database architecture",
          description: "Design tenants, hostels, residents, rooms, invoices, payments, leaves, and notices.",
          status: "Next phase",
        },
        {
          title: "Role-based access",
          description: "Prepare admin, staff, and resident permissions after Supabase auth is configured.",
          status: "Planned",
        },
      ]}
    />
  )
}
