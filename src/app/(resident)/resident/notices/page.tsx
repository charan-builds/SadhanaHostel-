import { WorkspacePage } from "@/components/shared/workspace-page"

export default function ResidentNoticesPage() {
  return (
    <WorkspacePage
      title="Notices"
      description="Hostel announcements, payment reminders, leave updates, and policy notices."
      metrics={[
        { label: "Unread", value: "0", detail: "Notices not yet acknowledged." },
        { label: "Pinned", value: "0", detail: "Important announcements." },
        { label: "Archived", value: "0", detail: "Older notices." },
      ]}
      workItems={[
        {
          title: "Notice feed",
          description: "Residents can view notices targeted to all residents, their hostel, or their room.",
          status: "Planned",
        },
        {
          title: "Acknowledgements",
          description: "Important notices can require resident acknowledgement later.",
          status: "Later",
        },
      ]}
    />
  )
}
