import { WorkspacePage } from "@/components/shared/workspace-page"

export default function AdminSettingsPage() {
  return (
    <WorkspacePage
      title="Settings"
      description="Hostel profile, billing defaults, access roles, policy defaults, and integration keys."
      metrics={[
        { label: "Hostels", value: "1", detail: "Prepared for multi-hostel tenancy." },
        { label: "Roles", value: "0", detail: "Configured after auth and RLS design." },
        { label: "Integrations", value: "0", detail: "Supabase and Cashfree setup checkpoints." },
      ]}
      workItems={[
        {
          title: "Tenant settings",
          description: "Separate organization, hostel, and branch configuration for future ERP-level growth.",
          status: "Schema",
        },
        {
          title: "Security settings",
          description: "RLS policies and admin role assignments will be defined with the database.",
          status: "Next phase",
        },
      ]}
    />
  )
}
