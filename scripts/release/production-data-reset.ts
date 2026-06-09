import { existsSync, readFileSync } from "node:fs"
import { writeFile } from "node:fs/promises"

import { loadEnvConfig } from "@next/env"
import type { WebSocketLikeConstructor } from "@supabase/realtime-js"
import { createClient } from "@supabase/supabase-js"
import { Client } from "pg"
import WebSocket from "ws"

type CountMap = Record<string, number>

type SafetySettings = {
  launch_mode: string
  next_public_launch_mode: string
  destructive_operations_enabled: boolean
}

type DeleteStep =
  | {
      table: string
      sql: string
      params?: unknown[]
    }
  | {
      table: string
      sql: (exists: Set<string>) => string | null
      params?: unknown[]
    }

type ValidationResult = {
  name: string
  status: "pass" | "fail" | "warn"
  details: string
}

type ResetReport = {
  generatedAt: string
  dryRun: boolean
  safetyBefore: SafetySettings | null
  safetyAfter: SafetySettings | null
  tablesCleaned: CountMap
  beforeCounts: CountMap
  afterCounts: CountMap
  preservedCountsBefore: CountMap
  preservedCountsAfter: CountMap
  storageObjectsPlanned: CountMap
  storageObjectsDeleted: CountMap
  authUsersPlanned: number
  authRowsDeleted: CountMap
  validation: ValidationResult[]
  remainingRisks: string[]
}

const CONFIRMATION = "PRODUCTION DATA RESET"

const CLEANED_TABLES = [
  "advance_payment_refund_audit_logs",
  "advance_payment_allocations",
  "advance_payment_refunds",
  "advance_payment_deposits",
  "audit_logs",
  "collection_followups",
  "documents",
  "hostel_rule_acceptances",
  "invoices",
  "lead_activity_logs",
  "lead_notes",
  "leads",
  "leave_requests",
  "monthly_fee_records",
  "notice_acknowledgements",
  "notice_reads",
  "notification_logs",
  "notifications",
  "payment_webhooks",
  "payments",
  "push_subscriptions",
  "reservation_payments",
  "reservations",
  "resident_invites",
  "residents",
  "room_allocations",
  "support_requests",
  "whatsapp_delivery_events",
  "whatsapp_message_queue",
] as const

const PRESERVED_TABLES = [
  "organizations",
  "hostels",
  "users",
  "user_roles",
  "rooms",
  "room_capacity",
  "hostel_capacity",
  "payment_settings",
  "website_settings",
  "facilities",
  "gallery",
  "notices",
  "hostel_rules",
  "employee_accommodation_rooms",
  "automation_job_settings",
  "whatsapp_message_templates",
  "operational_safety_settings",
] as const

const ZERO_VALIDATION_TABLES = [
  "residents",
  "resident_invites",
  "leads",
  "lead_notes",
  "lead_activity_logs",
  "reservations",
  "reservation_payments",
  "payments",
  "payment_webhooks",
  "invoices",
  "monthly_fee_records",
  "advance_payment_deposits",
  "advance_payment_allocations",
  "advance_payment_refunds",
  "advance_payment_refund_audit_logs",
  "collection_followups",
  "leave_requests",
  "support_requests",
  "notifications",
  "notification_logs",
  "notice_reads",
  "notice_acknowledgements",
  "hostel_rule_acceptances",
  "push_subscriptions",
  "whatsapp_message_queue",
  "whatsapp_delivery_events",
  "room_allocations",
] as const

const TENANT_VALIDATION_TRIGGERS = [
  ["documents", "validate_documents_tenant_scope"],
  ["invoices", "validate_invoices_tenant_scope"],
  ["monthly_fee_records", "validate_monthly_fee_records_tenant_scope"],
  ["payments", "validate_payments_tenant_scope"],
  ["reservation_payments", "validate_reservation_payments_tenant_scope"],
  ["reservations", "validate_reservations_tenant_scope"],
  ["resident_invites", "validate_resident_invites_tenant_scope"],
  ["room_allocations", "validate_room_allocations_tenant_scope"],
] as const

