import { HOSTEL_FEES, HOSTEL_LOCATION } from "@/constants/hostel"
import type { MockLeaveRequest, MockNotice, MockPayment, MockResident } from "@/types/frontend"

export const currentResident: MockResident = {
  id: "resident-ramesh",
  name: "Ramesh Kumar",
  residentType: "student",
  phone: "9876543210",
  roomNumber: "S-204",
  feeAmount: HOSTEL_FEES.student,
  paymentStatus: "paid",
  joiningDate: "2025-06-12",
  status: "active",
}

export const currentRoomDetails = {
  roomNumber: "S-204",
  floor: "Second Floor",
  sharingType: "4 sharing",
  monthlyFee: HOSTEL_FEES.student,
  locationNote: HOSTEL_LOCATION.note,
} as const

export const currentFeeStatus = {
  month: "May 2026",
  amount: HOSTEL_FEES.student,
  dueDate: "2026-05-05",
  status: "paid",
  lastPaidOn: "2026-05-04",
} as const

export const residentPaymentHistory: MockPayment[] = [
  {
    id: "payment-001",
    residentName: currentResident.name,
    amount: HOSTEL_FEES.student,
    month: "May 2026",
    paidOn: "2026-05-04",
    dueDate: "2026-05-05",
    status: "paid",
    mode: "upi",
  },
  {
    id: "payment-000",
    residentName: currentResident.name,
    amount: HOSTEL_FEES.student,
    month: "April 2026",
    paidOn: "2026-04-03",
    dueDate: "2026-04-05",
    status: "paid",
    mode: "cash",
  },
]

export const residentLeaveHistory: MockLeaveRequest[] = [
  {
    id: "leave-001",
    residentName: currentResident.name,
    fromDate: "2026-05-24",
    toDate: "2026-05-26",
    reason: "Family function",
    status: "pending",
  },
  {
    id: "leave-000",
    residentName: currentResident.name,
    fromDate: "2026-04-12",
    toDate: "2026-04-14",
    reason: "Festival visit",
    status: "returned",
  },
]

export const residentNotices: MockNotice[] = [
  {
    id: "notice-001",
    title: "Monthly fee reminder",
    description: "Please clear May hostel fees before the due date.",
    publishedAt: "2026-05-01",
    audience: "all",
    pinned: true,
  },
  {
    id: "notice-002",
    title: "Holiday travel rule",
    description: "Residents with 3 days or more holidays must go home as per hostel rules.",
    publishedAt: "2026-05-10",
    audience: "students",
  },
]

export const supportRequestPlaceholders = [
  {
    id: "support-001",
    title: "WiFi speed issue",
    status: "open",
    createdAt: "2026-05-18",
  },
  {
    id: "support-002",
    title: "Room cleaning request",
    status: "resolved",
    createdAt: "2026-05-12",
  },
] as const
