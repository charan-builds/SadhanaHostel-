import { WorkspacePage } from "@/components/shared/workspace-page"

export default function ResidentProfilePage() {
  return (
    <WorkspacePage
      title="Profile"
      description="Personal details, guardian contacts, emergency details, documents, and room assignment."
      metrics={[
        { label: "Completion", value: "0%", detail: "Profile fields after schema setup." },
        { label: "Documents", value: "0", detail: "Uploaded resident documents." },
        { label: "Contacts", value: "0", detail: "Guardian and emergency contacts." },
      ]}
      workItems={[
        {
          title: "Editable profile",
          description: "Residents can update allowed fields while admins control verified records.",
          status: "Planned",
        },
        {
          title: "Document upload",
          description: "Storage policies will protect resident documents.",
          status: "Later",
        },
      ]}
    />
  )
}