const DELETE_STEPS: DeleteStep[] = [
  {
    table: "whatsapp_delivery_events",
    sql: "delete from public.whatsapp_delivery_events",
  },
  {
    table: "whatsapp_message_queue",
    sql: "delete from public.whatsapp_message_queue",
  },
  {
    table: "advance_payment_refund_audit_logs",
    sql: "delete from public.advance_payment_refund_audit_logs",
  },
  {
    table: "advance_payment_allocations",
    sql: "delete from public.advance_payment_allocations",
  },
  {
    table: "advance_payment_refunds",
    sql: "delete from public.advance_payment_refunds",
  },
  {
    table: "advance_payment_deposits",
    sql: "delete from public.advance_payment_deposits",
  },
  {
    table: "notification_logs",
    sql: "delete from public.notification_logs",
  },
  {
    table: "notifications",
    sql: "delete from public.notifications",
  },
  {
    table: "push_subscriptions",
    sql: "delete from public.push_subscriptions",
  },
  {
    table: "notice_acknowledgements",
    sql: "delete from public.notice_acknowledgements",
  },
  {
    table: "notice_reads",
    sql: "delete from public.notice_reads",
  },
  {
    table: "hostel_rule_acceptances",
    sql: "delete from public.hostel_rule_acceptances",
  },
  {
    table: "collection_followups",
    sql: "delete from public.collection_followups",
  },
  {
    table: "support_requests",
    sql: "delete from public.support_requests",
  },
  {
    table: "lead_activity_logs",
    sql: "delete from public.lead_activity_logs",
  },
  {
    table: "lead_notes",
    sql: "delete from public.lead_notes",
  },
  {
    table: "reservation_payments",
    sql: "delete from public.reservation_payments",
  },
  {
    table: "reservations",
    sql: "delete from public.reservations",
  },
  {
    table: "resident_invites",
    sql: "delete from public.resident_invites",
  },
  {
    table: "leave_requests",
    sql: "delete from public.leave_requests",
  },
  {
    table: "payment_webhooks",
    sql: "delete from public.payment_webhooks",
  },
  {
    table: "documents",
    sql: `
      delete from public.documents
      where document_type::text <> all($1::text[])
        and bucket_name <> all($2::text[])
    `,
    params: [["gallery_image", "facility_image"], ["gallery-images", "payment-qr-codes"]],
  },
  {
    table: "payments",
    sql: "delete from public.payments",
  },
  {
    table: "invoices",
    sql: "delete from public.invoices",
  },
  {
    table: "monthly_fee_records",
    sql: "delete from public.monthly_fee_records",
  },
  {
    table: "room_allocations",
    sql: "delete from public.room_allocations",
  },
  {
    table: "residents",
    sql: "delete from public.residents",
  },
  {
    table: "leads",
    sql: "delete from public.leads",
  },
  {
    table: "audit_logs",
    sql: "delete from public.audit_logs",
  },
]

async function main() {
  loadEnvConfig(process.cwd())

  const dryRun = !process.argv.includes("--execute")
  const confirmation = readArg("--confirm")

  if (!dryRun && confirmation !== CONFIRMATION) {
    throw new Error(`Destructive reset requires --confirm "${CONFIRMATION}".`)
  }

  const client = new Client({
    connectionString: getDatabaseUrl(),
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 20_000,
  })

  await client.connect()

  try {
    const existingTables = await getExistingPublicTables(client)
    const report = dryRun
      ? await buildDryRunReport(client, existingTables)
      : await executeReset(client, existingTables)

    await writeFile("PRODUCTION_DATA_RESET_REPORT.md", renderReport(report), "utf8")

    console.log(
      JSON.stringify(
        {
          generatedAt: report.generatedAt,
          dryRun: report.dryRun,
          tablesCleaned: report.tablesCleaned,
          authUsersPlanned: report.authUsersPlanned,
          storageObjectsDeleted: report.storageObjectsDeleted,
          validationFailures: report.validation.filter((item) => item.status === "fail"),
          reportPath: "PRODUCTION_DATA_RESET_REPORT.md",
        },
        null,
        2
      )
    )

    if (report.validation.some((item) => item.status === "fail")) {
      process.exitCode = 1
    }
  } finally {
    await client.end()
  }
}

async function buildDryRunReport(client: Client, existingTables: Set<string>) {
  const beforeCounts = await countTables(client, existingTables, CLEANED_TABLES)
  const preservedCountsBefore = await countTables(client, existingTables, PRESERVED_TABLES)
  const storageObjects = await listOperationalStorageObjects(client)
  const authUsersPlanned = await countResidentOnlyAuthCandidates(client)
  const safetyBefore = await getSafetySettings(client)
  const validation = await validateDatabaseState(client, existingTables, {
    safetyBefore,
    expectedPrivilegedRoles: await privilegedRoleCounts(client),
    dryRun: true,
  })

  return {
    generatedAt: new Date().toISOString(),
    dryRun: true,
    safetyBefore,
    safetyAfter: safetyBefore,
    tablesCleaned: beforeCounts,
    beforeCounts,
    afterCounts: beforeCounts,
    preservedCountsBefore,
    preservedCountsAfter: preservedCountsBefore,
    storageObjectsPlanned: groupStorageObjects(storageObjects),
    storageObjectsDeleted: {},
    authUsersPlanned,
    authRowsDeleted: {},
    validation,
    remainingRisks: dryRunRisks(),
  } satisfies ResetReport
}

