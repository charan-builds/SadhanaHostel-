import { createClient } from "@supabase/supabase-js"

import type { Database } from "../src/types/database"
import {
  createFeeRecords,
  createInvoices,
  createLeaveRequests,
  createNotices,
  createPayments,
  createResidents,
  createRoomAllocations,
  createRooms,
  type SeedContext,
} from "./staging/factories"

type RoomSeedRow = {
  id: string
  capacity: number
}

type ResidentSeedRow = {
  id: string
  monthly_fee_amount: number | null
}

type AllocationSeedRow = {
  id: string
  resident_id: string
}

type FeeRecordSeedRow = {
  id: string
  resident_id: string
  total_amount: number
  paid_amount: number
  balance_amount: number
  period_month: string
  due_date: string
}

async function main() {
  assertStaging()

  const context: SeedContext = {
    organizationId: requiredEnv("STAGING_SEED_ORGANIZATION_ID"),
    hostelId: requiredEnv("STAGING_SEED_HOSTEL_ID"),
    runId: process.env.STAGING_SEED_RUN_ID ?? createRunId(),
  }
  const residentCount = Number(process.env.STAGING_SEED_RESIDENT_COUNT ?? 120)
  const roomCount = Number(process.env.STAGING_SEED_ROOM_COUNT ?? 36)
  const supabase = createClient<Database>(
    requiredEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  )

  console.log(
    JSON.stringify(
      {
        event: "staging_seed.started",
        runId: context.runId,
        residentCount,
        roomCount,
      },
      null,
      2
    )
  )

  const rooms = await insertRooms(supabase, createRooms(context, roomCount))
  const residents = await insertResidents(
    supabase,
    createResidents(context, residentCount)
  )
  const allocations = await insertAllocations(
    supabase,
    createRoomAllocations(context, residents, rooms, 0.86)
  )
  const feeRecords = await insertFeeRecords(
    supabase,
    createFeeRecords(context, residents, allocations, 6)
  )
  const payments = await insertPayments(supabase, createPayments(context, feeRecords))
  const invoices = await insertInvoices(supabase, createInvoices(context, feeRecords))
  const leaves = await insertLeaves(
    supabase,
    createLeaveRequests(context, residents, Math.min(40, residents.length))
  )
  const notices = await insertNotices(supabase, createNotices(context))

  console.log(
    JSON.stringify(
      {
        event: "staging_seed.completed",
        runId: context.runId,
        inserted: {
          rooms: rooms.length,
          residents: residents.length,
          roomAllocations: allocations.length,
          feeRecords: feeRecords.length,
          payments: payments.length,
          invoices: invoices.length,
          leaveRequests: leaves.length,
          notices: notices.length,
        },
      },
      null,
      2
    )
  )
}

async function insertRooms(
  supabase: ReturnType<typeof createClient<Database>>,
  rows: ReturnType<typeof createRooms>
) {
  const { data, error } = await supabase
    .from("rooms")
    .insert(rows)
    .select("id, capacity")

  if (error) {
    throw new Error(`Failed to seed rooms: ${error.message}`)
  }

  return (data ?? []) as RoomSeedRow[]
}

async function insertResidents(
  supabase: ReturnType<typeof createClient<Database>>,
  rows: ReturnType<typeof createResidents>
) {
  const { data, error } = await supabase
    .from("residents")
    .insert(rows)
    .select("id, monthly_fee_amount")

  if (error) {
    throw new Error(`Failed to seed residents: ${error.message}`)
  }

  return (data ?? []) as ResidentSeedRow[]
}

async function insertAllocations(
  supabase: ReturnType<typeof createClient<Database>>,
  rows: ReturnType<typeof createRoomAllocations>
) {
  const { data, error } = await supabase
    .from("room_allocations")
    .insert(rows)
    .select("id, resident_id")

  if (error) {
    throw new Error(`Failed to seed room allocations: ${error.message}`)
  }

  return (data ?? []) as AllocationSeedRow[]
}

async function insertFeeRecords(
  supabase: ReturnType<typeof createClient<Database>>,
  rows: ReturnType<typeof createFeeRecords>
) {
  const { data, error } = await supabase
    .from("monthly_fee_records")
    .insert(rows)
    .select("id, resident_id, total_amount, paid_amount, balance_amount, period_month, due_date")

  if (error) {
    throw new Error(`Failed to seed monthly fee records: ${error.message}`)
  }

  return (data ?? []) as FeeRecordSeedRow[]
}

async function insertPayments(
  supabase: ReturnType<typeof createClient<Database>>,
  rows: ReturnType<typeof createPayments>
) {
  const { data, error } = await supabase.from("payments").insert(rows).select("id")

  if (error) {
    throw new Error(`Failed to seed payments: ${error.message}`)
  }

  return data ?? []
}

async function insertInvoices(
  supabase: ReturnType<typeof createClient<Database>>,
  rows: ReturnType<typeof createInvoices>
) {
  const { data, error } = await supabase.from("invoices").insert(rows).select("id")

  if (error) {
    throw new Error(`Failed to seed invoices: ${error.message}`)
  }

  return data ?? []
}

async function insertLeaves(
  supabase: ReturnType<typeof createClient<Database>>,
  rows: ReturnType<typeof createLeaveRequests>
) {
  const { data, error } = await supabase.from("leave_requests").insert(rows).select("id")

  if (error) {
    throw new Error(`Failed to seed leave requests: ${error.message}`)
  }

  return data ?? []
}

async function insertNotices(
  supabase: ReturnType<typeof createClient<Database>>,
  rows: ReturnType<typeof createNotices>
) {
  const { data, error } = await supabase.from("notices").insert(rows).select("id")

  if (error) {
    throw new Error(`Failed to seed notices: ${error.message}`)
  }

  return data ?? []
}

function assertStaging() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ""
  const allowProductionSeed = process.env.ALLOW_PRODUCTION_SEED === "true"

  if (allowProductionSeed) {
    throw new Error("Production seeding is blocked. Remove ALLOW_PRODUCTION_SEED.")
  }

  if (!appUrl.includes("staging") && process.env.NODE_ENV !== "development") {
    throw new Error(
      "Refusing to seed non-staging environment. Set NEXT_PUBLIC_APP_URL to a staging URL."
    )
  }
}

function requiredEnv(name: string) {
  const value = process.env[name]

  if (!value) {
    throw new Error(`${name} is required.`)
  }

  return value
}

function createRunId() {
  return new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 12)
}

void main().catch((error) => {
  console.error(error)
  process.exit(1)
})
