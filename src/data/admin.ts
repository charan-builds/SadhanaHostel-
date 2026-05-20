import { HOSTEL_FEES } from "@/constants/hostel"
import type {
  AdminMetric,
  MockLeaveRequest,
  MockNotice,
  MockPayment,
  MockResident,
} from "@/types/frontend"

export const adminDashboardMetrics: AdminMetric[] = [
  {
    label: "Active Residents",
    value: "42",
    detail: "Students and employees currently staying.",
    trend: "+4 this month",
  },
  {
    label: "Monthly Collection",
    value: "₹1,68,500",
    detail: "Collected for the current billing cycle.",
    trend: "82% collected",
  },
  {
    label: "Pending Leaves",
    value: "3",
    detail: "Requests waiting for admin review.",
  },
  {
    label: "Vacant Beds",
    value: "8",
    detail: "Available capacity across student and employee rooms.",
  },
]

export const mockResidents: MockResident[] = [
  {
    id: "resident-ramesh",
    name: "Ramesh Kumar",
    residentType: "student",
    phone: "9876543210",
    whatsappNumber: "9876543210",
    aadhaarNumber: "123456789012",
    parentName: "Kumaraswamy",
    parentPhone: "9876501234",
    emergencyContact: "9876501234",
    roomNumber: "S-204",
    feeAmount: HOSTEL_FEES.student,
    paymentStatus: "paid",
    joiningDate: "2025-06-12",
    allocationDate: "2025-06-12",
    status: "active",
    notes: "Study-focused resident with regular fee history.",
  },
  {
    id: "resident-suresh",
    name: "Suresh Naik",
    residentType: "employee",
    phone: "9123456780",
    whatsappNumber: "9123456780",
    aadhaarNumber: "987654321098",
    parentName: "Narasimha Naik",
    parentPhone: "9123409876",
    emergencyContact: "9123409876",
    roomNumber: "E-102",
    feeAmount: HOSTEL_FEES.employee,
    paymentStatus: "pending",
    joiningDate: "2025-09-01",
    allocationDate: "2025-09-01",
    status: "active",
    notes: "Employee resident using parking and vehicle access.",
  },
]

export const recentPayments: MockPayment[] = [
  {
    id: "payment-001",
    residentName: "Ramesh Kumar",
    amount: HOSTEL_FEES.student,
    month: "May 2026",
    paidOn: "2026-05-04",
    dueDate: "2026-05-05",
    status: "paid",
    mode: "upi",
  },
  {
    id: "payment-002",
    residentName: "Suresh Naik",
    amount: HOSTEL_FEES.employee,
    month: "May 2026",
    dueDate: "2026-05-05",
    status: "pending",
    mode: "cash",
  },
]

export const pendingLeaves: MockLeaveRequest[] = [
  {
    id: "leave-001",
    residentName: "Ramesh Kumar",
    fromDate: "2026-05-24",
    toDate: "2026-05-26",
    reason: "Family function",
    status: "pending",
    travelMode: "Bus",
  },
  {
    id: "leave-002",
    residentName: "Suresh Naik",
    fromDate: "2026-05-30",
    toDate: "2026-06-01",
    reason: "Personal work",
    status: "pending",
    travelMode: "Bike",
  },
]

export const pendingFeeResidents = mockResidents.filter(
  (resident) => resident.paymentStatus !== "paid",
)

export const mockRooms = [
  {
    id: "room-s-204",
    roomNumber: "S-204",
    floor: "Second Floor",
    residentType: "student",
    capacity: 4,
    occupied: 3,
    monthlyFee: HOSTEL_FEES.student,
  },
  {
    id: "room-e-102",
    roomNumber: "E-102",
    floor: "First Floor",
    residentType: "employee",
    capacity: 2,
    occupied: 1,
    monthlyFee: HOSTEL_FEES.employee,
  },
] as const

export const mockNotices: MockNotice[] = [
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
