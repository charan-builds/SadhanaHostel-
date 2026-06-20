# Financial Corrections and Revenue Filters Report

## Scope

Implemented only:

1. Read-only revenue period filters.
2. Left resident visibility and history access.
3. Controlled monthly fee and advance balance corrections.
4. Resident portal synchronization after corrections.
5. Immutable correction audit history.

Authentication, authorization rules, payments, invoices, receipts, existing
revenue formulas, advance allocation logic, notifications, WhatsApp,
dependencies, package versions, build configuration, and environment variables
were not changed.

## Revenue Analytics Filters

- Owner analytics now presents:
  - Today
  - This Week
  - This Month
  - This Quarter
  - This Year
  - Custom Date Range
- Existing verified-payment date filtering and revenue calculations are reused.
- No financial rows or calculations are modified by selecting a period.

## Resident Left History

- Added resident lifecycle tabs:
  - Active
  - Draft
  - Verified
  - Left
  - All
- `Left` maps to the existing `checked_out` resident status.
- Checked-out residents remain searchable and their records are not deleted.
- The existing resident profile continues to open for Left residents.
- The profile's Finance link now opens the matching resident finance drawer,
  including payment, invoice, due, advance, and correction history.

## Financial Corrections

- Added controlled correction actions to the resident finance drawer:
  - Edit Monthly Fee
  - Edit Advance Balance
- Every correction requires a reason.
- Monthly fee corrections update only the resident's current
  `monthly_fee_amount`; existing payments, invoices, and monthly fee records are
  not rewritten.
- Advance increases append an `adjustment` deposit.
- Advance decreases append a completed correction refund entry.
- Existing advance deposits, allocations, refunds, payments, and linked records
  are preserved.

## Transaction and Audit Safety

Migration:

`supabase/migrations/20260619082000_financial_corrections_and_resident_history.sql`

The migration adds a service-role-only atomic RPC that:

- Serializes corrections per resident with a transaction advisory lock.
- Locks the resident record before calculating or changing values.
- Writes the correction and audit log in the same database transaction.
- Stores resident, admin user, change type, old value, new value, delta, reason,
  timestamp, and correction record reference.
- Does not update payments, invoices, or monthly fee records.

## Resident Portal Sync

- Added the targeted `resident.financial_corrected` realtime event.
- Open resident dashboard, profile, and payments screens invalidate and reload
  resident fee, payment ledger, and advance ledger data automatically.
- Admin and owner analytics caches are also refreshed for the correction event.

## Files Added

- `src/app/api/finance/corrections/route.ts`
- `src/services/financial-corrections.service.ts`
- `src/validations/financial-correction.validation.ts`
- `src/lib/realtime/useRealtimeResidentFinance.ts`
- `supabase/migrations/20260619082000_financial_corrections_and_resident_history.sql`
- Focused API, validation, and migration security tests.

## Validation

- `npm run lint` - passed.
- `npm run typecheck` - passed.
- `npm run build` - passed.
- Focused Vitest suite - 12 tests passed.
- `git diff --check` - passed.

## Deployment Note

No live or local resident data was changed while implementing this task.
Apply the new migration through the normal reviewed Supabase deployment process
before enabling financial corrections in production.
