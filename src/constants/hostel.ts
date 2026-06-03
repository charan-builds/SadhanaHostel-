export const HOSTEL_NAME = "Sadhana Boys Hostel"
export const HOSTEL_SHORT_NAME = "Sadhana Hostel"
export const HOSTEL_TOTAL_CAPACITY = 70

export const HOSTEL_CONTACT = {
  phone: "7013762904",
  whatsapp: "9346131788",
  defaultWhatsAppMessage: "Hello, is vacancy there? Are rooms available?",
} as const

export const HOSTEL_LOCATION = {
  address: "C67M+7W2, Royals Rd, Bakarapuram, Pulivendula, Andhra Pradesh 516390, India",
  note: "Royals Road, Bakarapuram, Pulivendula",
  city: "Pulivendula",
  state: "Andhra Pradesh",
  country: "India",
  mapQuery: "Sadhana Boys hostel, C67M+7W2, Royals Rd, Bakarapuram, Andhra Pradesh 516390, India",
  googleMapsCid: "5249046540388198698",
} as const

export const HOSTEL_FEES = {
  student: 3500,
  employee: 5000,
} as const

export const HOSTEL_RULES_VERSION = "2026-06-02"

export const HOSTEL_RULES = [
  "Electronic devices such as iron boxes and heaters are not allowed.",
  "If residents get 3 days or more holidays, they must go home. They are not allowed to stay in the hostel if holidays are 3 days or above.",
  "Hostel fees will not be reduced during holidays such as Dussehra or Sankranti. Exception: semester break. Residents must pay monthly fees regularly.",
  "After joining the hostel, if a resident chooses to leave, paid hostel fees, advance, or other payments will not be reversed or refunded.",
  "Once residents leave the hostel premises to go home, the hostel is not responsible.",
] as const

export const callHref = `tel:${HOSTEL_CONTACT.phone}`

export const whatsappHref = `https://wa.me/91${HOSTEL_CONTACT.whatsapp}?text=${encodeURIComponent(
  HOSTEL_CONTACT.defaultWhatsAppMessage,
)}`

export const mapSearchHref = `https://www.google.com/maps?cid=${HOSTEL_LOCATION.googleMapsCid}`

export const mapEmbedHref = `https://www.google.com/maps?cid=${HOSTEL_LOCATION.googleMapsCid}&output=embed`

export const hostelConfig = {
  name: HOSTEL_NAME,
  shortName: HOSTEL_SHORT_NAME,
  contact: HOSTEL_CONTACT,
  location: HOSTEL_LOCATION,
  fees: HOSTEL_FEES,
  rules: HOSTEL_RULES,
  links: {
    callHref,
    whatsappHref,
    mapSearchHref,
    mapEmbedHref,
  },
} as const
