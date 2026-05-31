import {
  HOSTEL_FEES,
  HOSTEL_LOCATION,
  HOSTEL_RULES,
} from "@/constants/hostel"
import type {
  FacilityItem,
  GalleryItem,
  PublicNavItem,
  RoomTypeCard,
  TestimonialItem,
} from "@/types/frontend"

export const publicNavItems: PublicNavItem[] = [
  { title: "Home", href: "/" },
  { title: "About", href: "/about" },
  { title: "Rooms", href: "/rooms" },
  { title: "Facilities", href: "/facilities" },
  { title: "Gallery", href: "/gallery" },
  { title: "Contact", href: "/contact" },
  { title: "Support", href: "/support" },
  { title: "Terms", href: "/terms" },
]

export const fallbackHomeHighlights: FacilityItem[] = [
  {
    title: "Comfortable stay",
    description: "Simple, practical hostel living for college students in Pulivendula.",
    icon: "home",
  },
  {
    title: "Convenient location",
    description: HOSTEL_LOCATION.note,
    icon: "map-pin",
  },
  {
    title: "Clear monthly fees",
    description: `Fixed student fee of ₹${HOSTEL_FEES.student}/month.`,
    icon: "indian-rupee",
  },
]

export const fallbackFacilities: FacilityItem[] = [
  {
    title: "Tasty food",
    description: "Daily food service prepared for residents.",
    icon: "utensils",
  },
  {
    title: "WiFi",
    description: "Internet access for study and work needs.",
    icon: "wifi",
  },
  {
    title: "CCTV cameras",
    description: "Camera coverage for better premises monitoring.",
    icon: "camera",
  },
  {
    title: "24-hour water",
    description: "Water availability throughout the day.",
    icon: "droplets",
  },
  {
    title: "Student-friendly rooms",
    description: "Room capacity is managed for hostel students, not separate cot plans.",
    icon: "bath",
  },
  {
    title: "Parking",
    description: "Parking support for residents with vehicles.",
    icon: "parking-circle",
  },
  {
    title: "Clean environment",
    description: "Maintained spaces for a disciplined hostel routine.",
    icon: "sparkles",
  },
  {
    title: "Near college route",
    description: HOSTEL_LOCATION.note,
    icon: "map-pin",
  },
]

export const fallbackRoomTypes: RoomTypeCard[] = [
  {
    title: "College Students",
    price: HOSTEL_FEES.student,
    priceLabel: `₹${HOSTEL_FEES.student}/month`,
    description: "Affordable rooms with a study-friendly stay.",
    features: ["Affordable rooms", "Study-friendly stay", "Near college route"],
    icon: "graduation-cap",
  },
]

export const fallbackGalleryItems: GalleryItem[] = [
  {
    title: "Exterior",
    category: "Hostel",
    alt: "Sadhana Boys Hostel exterior view",
  },
  {
    title: "Courtyard",
    category: "Common area",
    alt: "Hostel courtyard area",
  },
  {
    title: "Night view",
    category: "Hostel",
    alt: "Sadhana Boys Hostel night view",
  },
  {
    title: "Rooms",
    category: "Accommodation",
    alt: "Resident room setup",
  },
  {
    title: "Bathrooms",
    category: "Facilities",
    alt: "Bathroom facilities",
  },
  {
    title: "Dining area",
    category: "Food",
    alt: "Dining area for residents",
  },
  {
    title: "Terrace",
    category: "Common area",
    alt: "Hostel terrace space",
  },
]

export const fallbackTestimonials: TestimonialItem[] = [
  {
    name: "Ramesh Kumar",
    role: "Student resident",
    quote: "The hostel is close to college routes and has a calm study atmosphere.",
  },
  {
    name: "Suresh Naik",
    role: "Student resident",
    quote: "Rooms are practical for college students and the monthly fee is clear.",
  },
]

export const fallbackFaqItems = [
  {
    question: "What is the monthly fee for students?",
    answer: `The student fee is ₹${HOSTEL_FEES.student}/month.`,
  },
  {
    question: "Where is the hostel located?",
    answer: `${HOSTEL_LOCATION.address}. ${HOSTEL_LOCATION.note}.`,
  },
  {
    question: "Are electronic heaters or iron boxes allowed?",
    answer: "No. Electronic devices such as iron boxes and heaters are not allowed.",
  },
] as const

export const termsAndRules = [...HOSTEL_RULES]
