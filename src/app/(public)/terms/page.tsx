import { PublicSectionPage } from "@/components/shared/public-section-page"

export default function TermsPage() {
  return (
    <PublicSectionPage
      eyebrow="Terms"
      title="Hostel policies prepared for versioned content."
      description="Terms, resident rules, refund policies, privacy notes, and visitor policies can later become CMS-managed documents."
      items={[
        {
          title: "Resident Rules",
          description: "Curfew, visitors, room care, and conduct policies belong in structured records.",
        },
        {
          title: "Payment Terms",
          description: "Due dates, late fees, refunds, and invoice policies will align with fee modules.",
        },
        {
          title: "Privacy",
          description: "Resident data handling can be documented alongside access-control policies.",
        },
      ]}
    />
  )
}