async function executeReset(client: Client, existingTables: Set<string>) {
  const beforeCounts = await countTables(client, existingTables, CLEANED_TABLES)
  const preservedCountsBefore = await countTables(client, existingTables, PRESERVED_TABLES)
  const storageObjects = await listOperationalStorageObjects(client)
  const storageObjectsPlanned = groupStorageObjects(storageObjects)
  const authUsersPlanned = await countResidentOnlyAuthCandidates(client)
  const expectedPrivilegedRoles = await privilegedRoleCounts(client)
  const safetyBefore = await getSafetySettings(client)
  const deleted: CountMap = {}
  const authRowsDeleted: CountMap = {}

  await client.query("begin")

  try {
    await client.query("set local lock_timeout = '15s'")
    await client.query("set local statement_timeout = '120s'")
    await client.query("select pg_advisory_xact_lock(hashtextextended('sadhana-hostel:production-data-reset', 0))")

    await client.query(`
      update public.operational_safety_settings
      set
        launch_mode = 'local',
        next_public_launch_mode = 'local',
        destructive_operations_enabled = true,
        updated_at = now()
      where id is true
    `)

    await setTenantValidationTriggers(client, "disable")
    await createResidentOnlyAuthCandidateTable(client)

    for (const step of DELETE_STEPS) {
      if (!existingTables.has(step.table)) {
        deleted[step.table] = 0
        continue
      }

      const sql = typeof step.sql === "function" ? step.sql(existingTables) : step.sql

      if (!sql) {
        deleted[step.table] = 0
        continue
      }

      const result = await client.query(sql, step.params ?? [])
      deleted[step.table] = result.rowCount ?? 0
    }

    await nullUserReferencesForAuthCandidates(client)
    Object.assign(authRowsDeleted, await deleteResidentOnlyAuthRows(client))
    await recalculateCapacity(client)
    await setTenantValidationTriggers(client, "enable")
    await restoreSafetySettings(client, safetyBefore)

    await client.query("commit")
  } catch (error) {
    await client.query("rollback")
    throw error
  }

  const storageObjectsDeleted = await deleteStorageObjects(storageObjects)
  const afterCounts = await countTables(client, existingTables, CLEANED_TABLES)
  const preservedCountsAfter = await countTables(client, existingTables, PRESERVED_TABLES)
  const safetyAfter = await getSafetySettings(client)
  const validation = await validateDatabaseState(client, existingTables, {
    safetyBefore,
    expectedPrivilegedRoles,
    dryRun: false,
  })
  const remainingRisks = buildRemainingRisks({
    storageObjectsPlanned,
    storageObjectsDeleted,
    existingTables,
    validation,
  })

  return {
    generatedAt: new Date().toISOString(),
    dryRun: false,
    safetyBefore,
    safetyAfter,
    tablesCleaned: deleted,
    beforeCounts,
    afterCounts,
    preservedCountsBefore,
    preservedCountsAfter,
    storageObjectsPlanned,
    storageObjectsDeleted,
    authUsersPlanned,
    authRowsDeleted,
    validation,
    remainingRisks,
  } satisfies ResetReport
}

function getDatabaseUrl() {
  if (existsSync("supabase/.temp/pooler-url")) {
    const poolerUrl = new URL(readFileSync("supabase/.temp/pooler-url", "utf8").trim())

    if (!poolerUrl.password) {
      poolerUrl.password = process.env.SUPABASE_DB_PASSWORD ?? ""
    }

    if (!poolerUrl.password) {
      throw new Error("SUPABASE_DB_PASSWORD is required for the Supabase pooler URL.")
    }

    return poolerUrl.toString()
  }

  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required.")
  }

  return process.env.DATABASE_URL
}

async function setTenantValidationTriggers(client: Client, action: "enable" | "disable") {
  for (const [table, trigger] of TENANT_VALIDATION_TRIGGERS) {
    const exists = await client.query<{ exists: boolean }>(
      `
        select exists (
          select 1
          from pg_trigger
          where tgrelid = $1::regclass
            and tgname = $2
            and not tgisinternal
        ) as exists
      `,
      [`public.${table}`, trigger]
    )

    if (!exists.rows[0]?.exists) {
      continue
    }

    await client.query(
      `alter table public.${quoteIdentifier(table)} ${action} trigger ${quoteIdentifier(trigger)}`
    )
  }
}

async function getExistingPublicTables(client: Client) {
  const result = await client.query<{ table_name: string }>(`
    select table_name
    from information_schema.tables
    where table_schema = 'public'
      and table_type = 'BASE TABLE'
  `)

  return new Set(result.rows.map((row) => row.table_name))
}

async function countTables(
  client: Client,
  existingTables: Set<string>,
  tableNames: readonly string[]
) {
  const counts: CountMap = {}

  for (const table of tableNames) {
    if (!existingTables.has(table)) {
      counts[table] = 0
      continue
    }

    if (table === "documents") {
      const result = await client.query<{ count: string }>(`
        select count(*)::bigint as count
        from public.documents
        where document_type::text <> all($1::text[])
          and bucket_name <> all($2::text[])
      `, [["gallery_image", "facility_image"], ["gallery-images", "payment-qr-codes"]])
      counts[table] = Number(result.rows[0]?.count ?? 0)
      continue
    }

    const result = await client.query<{ count: string }>(
      `select count(*)::bigint as count from public.${quoteIdentifier(table)}`
    )
    counts[table] = Number(result.rows[0]?.count ?? 0)
  }

  return counts
}

