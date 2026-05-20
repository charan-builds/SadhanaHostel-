import { PublicSectionPage } from "@/components/shared/public-section-page"

export default function ContactPage() {
  return (
    <PublicSectionPage
      eyebrow="Contact"
      title="Contact and inquiry flow ready for lead capture."
      description="The contact route will later connect to inquiry records, notifications, and admin follow-up workflows."
      items={[
        {
          title: "Phone and Email",
          description: "Primary hostel contacts can be managed from admin settings.",
        },
        {
          title: "Inquiry Form",
          description: "Prospective residents can submit room and admission questions.",
        },
        {
          title: "Location",
          description: "Map, address, and landmark content can be controlled by the CMS module.",
        },
      ]}
    />
  )
}
