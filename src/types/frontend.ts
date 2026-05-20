export type FacilityItem = {
  title: string
  description: string
  icon: string
}

export type RoomTypeCard = {
  title: string
  price: number
  priceLabel: string
  description: string
  features: string[]
  icon: string
}

export type GalleryItem = {
  title: string
  category: string
  alt: string
  imageUrl?: string
}

export type TestimonialItem = {
  name: string
  role: string
  quote: string
}

export type PublicNavItem = {
  title: string
  href: string
}

export type AdminMetric = {
  label: string
  value: string
  detail: string
  trend?: string
}

export type PaymentStatus =
  | "paid"
  | "pending"
  | "partial"
  | "verification_pending"
  | "rejected"
  | "failed"
  | "overdue"

export type LeaveStatus = "pending" | "approved" | "rejected" | "cancelled" | "returned"

export type ResidentStatus = "active" | "inactive" | "left" | "suspended" | "pending"

export type RoomStatus = "available" | "full" | "maintenance" | "inactive"

export type FrontendStatus = PaymentStatus | LeaveStatus | ResidentStatus | RoomStatus

export type ResidentType = "student" | "employee"

export type MockResident = {
  id: string
  name: string
  residentType: ResidentType
  phone: string
  roomNumber: string
  feeAmount: number
  paymentStatus: PaymentStatus
  joiningDate: string
  status: ResidentStatus
}

export type MockPayment = {
  id: string
  residentName: string
  amount: number
  month: string
  paidOn?: string
  dueDate: string
  status: PaymentStatus
  mode: "cash" | "upi" | "bank-transfer" | "online"
}

export type MockLeaveRequest = {
  id: string
  residentName: string
  fromDate: string
  toDate: string
  reason: string
  status: LeaveStatus
  travelMode?: string
}

export type MockNotice = {
  id: string
  title: string
  description: string
  publishedAt: string
  audience: "all" | "students" | "employees"
  pinned?: boolean
}
