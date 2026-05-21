import { loadEnvConfig } from "@next/env"
import { createClient, type User } from "@supabase/supabase-js"

import type { Database } from "../../src/types/database"

loadEnvConfig(process.cwd(), true)

type AppRole = Database["public"]["Enums"]["user_role_enum"]
type SupabaseAdminClient = ReturnType<typeof createClient<Database>>

const QA_ROOM_NUMBER = "QA-AUTH-ROOM"

async function main() {
  if (process.env.AUTH_TEST_SEED_ENABLED !== "true") {
    throw new Error(
      "Refusing to create auth test users. Set AUTH_TEST_SEED_ENABLED=true in a local/staging shell when you intentionally want to seed QA accounts."
    )
  }

  const supabaseUrl = requireEnv("NEXT_PUBLIC_SUPABASE_URL")
  const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY")
  const adminEmail = requireEnv("E2E_ADMIN_EMAIL")
  const adminPassword = requireStrongPassword("E2E_ADMIN_PASSWORD")
  const residentEmail = requireEnv("E2E_RESIDENT_EMAIL")
  const residentPassword = requireStrongPassword("E2E_RESIDENT_PASSWORD")

  const db = createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      headers: {
        "X-Client-Info": "sadhana-hostel-auth-qa-seed",
      },
    },
  })
  const tenant = await resolveTenant(db)
  const adminUser = await upsertAuthUser(db, {
    email: adminEmail,
    password: adminPassword,
    fullName: "QA Admin",
  })
  const residentUser = await upsertAuthUser(db, {
    email: residentEmail,
    password: residentPassword,
    fullName: "QA Resident",
  })

  await upsertAppUser(db, {
    id: adminUser.id,
    email: adminEmail,
    fullName: "QA Admin",
    role: "admin",
    organizationId: tenant.organizationId,
  })
  await upsertRole(db, {
    userId: adminUser.id,
    organizationId: tenant.organizationId,
    hostelId: tenant.hostelId,
    role: "admin",
  })

  await upsertAppUser(db, {
    id: residentUser.id,
    email: residentEmail,
    fullName: "QA Resident",
    role: "resident",
    organizationId: tenant.organizationId,
  })
  await upsertRole(db, {
    userId: residentUser.id,
    organizationId: tenant.organizationId,
    hostelId: tenant.hostelId,
    role: "resident",
  })

  const room = await ensureQaRoom(db, tenant.organizationId, tenant.hostelId)
  const resident = await ensureResident(db, {
    userId: residentUser.id,
    email: residentEmail,
    organizationId: tenant.organizationId,
    hostelId: tenant.hostelId,
  })
  const allocation = await ensureRoomAllocation(db, {
    organizationId: tenant.organizationId,
    hostelId: tenant.hostelId,
    roomId: room.id,
    residentId: resident.id,
  })
  const feeRecord = await ensureMonthlyFeeRecord(db, {
    organizationId: tenant.organizationId,
    hostelId: tenant.hostelId,
    residentId: resident.id,
    roomAllocationId: allocation.id,
  })

  await ensurePayment(db, {
    organizationId: tenant.organizationId,
    hostelId: tenant.hostelId,
    residentId: resident.id,
    monthlyFeeRecordId: feeRecord.id,
    transactionId: `QA-PENDING-${resident.id.slice(0, 8)}`,
    amount: 100,
    status: "pending",
  })
  await ensurePayment(db, {
    organizationId: tenant.organizationId,
    hostelId: tenant.hostelId,
    residentId: resident.id,
    monthlyFeeRecordId: feeRecord.id,
    transactionId: `QA-VERIFIED-${resident.id.slice(0, 8)}`,
    amount: 100,
    status: "verified",
  })

  console.log(
    JSON.stringify(
      {
        ok: true,
        organizationId: tenant.organizationId,
        hostelId: tenant.hostelId,
        adminEmail,
        residentEmail,
        residentId: resident.id,
        roomId: room.id,
        note: "Passwords are read from E2E_ADMIN_PASSWORD and E2E_RESIDENT_PASSWORD. They are intentionally not printed.",
      },
      null,
      2
    )
  )
}

function requireEnv(name: string) {
  const value = process.env[name]?.trim()

  if (!value) {
    throw new Error(`${name} is required.`)
  }

  return value
}

function requireStrongPassword(name: string) {
  const value = requireEnv(name)

  if (value.length < 12 || /change-me|password|123456/i.test(value)) {
    throw new Error(`${name} must be at least 12 characters and not a placeholder.`)
  }

  return value
}

