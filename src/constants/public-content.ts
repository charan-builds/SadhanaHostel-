import {
  HOSTEL_FEES,
  HOSTEL_LOCATION,
  HOSTEL_RULES,
} from "@/constants/hostel"
import { hostelGalleryImages } from "@/constants/hostel-images"
import type {
  FacilityItem,
  GalleryItem,
  PublicNavItem,
  RoomTypeCard,
  TestimonialItem,
} from "@/types/frontend"

export const publicNavItems: PublicNavItem[] = [
  { title: "Home", href: "/" },
  { title: "Rooms", href: "/rooms" },
  { title: "Admissions", href: "/admissions" },
  { title: "Facilities", href: "/facilities" },
  { title: "Gallery", href: "/gallery" },
  { title: "Rules", href: "/terms" },
]

export const localSeoLandingLinks = [
  {
    title: "Hostel in Pulivendula",
    href: "/pulivendula-boys-hostel",
    description: "Compare boys hostel stay options for students and employees near Palem Street and Royals Road.",
  },
  {
    title: "Student hostel in Pulivendula",
    href: "/student-hostel-pulivendula",
    description: `Student hostel rooms with ₹${HOSTEL_FEES.student}/month pricing and daily essentials.`,
  },
  {
    title: "Employee hostel in Pulivendula",
    href: "/employee-hostel-pulivendula",
    description: `Employee accommodation with ₹${HOSTEL_FEES.employee}/month pricing and parking support.`,
  },
  {
    title: "Boys hostel in Tirupati",
    href: "/tirupati-boys-hostel",
    description: "Tirupati student and family search page for boys hostel accommodation, fees, and admission details.",
  },
  {
    title: "Hostel near colleges in Tirupati",
    href: "/hostel-near-colleges-tirupati",
    description: "College-focused hostel search page for students comparing rooms, food, WiFi, and monthly fees.",
  },
  {
    title: "Student accommodation in Tirupati",
    href: "/student-accommodation-tirupati",
    description: `Student accommodation search page with monthly fee guidance from ₹${HOSTEL_FEES.student}.`,
  },
] as const

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
    description: `Student fee ₹${HOSTEL_FEES.student}/month and employee plan ₹${HOSTEL_FEES.employee}/month.`,
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
    description: "Clean shared-room setup for daily study and work routines.",
    icon: "bed",
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
    title: "Student hostel rooms",
    price: HOSTEL_FEES.student,
    priceLabel: `₹${HOSTEL_FEES.student}/month`,
    description: "Affordable boys hostel rooms in Pulivendula with a study-friendly stay.",
    features: ["₹3,500 monthly fee", "Study-friendly stay", "Near college route"],
    icon: "graduation-cap",
  },
  {
    title: "Employee hostel accommodation",
    price: HOSTEL_FEES.employee,
    priceLabel: `₹${HOSTEL_FEES.employee}/month`,
    description: "Comfortable Pulivendula stay option for employees and working professionals.",
    features: ["₹5,000 monthly fee", "Parking support", "Work-friendly stay"],
    icon: "briefcase-business",
  },
]

export const fallbackGalleryItems: GalleryItem[] = [
  {
    title: "Exterior",
    category: "exterior-surroundings",
    alt: "Sadhana Boys Hostel exterior view in Pulivendula",
    imageUrl: hostelGalleryImages[0],
  },
  {
    title: "Courtyard",
    category: "open-space-terrace",
    alt: "Sadhana Boys Hostel common courtyard area in Pulivendula",
    imageUrl: hostelGalleryImages[2],
  },
  {
    title: "Night view",
    category: "exterior-surroundings",
    alt: "Sadhana Boys Hostel night view in Pulivendula",
    imageUrl: hostelGalleryImages[1],
  },
  {
    title: "Student rooms",
    category: "student-room",
    alt: "Student room setup at Sadhana Boys Hostel Pulivendula",
    imageUrl: hostelGalleryImages[5],
  },
  {
    title: "Employee rooms",
    category: "employee-room",
    alt: "Employee room setup at Sadhana Boys Hostel Pulivendula",
    imageUrl: hostelGalleryImages[1],
  },
  {
    title: "Water facility",
    category: "open-space-terrace",
    alt: "Water facility and common amenities at Sadhana Boys Hostel Pulivendula",
    imageUrl: hostelGalleryImages[4],
  },
  {
    title: "Dining area",
    category: "open-space-terrace",
    alt: "Dining area for residents at Sadhana Boys Hostel Pulivendula",
    imageUrl: hostelGalleryImages[3],
  },
  {
    title: "Terrace",
    category: "open-space-terrace",
    alt: "Sadhana Boys Hostel terrace common area in Pulivendula",
    imageUrl: hostelGalleryImages[1],
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
    question: "What is the monthly fee for students at Sadhana Boys Hostel?",
    answer: `The student hostel fee is ₹${HOSTEL_FEES.student}/month at Sadhana Boys Hostel in Pulivendula.`,
  },
  {
    question: "Where is Sadhana Boys Hostel located in Pulivendula?",
    answer: `${HOSTEL_LOCATION.address}. The hostel is on ${HOSTEL_LOCATION.note}.`,
  },
  {
    question: "Is accommodation available for employees and working professionals?",
    answer: `Yes. Employee and working professional hostel accommodation is available at ₹${HOSTEL_FEES.employee}/month.`,
  },
  {
    question: "What facilities are available at the hostel?",
    answer:
      "The hostel provides food, WiFi, CCTV monitoring, water facilities, parking support, and clean student-friendly rooms.",
  },
  {
    question: "Are electronic heaters or iron boxes allowed?",
    answer: "No. Electronic devices such as iron boxes and heaters are not allowed.",
  },
] as const

export const termsAndRules = [...HOSTEL_RULES]
