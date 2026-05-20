import { WorkspacePage } from "@/components/shared/workspace-page"

export default function ResidentDashboardPage() {
  return (
    <WorkspacePage
      title="Resident Dashboard"
      description="Resident-facing snapshot for room, fees, leave status, notices, and profile completion."
      metrics={[
        { label: "Room", value: "-", detail: "Assigned room appears after onboarding." },
        { label: "Fee Status", value: "-", detail: "Payment schedule appears after fee setup." },
        { label: "Notices", value: "0", detail: "Published notices will be listed here." },
      ]}
      workItems={[
        {
          title: "Profile completion",
          description: "Residents can review personal details once auth and profile records are connected.",
          status: "Planned",
        },
        {
          title: "Leave status",
          description: "Submitted leave requests and approvals will surface in the portal.",
          status: "Planned",
        },
      ]}
    />
  )
}