async function getSafetySettings(client: Client): Promise<SafetySettings | null> {
  const result = await client.query<SafetySettings>(`
    select launch_mode, next_public_launch_mode, destructive_operations_enabled
    from public.operational_safety_settings
    where id is true
  `)

  return result.rows[0] ?? null
}

async function restoreSafetySettings(client: Client, safety: SafetySettings | null) {
  if (!safety) {
    return
  }

  await client.query(
    `
      update public.operational_safety_settings
      set
        launch_mode = $1,
        next_public_launch_mode = $2,
        destructive_operations_enabled = $3,
        updated_at = now()
      where id is true
    `,
    [safety.launch_mode, safety.next_public_launch_mode, safety.destructive_operations_enabled]
  )
}

async function listOperationalStorageObjects(client: Client) {
  const result = await client.query<{ bucket: string; path: string }>(`
    select distinct d.bucket_name as bucket, d.storage_path as path
    from public.documents d
    where d.bucket_name is not null
      and d.storage_path is not null
      and d.document_type::text <> all($1::text[])
      and d.bucket_name <> all($2::text[])
    union
    select distinct 'invoices'::text as bucket, i.pdf_storage_path as path
    from public.invoices i
    where nullif(trim(coalesce(i.pdf_storage_path, '')), '') is not null
    union
    select distinct o.bucket_id as bucket, o.name as path
    from storage.objects o
    where o.bucket_id in ('invoices', 'payment-screenshots')
      and nullif(trim(coalesce(o.name, '')), '') is not null
  `, [["gallery_image", "facility_image"], ["gallery-images", "payment-qr-codes"]])

  return result.rows.filter((row) => row.bucket && row.path)
}

function groupStorageObjects(objects: Array<{ bucket: string; path: string }>) {
  return objects.reduce<CountMap>((counts, object) => {
    counts[object.bucket] = (counts[object.bucket] ?? 0) + 1
    return counts
  }, {})
}

async function deleteStorageObjects(objects: Array<{ bucket: string; path: string }>) {
  const grouped = new Map<string, string[]>()

  for (const object of objects) {
    grouped.set(object.bucket, [...(grouped.get(object.bucket) ?? []), object.path])
  }

  const deleted: CountMap = {}
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceRoleKey) {
    return deleted
  }

  const supabase = createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      headers: {
        "X-Client-Info": "sadhana-hostel-production-data-reset",
      },
    },
    realtime: {
      transport: WebSocket as unknown as WebSocketLikeConstructor,
    },
  })

  for (const [bucket, paths] of grouped) {
    deleted[bucket] = 0

    for (const pathChunk of chunk(paths, 100)) {
      const { data, error } = await supabase.storage.from(bucket).remove(pathChunk)

      if (error) {
        throw new Error(`Storage cleanup failed for ${bucket}: ${error.message}`)
      }

      deleted[bucket] += data?.length ?? pathChunk.length
    }
  }

  return deleted
}

async function countResidentOnlyAuthCandidates(client: Client) {
  const result = await client.query<{ count: string }>(residentOnlyAuthCandidateCountSql())

  return Number(result.rows[0]?.count ?? 0)
}

async function createResidentOnlyAuthCandidateTable(client: Client) {
  await client.query(`
    create temp table reset_resident_auth_users on commit drop as
    ${residentOnlyAuthCandidateSelectSql()}
  `)

  await client.query("create unique index reset_resident_auth_users_pk on reset_resident_auth_users(id)")
}

function residentOnlyAuthCandidateCountSql() {
  return `select count(*)::bigint as count from (${residentOnlyAuthCandidateSelectSql()}) candidate`
}

function residentOnlyAuthCandidateSelectSql() {
  return `
    select distinct u.id
    from public.users u
    where coalesce(u.is_platform_user, false) is false
      and (
        u.default_role::text in ('resident', 'parent')
        or exists (
          select 1
          from public.residents r
          where r.user_id = u.id
             or r.parent_user_id = u.id
        )
      )
      and not exists (
        select 1
        from public.user_roles privileged
        where privileged.user_id = u.id
          and privileged.deleted_at is null
          and privileged.role::text in ('super_admin', 'owner', 'admin', 'staff')
      )
  `
}

