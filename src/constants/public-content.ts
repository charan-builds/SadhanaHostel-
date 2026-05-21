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
  { title: "Terms", href: "/terms" },
]

export const fallbackHomeHighlights: FacilityItem[] = [
  {
    title: "Comfortable stay",
    description: "Simple, practical hostel living for students and employees in Pulivendula.",
    icon: "home",
  },
  {
    title: "Convenient location",
    description: HOSTEL_LOCATION.note,
    icon: "map-pin",
  },
  {
    title: "Clear monthly fees",
    description: "Transparent fee plans for students and working residents.",
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
    title: "Hot water for employees",
    description: "Hot water facility available for employee residents.",
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
    title: "Cots for employees",
    description: "Cot facilities arranged for employee room plans.",
    icon: "bed",
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
  {
    title: "Employees",
    price: HOSTEL_FEES.employee,
    priceLabel: `₹${HOSTEL_FEES.employee}/month`,
    description: "Rooms for employees with attached bathroom facilities and vehicle access.",
    features: ["Attached bathroom facilities", "Parking", "Vehicle access"],
    icon: "briefcase-business",
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
    role: "Employee resident",
    quote: "Parking and attached bathroom facilities make the stay practical for employees.",
  },
]

export const fallbackFaqItems = [
  {
    question: "What is the monthly fee for students?",
    answer: `The student fee is ₹${HOSTEL_FEES.student}/month.`,
  },
  {
    question: "What is the monthly fee for employees?",
    answer: `The employee fee is ₹${HOSTEL_FEES.employee}/month.`,
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
