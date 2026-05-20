import { WorkspacePage } from "@/components/shared/workspace-page"

export default function ResidentLeavePage() {
  return (
    <WorkspacePage
      title="Leave"
      description="Submit leave requests, track approval status, and view leave history."
      metrics={[
        { label: "Pending", value: "0", detail: "Requests awaiting admin action." },
        { label: "Approved", value: "0", detail: "Upcoming leave permissions." },
        { label: "History", value: "0", detail: "Past leave records." },
      ]}
      workItems={[
        {
          title: "Leave request form",
          description: "Capture dates, reason, destination, guardian acknowledgement, and return status.",
          status: "Planned",
        },
        {
          title: "Approval updates",
          description: "Residents should receive clear updates when admins act on requests.",
          status: "Planned",
        },
      ]}
    />
  )
}
