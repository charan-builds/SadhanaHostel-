import { hostelConfig } from "@/constants/hostel"

export const siteConfig = {
  name: hostelConfig.name,
  shortName: hostelConfig.shortName,
  description:
    "A modern hostel management platform for residents, fees, rooms, leaves, notifications, invoices, and CMS-managed website content.",
  contact: {
    phone: hostelConfig.contact.phone,
    whatsapp: hostelConfig.contact.whatsapp,
    email: "hello@sadhanahostel.local",
    address: hostelConfig.location.address,
    locationNote: hostelConfig.location.note,
  },
  fees: hostelConfig.fees,
  links: hostelConfig.links,
  areas: ["Public website", "Admin dashboard", "Resident portal"],
} as const
