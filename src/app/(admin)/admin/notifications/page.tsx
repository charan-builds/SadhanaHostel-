import { WorkspacePage } from "@/components/shared/workspace-page"

export default function AdminNotificationsPage() {
  return (
    <WorkspacePage
      title="Notifications"
      description="Central place for notices, reminders, resident announcements, and payment alerts."
      metrics={[
        { label: "Notices", value: "0", detail: "Published resident notices." },
        { label: "Scheduled", value: "0", detail: "Queued messages for later delivery." },
        { label: "Failed", value: "0", detail: "Delivery failures after providers are connected." },
      ]}
      workItems={[
        {
          title: "Notice publishing",
          description: "Admins can publish notices to all residents, rooms, or selected groups.",
          status: "Planned",
        },
        {
          title: "Provider adapters",
          description: "Email, SMS, WhatsApp, and push integrations can be added behind services.",
          status: "Later",
        },
      ]}
    />
  )
}
