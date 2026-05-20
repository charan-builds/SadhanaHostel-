import { WorkspacePage } from "@/components/shared/workspace-page"

export default function AdminWebsitePage() {
  return (
    <WorkspacePage
      title="Website CMS"
      description="Manage public pages, room content, facilities, gallery albums, contact data, and terms."
      metrics={[
        { label: "Pages", value: "7", detail: "Current public route count." },
        { label: "Drafts", value: "0", detail: "Unpublished CMS entries." },
        { label: "Media", value: "0", detail: "Storage-backed files after Supabase setup." },
      ]}
      workItems={[
        {
          title: "CMS content model",
          description: "Keep public content editable without redeploying the Next.js app.",
          status: "Next phase",
        },
        {
          title: "Media storage",
          description: "Use Supabase Storage policies for gallery and document uploads.",
          status: "Planned",
        },
      ]}
    />
  )
}
