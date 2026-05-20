import { PublicSectionPage } from "@/components/shared/public-section-page"

export default function GalleryPage() {
  return (
    <PublicSectionPage
      eyebrow="Gallery"
      title="Gallery route prepared for hostel photos and CMS albums."
      description="This page will later render uploaded room, facility, and campus images from Supabase Storage or another approved media source."
      items={[
        {
          title: "Rooms",
          description: "Show room condition and amenities with category-based media.",
        },
        {
          title: "Facilities",
          description: "Publish facility albums from the admin website module.",
        },
        {
          title: "Common Areas",
          description: "Present the hostel environment with organized, searchable gallery data.",
        },
      ]}
    />
  )
}
