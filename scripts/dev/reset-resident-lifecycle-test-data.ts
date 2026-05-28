import { loadEnvConfig } from "@next/env"
import { createClient } from "@supabase/supabase-js"

import { normalizePhoneNumber, tryNormalizePhoneNumber } from "../../src/lib/identity"

loadEnvConfig(process.cwd())

type ResidentRow = {
  id: string
  organization_id: string
  hostel_id: string | null
  full_name: string
  phone: string | null
  email: string | null
  status: string
  onboarding_status?: string | null
  user_id: string | null
}

const execute = process.argv.includes("--execute")
const allowDestructiveReset = process.env.ALLOW_DESTRUCTIVE_TEST_RESET === "true"
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const residentId = process.env.TEST_RESET_RESIDENT_ID
const rawPhone = process.env.TEST_RESET_PHONE
const email = process.env.TEST_RESET_EMAIL?.trim().toLowerCase()
const emailDomain = process.env.TEST_RESET_EMAIL_DOMAIN?.trim().toLowerCase()
const phone = rawPhone ? normalizePhoneNumber(rawPhone) : undefined

if (!allowDestructiveReset) {
  fail("Set ALLOW_DESTRUCTIVE_TEST_RESET=true before running this dev/test reset.")
}

if (!execute) {
  console.warn("Dry run only. Re-run with --execute to apply cleanup.")
}

if (!supabaseUrl || !serviceRoleKey) {
  fail("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.")
}

if (!residentId && !phone && !email && !emailDomain) {
  fail("Provide TEST_RESET_RESIDENT_ID, TEST_RESET_PHONE, TEST_RESET_EMAIL, or TEST_RESET_EMAIL_DOMAIN.")
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
  global: {
    headers: {
      "X-Client-Info": "sadhana-hostel-resident-lifecycle-reset",
    },
  },
})

async function main() {
  const residents = await findResidents()
  const residentIds = residents.map((resident) => resident.id)
  const organizationIds = [...new Set(residents.map((resident) => resident.organization_id))]

  console.info(JSON.stringify({
    execute,
    matchedResidents: residents.map((resident) => ({
      id: resident.id,
      organizationId: resident.organization_id,
      hostelId: resident.hostel_id,
      name: resident.full_name,
      phone: resident.phone,
      email: resident.email,
      status: resident.status,
      onboardingStatus: resident.onboarding_status,
      userId: resident.user_id,
    })),
  }, null, 2))

  if (!execute || residentIds.length === 0) {
    return
  }

  await revokeInvites(residentIds)
  await closeAllocations(residentIds)
  await cancelInvalidDues(residentIds)
  await archiveResidents(residentIds)
  await deleteMatchingAuthUsers(residents)

  for (const organizationId of organizationIds) {
    await supabase.rpc("repair_onboarding_access_consistency_atomic" as never, {
      p_organization_id: organizationId,
      p_hostel_id: null,
      p_limit: 100,
      p_actor_user_id: null,
    } as never)
  }

  console.info("Resident lifecycle test data reset complete.")
}

async function findResidents() {
  let query = supabase
    .from("residents")
    .select("*")
    .is("deleted_at", null)

  if (residentId) {
    query = query.eq("id", residentId)
  } else if (phone) {
    query = query.eq("phone", phone)
  } else if (email) {
    query = query.ilike("email", email)
  } else if (emailDomain) {
    query = query.ilike("email", `%@${emailDomain}`)
  }

  const { data, error } = await query.limit(100)

  if (error) {
    throw error
  }

  return data as unknown as ResidentRow[]
}

async function revokeInvites(residentIds: string[]) {
  const { error } = await supabase
    .from("resident_invites")
    .update({
      status: "revoked",
      revoked_at: new Date().toISOString(),
      metadata: {
        reset_reason: "dev_test_resident_lifecycle_reset",
      },
    })
    .in("resident_id", residentIds)
    .eq("status", "pending")

  if (error) {
    throw error
  }
}

async function closeAllocations(residentIds: string[]) {
  const { error } = await supabase
    .from("room_allocations")
    .update({
      status: "completed",
      allocated_to: new Date().toISOString().slice(0, 10),
      reason: "Closed by dev/test resident lifecycle reset.",
    })
    .in("resident_id", residentIds)
    .eq("status", "active")

  if (error) {
    throw error
  }
}

async function cancelInvalidDues(residentIds: string[]) {
  const { error } = await supabase
    .from("monthly_fee_records")
    .update({
      status: "cancelled",
      balance_amount: 0,
      notes: "Cancelled by dev/test resident lifecycle reset.",
    })
    .in("resident_id", residentIds)
    .in("status", ["pending", "overdue"])
    .eq("paid_amount", 0)

  if (error) {
    throw error
  }
}

async function archiveResidents(residentIds: string[]) {
  const { error } = await supabase
    .from("residents")
    .update({
      status: "archived",
      is_active: false,
      deleted_at: new Date().toISOString(),
      onboarding_metadata: {
        reset_reason: "dev_test_resident_lifecycle_reset",
      },
    })
    .in("id", residentIds)

  if (error) {
    throw error
  }
}

async function deleteMatchingAuthUsers(residents: ResidentRow[]) {
  const candidates = new Map<string, string>()
  let page = 1

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 })

    if (error) {
      throw error
    }

    for (const user of data.users) {
      if (matchesResidentAuthIdentity(user, residents)) {
        candidates.set(user.id, user.email ?? user.phone ?? user.id)
      }
    }

    if (data.users.length < 1000) {
      break
    }

    page += 1
  }

  console.info(`Matched ${candidates.size} auth users for deletion.`)

  for (const authUserId of candidates.keys()) {
    const { error } = await supabase.auth.admin.deleteUser(authUserId)

    if (error) {
      throw error
    }
  }
}

function matchesResidentAuthIdentity(
  user: Awaited<ReturnType<typeof supabase.auth.admin.listUsers>>["data"]["users"][number],
  residents: ResidentRow[]
) {
  const metadataResidentId = String(user.user_metadata?.resident_id ?? "")
  const userPhone = tryNormalizePhoneNumber(user.phone)
  const userEmail = user.email?.toLowerCase() ?? null

  return residents.some((resident) => {
    return (
      resident.user_id === user.id ||
      metadataResidentId === resident.id ||
      (resident.phone && userPhone === tryNormalizePhoneNumber(resident.phone)) ||
      (resident.email && userEmail === resident.email.toLowerCase())
    )
  })
}

function fail(message: string): never {
  console.error(message)
  process.exit(1)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
