import { readFileSync } from "node:fs"
import path from "node:path"

import { describe, expect, it } from "vitest"

const migration = readFileSync(
  path.join(
    process.cwd(),
    "supabase",
    "migrations",
    "20260619082000_financial_corrections_and_resident_history.sql"
  ),
  "utf8"
)
const forwardFix = readFileSync(
  path.join(
    process.cwd(),
    "supabase",
    "migrations",
    "20260619183000_financial_consistency_forward_fix.sql"
  ),
  "utf8"
)
const advanceSync = readFileSync(
  path.join(
    process.cwd(),
    "supabase",
    "migrations",
    "20260619184000_verified_advance_deposit_sync.sql"
  ),
  "utf8"
)

describe("financial correction migration safety", () => {
  it("keeps corrections service-role-only and serialized per resident", () => {
    expect(migration).toMatch(
      /assert_service_role_rpc\(\s*'apply_resident_financial_correction_atomic'/i
    )
    expect(migration).toMatch(/pg_advisory_xact_lock/i)
    expect(migration).toMatch(
      /from\s+public\.residents[\s\S]*for\s+update/i
    )
    expect(migration).toMatch(
      /revoke\s+execute[\s\S]*from\s+public,\s*anon,\s*authenticated/i
    )
    expect(migration).toMatch(
      /grant\s+execute[\s\S]*to\s+service_role/i
    )
  })

  it("keeps advance corrections append-only and synchronizes paid fee truth", () => {
    expect(migration).toMatch(
      /insert\s+into\s+public\.advance_payment_deposits/i
    )
    expect(migration).toMatch(
      /insert\s+into\s+public\.advance_payment_refunds/i
    )
    expect(migration).toMatch(/insert\s+into\s+public\.audit_logs/i)
    expect(migration).toMatch(/update\s+public\.payments/i)
    expect(migration).toMatch(/update\s+public\.invoices/i)
    expect(migration).toMatch(/update\s+public\.monthly_fee_records/i)
    expect(migration).toMatch(/p\.is_advance\s*=\s*false/i)
    expect(migration).toMatch(/pdf_regeneration_required/i)
  })

  it("removes advance from the database finance dashboard revenue aggregate", () => {
    expect(migration).toMatch(
      /rename\s+to\s+finance_dashboard_aggregates_including_advance/i
    )
    expect(migration).toMatch(/p\.is_advance\s+is\s+true/i)
    expect(migration).toMatch(
      /v_collected_amount[\s\S]*v_advance_collected/i
    )
  })

  it("ships the applied correction logic as a forward migration", () => {
    expect(forwardFix).toMatch(
      /create\s+or\s+replace\s+function\s+public\.apply_resident_financial_correction_atomic/i
    )
    expect(forwardFix).toMatch(/update\s+public\.payments/i)
    expect(forwardFix).toMatch(/update\s+public\.monthly_fee_records/i)
    expect(forwardFix).toMatch(/update\s+public\.invoices/i)
    expect(forwardFix).toMatch(/pdf_regeneration_required/i)
    expect(forwardFix).toMatch(/from\s+public\.advance_balance_view/i)
    expect(forwardFix).toMatch(/payment\.is_advance\s+is\s+false/i)
  })

  it("materializes verified advance payments without a ledger read", () => {
    expect(advanceSync).toMatch(
      /after\s+insert\s+or\s+update[\s\S]*on\s+public\.payments/i
    )
    expect(advanceSync).toMatch(/new\.status\s*=\s*'verified'/i)
    expect(advanceSync).toMatch(/new\.is_advance\s+is\s+true/i)
    expect(advanceSync).toMatch(
      /insert\s+into\s+public\.advance_payment_deposits/i
    )
    expect(advanceSync).toMatch(/on\s+conflict\s*\(payment_id\)/i)
  })
})
