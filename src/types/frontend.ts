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

export type RoomType = "student" | "employee" | "mixed"

export type MockResident = {
  id: string
  name: string
  residentType: ResidentType
  phone: string
  whatsappNumber?: string
  aadhaarNumber?: string
  parentName?: string
  parentPhone?: string
  emergencyContact?: string
  roomNumber: string
  feeAmount: number
  paymentStatus: PaymentStatus
  joiningDate: string
  allocationDate?: string
  status: ResidentStatus
  notes?: string
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

export type MockRoom = {
  id: string
  roomNumber: string
  floorNumber: string
  roomType: RoomType
  capacity: number
  occupiedCount: number
  monthlyFee: number
  hasAttachedBathroom: boolean
  status: RoomStatus
  currentResidentIds: string[]
  notes?: string
}

export type MockRoomAllocation = {
  id: string
  roomId: string
  residentId: string
  residentName: string
  allocatedDate: string
  vacatedDate?: string
  status: "active" | "vacated"
}