async function nullUserReferencesForAuthCandidates(client: Client) {
  await client.query(`
    update public.automation_job_settings s
    set
      created_by = case when exists (select 1 from reset_resident_auth_users c where c.id = s.created_by) then null else s.created_by end,
      updated_by = case when exists (select 1 from reset_resident_auth_users c where c.id = s.updated_by) then null else s.updated_by end
    where exists (select 1 from reset_resident_auth_users c where c.id in (s.created_by, s.updated_by))
  `)

  await client.query(`
    update public.users u
    set
      created_by = case when exists (select 1 from reset_resident_auth_users c where c.id = u.created_by) then null else u.created_by end,
      updated_by = case when exists (select 1 from reset_resident_auth_users c where c.id = u.updated_by) then null else u.updated_by end,
      deleted_by = case when exists (select 1 from reset_resident_auth_users c where c.id = u.deleted_by) then null else u.deleted_by end,
      avatar_document_id = null
    where exists (select 1 from reset_resident_auth_users c where c.id in (u.id, u.created_by, u.updated_by, u.deleted_by))
  `)
}

async function deleteResidentOnlyAuthRows(client: Client) {
  const counts: CountMap = {}
  const statements = [
    {
      name: "auth.mfa_amr_claims",
      sql: `
        delete from auth.mfa_amr_claims claims
        using auth.sessions sessions, reset_resident_auth_users candidates
        where claims.session_id = sessions.id
          and sessions.user_id = candidates.id
      `,
    },
    {
      name: "auth.refresh_tokens",
      sql: `
        delete from auth.refresh_tokens tokens
        using reset_resident_auth_users candidates
        where tokens.user_id = candidates.id::text
      `,
    },
    {
      name: "auth.sessions",
      sql: `
        delete from auth.sessions sessions
        using reset_resident_auth_users candidates
        where sessions.user_id = candidates.id
      `,
    },
    {
      name: "auth.one_time_tokens",
      sql: `
        delete from auth.one_time_tokens tokens
        using reset_resident_auth_users candidates
        where tokens.user_id = candidates.id
      `,
    },
    {
      name: "auth.flow_state",
      sql: `
        delete from auth.flow_state state
        using reset_resident_auth_users candidates
        where state.user_id = candidates.id
           or state.linking_target_id = candidates.id
      `,
    },
    {
      name: "auth.identities",
      sql: `
        delete from auth.identities identities
        using reset_resident_auth_users candidates
        where identities.user_id = candidates.id
      `,
    },
    {
      name: "auth.mfa_factors",
      sql: `
        delete from auth.mfa_factors factors
        using reset_resident_auth_users candidates
        where factors.user_id = candidates.id
      `,
    },
    {
      name: "auth.oauth_authorizations",
      sql: `
        delete from auth.oauth_authorizations authorizations
        using reset_resident_auth_users candidates
        where authorizations.user_id = candidates.id
      `,
    },
    {
      name: "auth.oauth_consents",
      sql: `
        delete from auth.oauth_consents consents
        using reset_resident_auth_users candidates
        where consents.user_id = candidates.id
      `,
    },
    {
      name: "auth.webauthn_challenges",
      sql: `
        delete from auth.webauthn_challenges challenges
        using reset_resident_auth_users candidates
        where challenges.user_id = candidates.id
      `,
    },
    {
      name: "auth.webauthn_credentials",
      sql: `
        delete from auth.webauthn_credentials credentials
        using reset_resident_auth_users candidates
        where credentials.user_id = candidates.id
      `,
    },
    {
      name: "public.user_roles",
      sql: `
        delete from public.user_roles roles
        using reset_resident_auth_users candidates
        where roles.user_id = candidates.id
      `,
    },
    {
      name: "public.users",
      sql: `
        delete from public.users users
        using reset_resident_auth_users candidates
        where users.id = candidates.id
      `,
    },
    {
      name: "auth.users",
      sql: `
        delete from auth.users users
        using reset_resident_auth_users candidates
        where users.id = candidates.id
      `,
    },
  ]

  for (const statement of statements) {
    const result = await client.query(statement.sql)
    counts[statement.name] = result.rowCount ?? 0
  }

  return counts
}

async function recalculateCapacity(client: Client) {
  await client.query(`
    select public.recalculate_hostel_capacity(h.organization_id, h.id)
    from public.hostels h
    where h.deleted_at is null
      and h.is_active is true
  `)
}

