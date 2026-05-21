import type { TablesInsert } from "../../src/types/database"

export type SeedContext = {
  organizationId: string
  hostelId: string
  runId: string
}

const FIRST_NAMES = [
  "Aarav",
  "Arjun",
  "Dev",
  "Ishan",
  "Kabir",
  "Karthik",
  "Nikhil",
  "Rahul",
  "Rohan",
  "Siddharth",
  "Varun",
  "Vikram",
]

const LAST_NAMES = [
  "Reddy",
  "Sharma",
  "Patel",
  "Kumar",
  "Gupta",
  "Naidu",
  "Rao",
  "Singh",
  "Verma",
  "Yadav",
]

export function createRooms(
  context: SeedContext,
  count: number
): TablesInsert<"rooms">[] {
  return Array.from({ length: count }, (_, index) => {
    const floor = Math.floor(index / 12) + 1
    const roomNumber = `${floor}${String((index % 12) + 1).padStart(2, "0")}`
    const capacity = index % 5 === 0 ? 2 : index % 3 === 0 ? 3 : 4

    return {
      organization_id: context.organizationId,
      hostel_id: context.hostelId,
      room_number: `${context.runId}-${roomNumber}`,
      room_name: `Room ${roomNumber}`,
      room_type: capacity === 2 ? "double-sharing" : "shared",
      floor: String(floor),
      block_name: index % 2 === 0 ? "A Block" : "B Block",
      capacity,
      base_monthly_fee: capacity === 2 ? 9000 : capacity === 3 ? 7500 : 6500,
      has_attached_bathroom: index % 4 === 0,
      has_ac: index % 7 === 0,
      status: "active",
      metadata: {
        seed_run_id: context.runId,
      },
    }
  })
}

export function createResidents(
  context: SeedContext,
  count: number
): TablesInsert<"residents">[] {
  return Array.from({ length: count }, (_, index) => {
    const fullName = `${FIRST_NAMES[index % FIRST_NAMES.length]} ${
      LAST_NAMES[index % LAST_NAMES.length]
    }`
    const admission = `${context.runId}-RES-${String(index + 1).padStart(4, "0")}`

    return {
      organization_id: context.organizationId,
      hostel_id: context.hostelId,
      resident_type: index % 9 === 0 ? "employee" : "student",
      admission_number: admission,
      full_name: fullName,
      preferred_name: fullName.split(" ")[0],
      gender: "male",
      phone: `90000${String(index + 1).padStart(5, "0")}`,
      email: `resident.${context.runId}.${index + 1}@example.com`,
      aadhaar_last4: String(1000 + (index % 9000)).padStart(4, "0"),
      parent_name: `Parent ${LAST_NAMES[index % LAST_NAMES.length]}`,
      parent_phone: `91000${String(index + 1).padStart(5, "0")}`,
      parent_email: `parent.${context.runId}.${index + 1}@example.com`,
      emergency_contact_name: `Emergency ${index + 1}`,
      emergency_contact_phone: `92000${String(index + 1).padStart(5, "0")}`,
      permanent_address: `${index + 1}, Staging Colony, Hyderabad`,
      status: "active",
      joined_on: shiftDate(-120 + (index % 60)),
      monthly_fee_amount: index % 9 === 0 ? 8500 : 6500,
      security_deposit_amount: 10000,
      metadata: {
        seed_run_id: context.runId,
      },
    }
  })
}

export function createRoomAllocations(
  context: SeedContext,
  residents: Array<{ id: string; monthly_fee_amount: number | null }>,
  rooms: Array<{ id: string; capacity: number }>,
  occupancyRatio: number
): TablesInsert<"room_allocations">[] {
  const occupiedCount = Math.min(
    residents.length,
    Math.floor(residents.length * occupancyRatio)
  )
  const allocations: TablesInsert<"room_allocations">[] = []
  const roomOccupancy = new Map<string, number>()
  let roomCursor = 0

  for (let index = 0; index < occupiedCount; index += 1) {
    let room = rooms[roomCursor % rooms.length]
    let attempts = 0

    while ((roomOccupancy.get(room.id) ?? 0) >= room.capacity && attempts < rooms.length) {
      roomCursor += 1
      attempts += 1
      room = rooms[roomCursor % rooms.length]
    }

    const currentOccupancy = roomOccupancy.get(room.id) ?? 0
    roomOccupancy.set(room.id, currentOccupancy + 1)

    allocations.push({
      organization_id: context.organizationId,
      hostel_id: context.hostelId,
      resident_id: residents[index].id,
      room_id: room.id,
      bed_label: `B${currentOccupancy + 1}`,
      allocated_from: shiftDate(-90 + (index % 30)),
      status: "active",
      monthly_fee_amount: residents[index].monthly_fee_amount ?? 6500,
      reason: "Staging seed allocation",
    })
  }

  return allocations
}

