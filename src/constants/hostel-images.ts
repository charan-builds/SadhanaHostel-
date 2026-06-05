export const hostelImages = {
  hero: "/images/hostel-exterior-wide.webp",
  exterior: "/images/hostel-exterior-wide.webp",
  building: "/images/hostel-courtyard-clean.webp",
  gate: "/images/hostel-gate.webp",
  rawExterior: "/images/hostel-gate-clean.webp",
  uploadedFacility: "/images/hostel-courtyard-clean.webp",
  uploadedRooms: "/images/hostel-courtyard-clean.webp",
} as const

export const hostelGalleryImages = [
  hostelImages.exterior,
  hostelImages.building,
  hostelImages.gate,
  hostelImages.rawExterior,
  hostelImages.uploadedFacility,
  hostelImages.uploadedRooms,
] as const