async function validateDatabaseState(
  client: Client,
  existingTables: Set<string>,
  options: {
    safetyBefore: SafetySettings | null
    expectedPrivilegedRoles: CountMap
    dryRun: boolean
  }
) {
  const validation: ValidationResult[] = []

  if (options.dryRun) {
    validation.push({
      name: "dry_run",
      status: "warn",
      details: "No data was deleted because the script was run without --execute.",
    })
    return validation
  }

  for (const table of ZERO_VALIDATION_TABLES) {
    if (!existingTables.has(table)) {
      continue
    }

    const result = await client.query<{ count: string }>(
      `select count(*)::bigint as count from public.${quoteIdentifier(table)}`
    )
    const count = Number(result.rows[0]?.count ?? 0)

    validation.push({
      name: `zero:${table}`,
      status: count === 0 ? "pass" : "fail",
      details: `${table} rows remaining: ${count}`,
    })
  }

  const operationalDocuments = await client.query<{ count: string }>(`
    select count(*)::bigint as count
    from public.documents
    where document_type::text <> all($1::text[])
      and bucket_name <> all($2::text[])
  `, [["gallery_image", "facility_image"], ["gallery-images", "payment-qr-codes"]])
  const operationalDocumentCount = Number(operationalDocuments.rows[0]?.count ?? 0)
  validation.push({
    name: "zero:operational_documents",
    status: operationalDocumentCount === 0 ? "pass" : "fail",
    details: `Operational document rows remaining: ${operationalDocumentCount}`,
  })

  const fkViolations = await validateForeignKeys(client)
  validation.push({
    name: "foreign_keys",
    status: fkViolations.length === 0 ? "pass" : "fail",
    details: fkViolations.length === 0
      ? "No orphaned foreign key references detected."
      : `Foreign key violations: ${fkViolations.join(", ")}`,
  })

  const tenantViolations = await validateTenantScopes(client)
  validation.push({
    name: "tenant_integrity",
    status: tenantViolations.length === 0 ? "pass" : "fail",
    details: tenantViolations.length === 0
      ? "All tenant-scoped rows reference valid organizations and matching hostels."
      : `Tenant scope violations: ${tenantViolations.join(", ")}`,
  })

  const authMissing = await client.query<{ count: string }>(`
    select count(*)::bigint as count
    from public.users u
    left join auth.users au on au.id = u.id
    where au.id is null
  `)
  const missingAuthCount = Number(authMissing.rows[0]?.count ?? 0)
  validation.push({
    name: "auth_profiles",
    status: missingAuthCount === 0 ? "pass" : "fail",
    details: `Public user profiles without auth.users rows: ${missingAuthCount}`,
  })

  const privilegedRolesAfter = await privilegedRoleCounts(client)
  const roleMismatches = Object.entries(options.expectedPrivilegedRoles)
    .filter(([role, count]) => privilegedRolesAfter[role] !== count)
    .map(([role, count]) => `${role}: before ${count}, after ${privilegedRolesAfter[role] ?? 0}`)

  validation.push({
    name: "privileged_roles_preserved",
    status: roleMismatches.length === 0 ? "pass" : "fail",
    details: roleMismatches.length === 0
      ? "Owner/admin/staff/super-admin role counts are unchanged."
      : roleMismatches.join("; "),
  })

  const capacity = await client.query<{ occupied_beds: string; reserved_beds: string }>(`
    select
      coalesce(sum(occupied_beds), 0)::bigint as occupied_beds,
      coalesce(sum(reserved_beds), 0)::bigint as reserved_beds
    from public.hostel_capacity
  `)
  const occupiedBeds = Number(capacity.rows[0]?.occupied_beds ?? 0)
  const reservedBeds = Number(capacity.rows[0]?.reserved_beds ?? 0)
  validation.push({
    name: "occupancy_reset",
    status: occupiedBeds === 0 && reservedBeds === 0 ? "pass" : "fail",
    details: `Hostel capacity occupied beds: ${occupiedBeds}; reserved beds: ${reservedBeds}`,
  })

  const safetyAfter = await getSafetySettings(client)
  validation.push({
    name: "production_safety_restored",
    status: JSON.stringify(safetyAfter) === JSON.stringify(options.safetyBefore) ? "pass" : "fail",
    details: `Safety settings after reset: ${JSON.stringify(safetyAfter)}`,
  })

  return validation
}

async function validateForeignKeys(client: Client) {
  const constraints = await client.query<{
    constraint_name: string
    child_schema: string
    child_table: string
    parent_schema: string
    parent_table: string
    child_columns: string
    parent_columns: string
  }>(`
    select
      c.conname as constraint_name,
      child_ns.nspname as child_schema,
      child.relname as child_table,
      parent_ns.nspname as parent_schema,
      parent.relname as parent_table,
      string_agg(child_att.attname, ',' order by ord.ordinality) as child_columns,
      string_agg(parent_att.attname, ',' order by ord.ordinality) as parent_columns
    from pg_constraint c
    join pg_class child on child.oid = c.conrelid
    join pg_namespace child_ns on child_ns.oid = child.relnamespace
    join pg_class parent on parent.oid = c.confrelid
    join pg_namespace parent_ns on parent_ns.oid = parent.relnamespace
    join unnest(c.conkey, c.confkey) with ordinality as ord(child_attnum, parent_attnum, ordinality) on true
    join pg_attribute child_att on child_att.attrelid = child.oid and child_att.attnum = ord.child_attnum
    join pg_attribute parent_att on parent_att.attrelid = parent.oid and parent_att.attnum = ord.parent_attnum
    where c.contype = 'f'
      and child_ns.nspname in ('public', 'auth', 'storage')
    group by c.conname, child_ns.nspname, child.relname, parent_ns.nspname, parent.relname
    order by child_ns.nspname, child.relname, c.conname
  `)
  const violations: string[] = []

  for (const constraint of constraints.rows) {
    const child = `${quoteIdentifier(constraint.child_schema)}.${quoteIdentifier(constraint.child_table)}`
    const parent = `${quoteIdentifier(constraint.parent_schema)}.${quoteIdentifier(constraint.parent_table)}`
    const childColumns = constraint.child_columns.split(",")
    const parentColumns = constraint.parent_columns.split(",")
    const join = childColumns
      .map((column, index) => `child.${quoteIdentifier(column)} = parent.${quoteIdentifier(parentColumns[index])}`)
      .join(" and ")
    const notNull = childColumns
      .map((column) => `child.${quoteIdentifier(column)} is not null`)
      .join(" and ")
    const parentMissing = parentColumns
      .map((column) => `parent.${quoteIdentifier(column)} is null`)
      .join(" and ")

    const result = await client.query<{ exists: boolean }>(`
      select exists (
        select 1
        from ${child} child
        left join ${parent} parent on ${join}
        where ${notNull}
          and ${parentMissing}
        limit 1
      ) as exists
    `)

    if (result.rows[0]?.exists) {
      violations.push(`${constraint.child_schema}.${constraint.child_table}.${constraint.constraint_name}`)
    }
  }

  return violations
}