export function createFeeRecords(
  context: SeedContext,
  residents: Array<{ id: string; monthly_fee_amount: number | null }>,
  allocations: Array<{ id: string; resident_id: string }>,
  months = 6
): TablesInsert<"monthly_fee_records">[] {
  const allocationByResident = new Map(
    allocations.map((allocation) => [allocation.resident_id, allocation.id])
  )
  const records: TablesInsert<"monthly_fee_records">[] = []

  for (const resident of residents) {
    for (let offset = months - 1; offset >= 0; offset -= 1) {
      const periodMonth = monthStart(-offset)
      const totalAmount = resident.monthly_fee_amount ?? 6500
      const paidAmount = offset > 1 ? totalAmount : offset === 1 ? Math.floor(totalAmount / 2) : 0
      const balanceAmount = totalAmount - paidAmount

      records.push({
        organization_id: context.organizationId,
        hostel_id: context.hostelId,
        resident_id: resident.id,
        room_allocation_id: allocationByResident.get(resident.id),
        period_month: periodMonth,
        due_date: withDay(periodMonth, 10),
        base_amount: totalAmount,
        total_amount: totalAmount,
        paid_amount: paidAmount,
        balance_amount: balanceAmount,
        status:
          balanceAmount === 0
            ? "paid"
            : paidAmount > 0
              ? "partial"
              : offset === 0
                ? "pending"
                : "overdue",
        notes: "Synthetic staging fee record",
        metadata: {
          seed_run_id: context.runId,
        },
      })
    }
  }

  return records
}

export function createPayments(
  context: SeedContext,
  feeRecords: Array<{
    id: string
    resident_id: string
    total_amount: number
    paid_amount: number
    period_month: string
  }>
): TablesInsert<"payments">[] {
  return feeRecords
    .filter((record) => record.paid_amount > 0)
    .map((record, index) => ({
      organization_id: context.organizationId,
      hostel_id: context.hostelId,
      resident_id: record.resident_id,
      monthly_fee_record_id: record.id,
      amount: record.paid_amount,
      method: index % 5 === 0 ? "cash" : "upi",
      status: "verified",
      transaction_id: `STG-${context.runId}-${String(index + 1).padStart(6, "0")}`,
      provider: index % 5 === 0 ? "cash" : "upi",
      is_partial: record.paid_amount < record.total_amount,
      paid_at: `${withDay(record.period_month, 8)}T10:00:00.000Z`,
      verified_at: `${withDay(record.period_month, 8)}T10:05:00.000Z`,
      notes: "Synthetic staging payment",
      metadata: {
        seed_run_id: context.runId,
      },
    }))
}

export function createInvoices(
  context: SeedContext,
  feeRecords: Array<{
    id: string
    resident_id: string
    total_amount: number
    paid_amount: number
    balance_amount: number
    period_month: string
    due_date: string
  }>
): TablesInsert<"invoices">[] {
  return feeRecords.slice(0, Math.min(feeRecords.length, 300)).map((record, index) => ({
    organization_id: context.organizationId,
    hostel_id: context.hostelId,
    resident_id: record.resident_id,
    monthly_fee_record_id: record.id,
    invoice_number: `STG-${context.runId}-${String(index + 1).padStart(6, "0")}`,
    status:
      record.balance_amount === 0
        ? "paid"
        : record.paid_amount > 0
          ? "partially_paid"
          : "issued",
    issue_date: withDay(record.period_month, 1),
    due_date: record.due_date,
    subtotal_amount: record.total_amount,
    total_amount: record.total_amount,
    paid_amount: record.paid_amount,
    balance_amount: record.balance_amount,
    metadata: {
      seed_run_id: context.runId,
      source: "staging_seed",
    },
  }))
}

export function createLeaveRequests(
  context: SeedContext,
  residents: Array<{ id: string }>,
  count: number
): TablesInsert<"leave_requests">[] {
  return residents.slice(0, count).map((resident, index) => {
    const status = index % 5 === 0 ? "rejected" : index % 3 === 0 ? "approved" : "pending"

    return {
      organization_id: context.organizationId,
      hostel_id: context.hostelId,
      resident_id: resident.id,
      from_date: shiftDate(2 + index),
      to_date: shiftDate(3 + index),
      reason: index % 2 === 0 ? "Family visit" : "Medical appointment",
      destination: index % 2 === 0 ? "Vijayawada" : "Hyderabad",
      travel_mode: index % 2 === 0 ? "bus" : "train",
      status,
      rejection_reason: status === "rejected" ? "Insufficient notice in staging scenario" : undefined,
      reviewed_at: status === "pending" ? undefined : new Date().toISOString(),
      metadata: {
        seed_run_id: context.runId,
      },
    }
  })
}

export function createNotices(context: SeedContext): TablesInsert<"notices">[] {
  return [
    {
      organization_id: context.organizationId,
      hostel_id: context.hostelId,
      title: "Staging Hostel Rules",
      body: "Synthetic notice for validating resident portal announcements.",
      status: "published",
      audience_type: "all",
      is_pinned: true,
      published_at: new Date().toISOString(),
    },
    {
      organization_id: context.organizationId,
      hostel_id: context.hostelId,
      title: "Payment Reminder",
      body: "Monthly fees are due by the 10th in this staging dataset.",
      status: "published",
      audience_type: "all",
      is_pinned: false,
      published_at: new Date().toISOString(),
    },
  ]
}

function shiftDate(offsetDays: number) {
  const date = new Date()
  date.setUTCDate(date.getUTCDate() + offsetDays)

  return date.toISOString().slice(0, 10)
}

function monthStart(offsetMonths: number) {
  const date = new Date()
  date.setUTCDate(1)
  date.setUTCHours(0, 0, 0, 0)
  date.setUTCMonth(date.getUTCMonth() + offsetMonths)

  return date.toISOString().slice(0, 10)
}

function withDay(monthStartDate: string, day: number) {
  const date = new Date(`${monthStartDate}T00:00:00.000Z`)
  date.setUTCDate(day)

  return date.toISOString().slice(0, 10)
}
