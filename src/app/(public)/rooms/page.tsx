import { PublicSectionPage } from "@/components/shared/public-section-page"

export default function RoomsPage() {
  return (
    <PublicSectionPage
      eyebrow="Rooms"
      title="Room information prepared for live availability and pricing."
      description="Room pages will later connect to Supabase so admins can publish room types, photos, capacity, pricing, and availability."
      items={[
        {
          title: "Room Types",
          description: "Single, shared, and capacity-based room records can be modeled cleanly.",
        },
        {
          title: "Occupancy",
          description: "Allocation and vacancy tracking will plug into the admin room module.",
        },
        {
          title: "Pricing",
          description: "Monthly fees, deposits, and add-on charges can feed invoices automatically.",
        },
      ]}
    />
  )
}
