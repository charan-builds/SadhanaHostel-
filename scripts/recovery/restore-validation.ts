import { Client } from "pg"
import { loadEnvConfig } from "@next/env"

loadEnvConfig(process.cwd())

const STORAGE_BUCKETS = [
  "resident-documents",
  "payment-screenshots",
  "payment-qr-codes",
  "invoices",
  "gallery-images",
] as const

type ValidationCheck = {
  name: string
  passed: boolean
  details?: unknown
}

async function main() {
  const client = new Client({
    connectionString:
      process.env.RESTORE_DATABASE_URL ?? requiredEnv("DATABASE_URL"),
    ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: true } : undefined,
  })
  const checks: ValidationCheck[] = []

  await client.connect()

  checks.push(
    await validate(
      client,
      "no payments outside resident tenant",
      `
        select count(*)::int as violations
        from public.payments p
        join public.residents r on r.id = p.resident_id
        where p.organization_id <> r.organization_id
      `
    )
  )
  checks.push(
    await validate(
      client,
      "no invoices outside resident tenant",
      `
        select count(*)::int as violations
        from public.invoices i
        join public.residents r on r.id = i.resident_id
        where i.organization_id <> r.organization_id
      `
    )
  )
  checks.push(
    await validate(
      client,
      "financial balances are non-negative",
      `
        select count(*)::int as violations
        from public.monthly_fee_records
        where total_amount < 0 or paid_amount < 0 or balance_amount < 0
      `
    )
  )
  checks.push(
    await validate(
      client,
      "verified payments have verifier and timestamp",
      `
        select count(*)::int as violations
        from public.payments
        where status = 'verified'
          and (verified_by is null or verified_at is null)
      `
    )
  )
  checks.push(
    await validate(
      client,
      "no orphan audit actors",
      `
        select count(*)::int as violations
        from public.audit_logs audit
        left join public.users users
          on users.id = audit.actor_user_id
        where audit.actor_user_id is not null
          and users.id is null
      `
    )
  )
  checks.push(
    await validate(
      client,
      "resident auth links resolve to public users",
      `
        select count(*)::int as violations
        from public.residents residents
        left join public.users users
          on users.id = residents.user_id
        where residents.deleted_at is null
          and residents.user_id is not null
          and users.id is null
      `
    )
  )
  checks.push(
    await validate(
      client,
      "no duplicate active resident phone identities",
      `
        with duplicate_phones as (
          select organization_id, phone
          from public.residents
          where deleted_at is null
            and is_active is true
            and phone is not null
          group by organization_id, phone
          having count(*) > 1
        )
        select count(*)::int as violations
        from duplicate_phones
      `
    )
  )
  checks.push(
    await validate(
      client,
      "private storage buckets remain private",
      `
        select count(*)::int as violations
        from storage.buckets
        where id = any(array[
          'resident-documents',
          'payment-screenshots',
          'payment-qr-codes',
          'invoices'
        ]::text[])
          and "public" is true
      `
    )
  )
  checks.push(
    await validate(
      client,
      "expected storage buckets exist",
      `
        with expected(id) as (
          select unnest($1::text[])
        )
        select count(*)::int as violations
        from expected
        left join storage.buckets buckets on buckets.id = expected.id
        where buckets.id is null
      `,
      [STORAGE_BUCKETS]
    )
  )
  checks.push(
    await validate(
      client,
      "document storage objects exist",
      `
        select count(*)::int as violations
        from public.documents documents
        left join storage.objects objects
          on objects.bucket_id = documents.bucket_name
         and objects.name = documents.storage_path
        where documents.deleted_at is null
          and documents.bucket_name = any($1::text[])
          and objects.id is null
      `,
      [STORAGE_BUCKETS]
    )
  )
  checks.push(
    await validate(
      client,
      "invoice PDF storage objects exist",
      `
        select count(*)::int as violations
        from public.invoices invoices
        join public.documents documents on documents.id = invoices.pdf_document_id
        left join storage.objects objects
          on objects.bucket_id = documents.bucket_name
         and objects.name = documents.storage_path
        where invoices.deleted_at is null
          and documents.deleted_at is null
          and documents.document_type = 'invoice_pdf'
          and objects.id is null
      `
    )
  )
  checks.push(
    await validate(
      client,
      "payment screenshot storage objects exist",
      `
        select count(*)::int as violations
        from public.documents documents
        left join storage.objects objects
          on objects.bucket_id = documents.bucket_name
         and objects.name = documents.storage_path
        where documents.deleted_at is null
          and documents.document_type = 'payment_receipt'
          and documents.bucket_name = 'payment-screenshots'
          and objects.id is null
      `
    )
  )

  await client.end()

  console.log(JSON.stringify({ validatedAt: new Date().toISOString(), checks }, null, 2))

  if (checks.some((check) => !check.passed)) {
    process.exitCode = 1
  }
}

async function validate(
  client: Client,
  name: string,
  sql: string,
  params: unknown[] = []
): Promise<ValidationCheck> {
  const result = await client.query<{ violations: number }>(sql, params)
  const violations = result.rows[0]?.violations ?? 0

  return {
    name,
    passed: violations === 0,
    details: {
      violations,
    },
  }
}

function requiredEnv(name: string) {
  const value = process.env[name]

  if (!value) {
    throw new Error(`${name} is required.`)
  }

  return value
}

void main().catch((error) => {
  console.error(error)
  process.exit(1)
})
