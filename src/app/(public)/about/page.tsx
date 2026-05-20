import { PublicSectionPage } from "@/components/shared/public-section-page"

export default function AboutPage() {
  return (
    <PublicSectionPage
      eyebrow="About"
      title="A focused hostel experience with disciplined operations."
      description="The public website starts lean, but its structure is ready for dynamic CMS content and multi-hostel expansion."
      items={[
        {
          title: "Managed Living",
          description: "Resident records, room status, payments, and communication live in one system.",
        },
        {
          title: "Transparent Operations",
          description: "Admin workflows are designed around traceable data and future audit needs.",
        },
        {
          title: "Growth Ready",
          description: "The platform can evolve from one hostel to many branches without a rewrite.",
        },
      ]}
    />
  )
}