async function validateTenantScopes(client: Client) {
  const tables = await client.query<{ table_name: string; has_hostel_id: boolean }>(`
    select
      c.table_name,
      bool_or(c.column_name = 'hostel_id') as has_hostel_id
    from information_schema.columns c
    join information_schema.tables t
      on t.table_schema = c.table_schema
     and t.table_name = c.table_name
     and t.table_type = 'BASE TABLE'
    where c.table_schema = 'public'
      and c.column_name in ('organization_id', 'hostel_id')
    group by c.table_name
    having bool_or(c.column_name = 'organization_id')
    order by c.table_name
  `)
  const violations: string[] = []

  for (const table of tables.rows) {
    const tableIdent = `public.${quoteIdentifier(table.table_name)}`
    const missingOrg = await client.query<{ count: string }>(`
      select count(*)::bigint as count
      from ${tableIdent} tenant_row
      left join public.organizations organization on organization.id = tenant_row.organization_id
      where tenant_row.organization_id is not null
        and organization.id is null
    `)
    const missingOrgCount = Number(missingOrg.rows[0]?.count ?? 0)

    if (missingOrgCount > 0) {
      violations.push(`${table.table_name}: ${missingOrgCount} missing organizations`)
    }

    if (!table.has_hostel_id) {
      continue
    }

    const mismatchedHostels = await client.query<{ count: string }>(`
      select count(*)::bigint as count
      from ${tableIdent} tenant_row
      join public.hostels hostel on hostel.id = tenant_row.hostel_id
      where tenant_row.hostel_id is not null
        and tenant_row.organization_id is not null
        and hostel.organization_id <> tenant_row.organization_id
    `)
    const mismatchedHostelCount = Number(mismatchedHostels.rows[0]?.count ?? 0)

    if (mismatchedHostelCount > 0) {
      violations.push(`${table.table_name}: ${mismatchedHostelCount} hostel/organization mismatches`)
    }
  }

  return violations
}

async function privilegedRoleCounts(client: Client) {
  const result = await client.query<{ role: string; count: string }>(`
    select role::text, count(*)::bigint as count
    from public.user_roles
    where deleted_at is null
      and role::text in ('super_admin', 'owner', 'admin', 'staff')
    group by role::text
  `)
  const counts: CountMap = {
    super_admin: 0,
    owner: 0,
    admin: 0,
    staff: 0,
  }

  for (const row of result.rows) {
    counts[row.role] = Number(row.count)
  }

  return counts
}

function renderReport(report: ResetReport) {
  const validationSummary = report.validation.reduce(
    (summary, item) => {
      summary[item.status] += 1
      return summary
    },
    { pass: 0, warn: 0, fail: 0 }
  )

  return [
    "# Production Data Reset Report",
    "",
    `Generated at: ${report.generatedAt}`,
    `Mode: ${report.dryRun ? "DRY RUN" : "EXECUTED"}`,
    "",
    "## Summary",
    "",
    `- Validation: ${validationSummary.pass} passed, ${validationSummary.warn} warnings, ${validationSummary.fail} failed`,
    `- Resident-only auth users planned for deletion: ${report.authUsersPlanned}`,
    `- Production safety before reset: ${formatSafety(report.safetyBefore)}`,
    `- Production safety after reset: ${formatSafety(report.safetyAfter)}`,
    "",
    "## Tables Cleaned",
    "",
    renderCountTable(["Table", "Before", "Rows Removed", "After"], tableRows(report)),
    "",
    "## Storage Cleaned",
    "",
    renderCountTable(["Bucket", "Planned Objects", "Objects Removed"], storageRows(report)),
    "",
    "## Auth Rows Removed",
    "",
    renderCountTable(["Auth/Public Table", "Rows Removed"], objectRows(report.authRowsDeleted)),
    "",
    "## Tables Preserved",
    "",
    renderCountTable(["Table", "Before", "After"], preservedRows(report)),
    "",
    "## Validation Results",
    "",
    renderValidation(report.validation),
    "",
    "## Remaining Risks",
    "",
    report.remainingRisks.length > 0
      ? report.remainingRisks.map((risk) => `- ${risk}`).join("\n")
      : "- No remaining risks detected by the reset script.",
    "",
  ].join("\n")
}

