import { WorkspacePage } from "@/components/shared/workspace-page"

export default function AdminLeavesPage() {
  return (
    <WorkspacePage
      title="Leaves"
      description="Review leave requests, approval status, guardian communication, and return tracking."
      metrics={[
        { label: "Pending", value: "0", detail: "Requests awaiting action." },
        { label: "Approved", value: "0", detail: "Upcoming approved leaves." },
        { label: "Overdue Return", value: "0", detail: "Residents not marked returned." },
      ]}
      workItems={[
        {
          title: "Leave workflow",
          description: "Resident requests should move through pending, approved, rejected, departed, and returned states.",
          status: "Schema",
        },
        {
          title: "Notifications",
          description: "Approval and return reminders can feed the notifications module.",
          status: "Planned",
        },
      ]}
    />
  )
}
