export const hostelImages = {
  hero: "/images/hostel-exterior-wide.webp",
  exterior: "/images/hostel-exterior-wide.webp",
  building: "/images/hostel-building.webp",
  gate: "/images/hostel-gate.webp",
  rawExterior: "/images/WhatsApp Image 2026-05-21 at 16.59.44.jpeg",
  uploadedFacility: "/images/image.png",
  uploadedRooms: "/images/image copy.png",
} as const

export const hostelGalleryImages = [
  hostelImages.exterior,
  hostelImages.building,
  hostelImages.gate,
  hostelImages.rawExterior,
  hostelImages.uploadedFacility,
  hostelImages.uploadedRooms,
] as const