async function resolveTenant(db: SupabaseAdminClient) {
  const organizationId =
    process.env.NEXT_PUBLIC_DEFAULT_ORGANIZATION_ID?.trim() ||
    (await getDefaultOrganizationId(db))
  const hostelId =
    process.env.NEXT_PUBLIC_DEFAULT_HOSTEL_ID?.trim() ||
    (await getDefaultHostelId(db, organizationId))

  if (!organizationId || !hostelId) {
    throw new Error("Unable to resolve default organization/hostel. Run migrations and seed data first.")
  }

  return { organizationId, hostelId }
}

async function getDefaultOrganizationId(db: SupabaseAdminClient) {
  const { data, error } = await db
    .from("organizations")
    .select("id")
    .eq("slug", "sadhana-boys-hostel")
    .is("deleted_at", null)
    .maybeSingle()

  if (error) {
    throw error
  }

  return data?.id
}

async function getDefaultHostelId(db: SupabaseAdminClient, organizationId?: string) {
  if (!organizationId) {
    return undefined
  }

  const { data, error } = await db
    .from("hostels")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("code", "SBH-MAIN")
    .is("deleted_at", null)
    .maybeSingle()

  if (error) {
    throw error
  }

  return data?.id
}

async function upsertAuthUser(
  db: SupabaseAdminClient,
  input: { email: string; password: string; fullName: string }
) {
  const existing = await findAuthUserByEmail(db, input.email)

  if (existing) {
    const { data, error } = await db.auth.admin.updateUserById(existing.id, {
      password: input.password,
      email_confirm: true,
      user_metadata: {
        full_name: input.fullName,
        qa_seed: true,
      },
    })

    if (error) {
      throw error
    }

    return data.user
  }

  const { data, error } = await db.auth.admin.createUser({
    email: input.email,
    password: input.password,
    email_confirm: true,
    user_metadata: {
      full_name: input.fullName,
      qa_seed: true,
    },
  })

  if (error) {
    throw error
  }

  return data.user
}

async function findAuthUserByEmail(db: SupabaseAdminClient, email: string) {
  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await db.auth.admin.listUsers({
      page,
      perPage: 1000,
    })

    if (error) {
      throw error
    }

    const found = data.users.find(
      (user: User) => user.email?.toLowerCase() === email.toLowerCase()
    )

    if (found || data.users.length < 1000) {
      return found ?? null
    }
  }

  return null
}

async function upsertAppUser(
  db: SupabaseAdminClient,
  input: {
    id: string
    email: string
    fullName: string
    role: AppRole
    organizationId: string
  }
) {
  const { error } = await db.from("users").upsert({
    id: input.id,
    organization_id: input.organizationId,
    full_name: input.fullName,
    email: input.email,
    default_role: input.role,
    is_active: true,
    metadata: {
      qa_seed: true,
      updated_by_script: "scripts/auth/create-auth-test-users.ts",
    },
  })

  if (error) {
    throw error
  }
}

async function upsertRole(
  db: SupabaseAdminClient,
  input: {
    userId: string
    organizationId: string
    hostelId: string
    role: AppRole
  }
) {
  const { data: existing, error: lookupError } = await db
    .from("user_roles")
    .select("id")
    .eq("organization_id", input.organizationId)
    .eq("hostel_id", input.hostelId)
    .eq("user_id", input.userId)
    .eq("role", input.role)
    .is("deleted_at", null)
    .maybeSingle()

  if (lookupError) {
    throw lookupError
  }

  if (existing) {
    const { error } = await db
      .from("user_roles")
      .update({
        status: "active",
        accepted_at: new Date().toISOString(),
      })
      .eq("id", existing.id)

    if (error) {
      throw error
    }

    return
  }

  const { error } = await db.from("user_roles").insert({
    organization_id: input.organizationId,
    hostel_id: input.hostelId,
    user_id: input.userId,
    role: input.role,
    permissions: [],
    status: "active",
    accepted_at: new Date().toISOString(),
  })

  if (error) {
    throw error
  }
}

async function ensureQaRoom(
  db: SupabaseAdminClient,
  organizationId: string,
  hostelId: string
) {
  const { data, error } = await db
    .from("rooms")
    .upsert(
      {
        organization_id: organizationId,
        hostel_id: hostelId,
        room_number: QA_ROOM_NUMBER,
        room_name: "QA Authentication Room",
        room_type: "qa",
        capacity: 4,
        base_monthly_fee: 7000,
        status: "active",
        is_active: true,
        metadata: {
          qa_seed: true,
        },
      },
      { onConflict: "hostel_id,room_number" }
    )
    .select("*")
    .single()

  if (error) {
    throw error
  }

  return data
}

