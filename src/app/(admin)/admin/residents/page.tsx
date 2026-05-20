import { WorkspacePage } from "@/components/shared/workspace-page"

export default function AdminResidentsPage() {
  return (
    <WorkspacePage
      title="Residents"
      description="Resident onboarding, profile records, guardian details, documents, and room allocation."
      metrics={[
        { label: "Active Residents", value: "0", detail: "Loaded from resident records." },
        { label: "Pending Onboarding", value: "0", detail: "Draft residents awaiting verification." },
        { label: "Documents", value: "0", detail: "KYC and hostel forms after storage setup." },
      ]}
      workItems={[
        {
          title: "Resident profile model",
          description: "Capture personal data, guardian contact, emergency contact, status, and hostel assignment.",
          status: "Schema",
        },
        {
          title: "Resident lifecycle",
          description: "Support admission, active stay, transfer, checkout, and archived records.",
          status: "Planned",
        },
      ]}
    />
  )
}
