import { PublicSectionPage } from "@/components/shared/public-section-page"

export default function FacilitiesPage() {
  return (
    <PublicSectionPage
      eyebrow="Facilities"
      title="Facilities content ready for CMS control."
      description="The facilities route is prepared for dynamic sections such as food, Wi-Fi, housekeeping, safety, laundry, and study spaces."
      items={[
        {
          title: "Daily Essentials",
          description: "Food, water, housekeeping, laundry, and maintenance can be listed from CMS data.",
        },
        {
          title: "Safety",
          description: "Security, visitor rules, emergency contacts, and policies can be published clearly.",
        },
        {
          title: "Resident Comfort",
          description: "Study areas, internet, storage, and common-space information can be maintained by admins.",
        },
      ]}
    />
  )
}
