export const HOSTEL_NAME = "Sadhana Boys Hostel"
export const HOSTEL_SHORT_NAME = "Sadhana Hostel"

export const HOSTEL_CONTACT = {
  phone: "7013762904",
  whatsapp: "9346131788",
  defaultWhatsAppMessage: "Hello, is vacancy there? Are rooms available?",
} as const

export const HOSTEL_LOCATION = {
  address:
    "Palem Street, Royals Road, Near New Gangireddy Hospital, Pulivendula, Andhra Pradesh, India",
  note: "Near Loyola Polytechnic College, Pulivendula",
  city: "Pulivendula",
  state: "Andhra Pradesh",
  country: "India",
} as const

export const HOSTEL_FEES = {
  student: 3500,
  employee: 5000,
} as const

export const HOSTEL_RULES = [
  "Electronic devices such as iron boxes and heaters are not allowed.",
  "If residents get 3 days or more holidays, they must go home.",
  "Hostel fees will not be reduced during holidays such as Dussehra or Sankranti. Exception: semester break.",
  "Once residents leave the hostel premises to go home, the hostel is not responsible.",
] as const

export const callHref = `tel:${HOSTEL_CONTACT.phone}`

export const whatsappHref = `https://wa.me/91${HOSTEL_CONTACT.whatsapp}?text=${encodeURIComponent(
  HOSTEL_CONTACT.defaultWhatsAppMessage,
)}`

export const mapSearchHref = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
  `${HOSTEL_NAME}, ${HOSTEL_LOCATION.address}`,
)}`

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
  },
} as const