function tableRows(report: ResetReport) {
  const tables = new Set([
    ...Object.keys(report.beforeCounts),
    ...Object.keys(report.tablesCleaned),
    ...Object.keys(report.afterCounts),
  ])

  return [...tables].sort().map((table) => [
    table,
    String(report.beforeCounts[table] ?? 0),
    String(report.tablesCleaned[table] ?? 0),
    String(report.afterCounts[table] ?? 0),
  ])
}

function storageRows(report: ResetReport) {
  const buckets = new Set([
    ...Object.keys(report.storageObjectsPlanned),
    ...Object.keys(report.storageObjectsDeleted),
  ])

  return [...buckets].sort().map((bucket) => [
    bucket,
    String(report.storageObjectsPlanned[bucket] ?? 0),
    String(report.storageObjectsDeleted[bucket] ?? 0),
  ])
}

function preservedRows(report: ResetReport) {
  const tables = new Set([
    ...Object.keys(report.preservedCountsBefore),
    ...Object.keys(report.preservedCountsAfter),
  ])

  return [...tables].sort().map((table) => [
    table,
    String(report.preservedCountsBefore[table] ?? 0),
    String(report.preservedCountsAfter[table] ?? 0),
  ])
}

function objectRows(counts: CountMap) {
  const rows = Object.entries(counts)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([name, count]) => [name, String(count)])

  return rows.length > 0 ? rows : [["No auth rows removed", "0"]]
}

function renderCountTable(headers: string[], rows: string[][]) {
  const body = rows.length > 0 ? rows : [["None", "0"]]
  const header = `| ${headers.join(" | ")} |`
  const divider = `| ${headers.map(() => "---").join(" | ")} |`
  const lines = body.map((row) => `| ${row.join(" | ")} |`)

  return [header, divider, ...lines].join("\n")
}

function renderValidation(validation: ValidationResult[]) {
  if (validation.length === 0) {
    return "- No validation checks were run."
  }

  return validation
    .map((item) => `- ${item.status.toUpperCase()} - ${item.name}: ${item.details}`)
    .join("\n")
}

function formatSafety(safety: SafetySettings | null) {
  if (!safety) {
    return "not found"
  }

  return `${safety.launch_mode}/${safety.next_public_launch_mode}/destructive=${safety.destructive_operations_enabled}`
}

function buildRemainingRisks(input: {
  storageObjectsPlanned: CountMap
  storageObjectsDeleted: CountMap
  existingTables: Set<string>
  validation: ValidationResult[]
}) {
  const risks: string[] = []

  for (const [bucket, planned] of Object.entries(input.storageObjectsPlanned)) {
    const deleted = input.storageObjectsDeleted[bucket] ?? 0

    if (deleted !== planned) {
      risks.push(`Storage bucket ${bucket} planned ${planned} removals but removed ${deleted}.`)
    }
  }

  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    risks.push("No Upstash Redis credentials were present, so only database-backed data was reset; external cache flush was not applicable from this environment.")
  }

  const absentCategories = [
    ["analytics_snapshots", "No analytics snapshot table exists in the live schema."],
    ["dashboard_caches", "No dashboard cache table exists in the live schema."],
    ["forecast_caches", "No forecast cache table exists in the live schema."],
    ["generated_reports", "No generated reports table exists in the live schema."],
    ["search_indexes", "No standalone search index table exists in the live schema; tsvector rows were removed with operational tables."],
  ]

  for (const [table, message] of absentCategories) {
    if (!input.existingTables.has(table)) {
      risks.push(message)
    }
  }

  const failed = input.validation.filter((item) => item.status === "fail")

  if (failed.length > 0) {
    risks.push(`Validation failures remain: ${failed.map((item) => item.name).join(", ")}.`)
  }

  return risks
}

function dryRunRisks() {
  return [
    "Dry run only; rerun with --execute and the required confirmation to perform cleanup.",
  ]
}

function readArg(name: string) {
  const index = process.argv.indexOf(name)

  if (index === -1) {
    return null
  }

  return process.argv[index + 1] ?? null
}

function chunk<T>(items: T[], size: number) {
  const chunks: T[][] = []

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size))
  }

  return chunks
}

function quoteIdentifier(value: string) {
  return `"${value.replaceAll("\"", "\"\"")}"`
}

void main().catch((error) => {
  console.error(error)
  process.exit(1)
})