async function ensureResident(
  db: SupabaseAdminClient,
  input: {
    userId: string
    email: string
    organizationId: string
    hostelId: string
  }
) {
  const { data: existing, error: lookupError } = await db
    .from("residents")
    .select("*")
    .eq("user_id", input.userId)
    .is("deleted_at", null)
    .maybeSingle()

  if (lookupError) {
    throw lookupError
  }

  if (existing) {
    return existing
  }

  const { data, error } = await db
    .from("residents")
    .insert({
      organization_id: input.organizationId,
      hostel_id: input.hostelId,
      user_id: input.userId,
      resident_type: "student",
      admission_number: `QA-${input.userId.slice(0, 8).toUpperCase()}`,
      full_name: "QA Resident",
      phone: "9000000001",
      email: input.email,
      parent_name: "QA Parent",
      parent_phone: "9000000002",
      emergency_contact_name: "QA Emergency",
      emergency_contact_phone: "9000000003",
      status: "active",
      joined_on: new Date().toISOString().slice(0, 10),
      monthly_fee_amount: 7000,
      security_deposit_amount: 1000,
      is_active: true,
      metadata: {
        qa_seed: true,
      },
    })
    .select("*")
    .single()

  if (error) {
    throw error
  }

  return data
}

async function ensureRoomAllocation(
  db: SupabaseAdminClient,
  input: {
    organizationId: string
    hostelId: string
    roomId: string
    residentId: string
  }
) {
  const { data: existing, error: lookupError } = await db
    .from("room_allocations")
    .select("*")
    .eq("organization_id", input.organizationId)
    .eq("resident_id", input.residentId)
    .eq("status", "active")
    .is("deleted_at", null)
    .maybeSingle()

  if (lookupError) {
    throw lookupError
  }

  if (existing) {
    return existing
  }

  const { data, error } = await db
    .from("room_allocations")
    .insert({
      organization_id: input.organizationId,
      hostel_id: input.hostelId,
      resident_id: input.residentId,
      room_id: input.roomId,
      bed_label: "QA-1",
      allocated_from: new Date().toISOString().slice(0, 10),
      status: "active",
      monthly_fee_amount: 7000,
      reason: "QA auth flow seed",
    })
    .select("*")
    .single()

  if (error) {
    throw error
  }

  return data
}

async function ensureMonthlyFeeRecord(
  db: SupabaseAdminClient,
  input: {
    organizationId: string
    hostelId: string
    residentId: string
    roomAllocationId: string
  }
) {
  const now = new Date()
  const periodMonth = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-01`
  const dueDate = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-10`
  const { data: existing, error: lookupError } = await db
    .from("monthly_fee_records")
    .select("*")
    .eq("resident_id", input.residentId)
    .eq("period_month", periodMonth)
    .is("deleted_at", null)
    .maybeSingle()

  if (lookupError) {
    throw lookupError
  }

  if (existing) {
    return existing
  }

  const { data, error } = await db
    .from("monthly_fee_records")
    .insert({
      organization_id: input.organizationId,
      hostel_id: input.hostelId,
      resident_id: input.residentId,
      room_allocation_id: input.roomAllocationId,
      period_month: periodMonth,
      due_date: dueDate,
      base_amount: 7000,
      total_amount: 7000,
      balance_amount: 7000,
      status: "pending",
      notes: "QA auth flow seed fee record",
      metadata: {
        qa_seed: true,
      },
    })
    .select("*")
    .single()

  if (error) {
    throw error
  }

  return data
}

async function ensurePayment(
  db: SupabaseAdminClient,
  input: {
    organizationId: string
    hostelId: string
    residentId: string
    monthlyFeeRecordId: string
    transactionId: string
    amount: number
    status: "pending" | "verified"
  }
) {
  const { data: existing, error: lookupError } = await db
    .from("payments")
    .select("id")
    .eq("organization_id", input.organizationId)
    .eq("transaction_id", input.transactionId)
    .is("deleted_at", null)
    .maybeSingle()

  if (lookupError) {
    throw lookupError
  }

  if (existing) {
    return
  }

  const verifiedAt = input.status === "verified" ? new Date().toISOString() : null
  const { error } = await db.from("payments").insert({
    organization_id: input.organizationId,
    hostel_id: input.hostelId,
    resident_id: input.residentId,
    monthly_fee_record_id: input.monthlyFeeRecordId,
    amount: input.amount,
    method: "upi",
    status: input.status,
    transaction_id: input.transactionId,
    provider: "upi",
    paid_at: verifiedAt,
    verified_at: verifiedAt,
    notes: "QA auth flow seed payment",
    metadata: {
      qa_seed: true,
    },
  })

  if (error) {
    throw error
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
