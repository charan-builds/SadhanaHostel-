# Payment Integrity Report

Date: 2026-06-09

## Problem Found

Payment creation and verification were mostly protected by database uniqueness, atomic verification RPCs, receipt invoice uniqueness, and tenant-scoped services. The remaining issue was at the application idempotency boundary:

- UPI payment creation could return an existing payment for a reused idempotency key without checking that the retry matched the same resident, hostel, amount, transaction reference, due record, and partial/advance flags.
- Screenshot-proof retries validated outstanding balances before checking for an existing idempotent payment, so a valid retry could be rejected because its own initiated/pending payment was counted as pending verification.
- Legacy JSON payment creation reused idempotency keys without full detail matching and did not run payment setting or payable-balance validation before creating a new row.
- Already-finalized verified payments could still enter invoice finalization again, creating avoidable duplicate invoice/PDF work under repeated approval clicks.
- Invoice finalization claim updates did not explicitly restrict work to retryable finalization states.

## Root Cause

The database correctly constrained the highest-risk finance records, but the service layer treated idempotency as "same key means same request" instead of verifying the complete payment fingerprint. This made stale client retries and accidental key reuse indistinguishable at the API boundary.

## Files Changed

- `src/services/payments.service.ts`
- `src/repositories/payments.repository.ts`
- `src/tests/unit/services/payments.service.test.ts`
- `src/tests/unit/repositories/payments.repository.test.ts`
- `PAYMENT_INTEGRITY_REPORT.md`
- `MASTER_PRODUCT_EVOLUTION_REPORT.md`

## Code Implemented

- Added a payment idempotency fingerprint guard that checks:
  - `organization_id`
  - `hostel_id`
  - `resident_id`
  - `monthly_fee_record_id`
  - `invoice_id` where applicable
  - amount
  - method
  - transaction reference
  - manual reference where applicable
  - advance flag
  - partial flag
- Changed JSON UPI payment creation to return only matching idempotent retries and reject key reuse for different payment details.
- Changed screenshot-proof payment submission to check existing idempotent payments before payable-balance validation, preventing self-pending retry failures.
- Changed screenshot-proof payment creation to verify the RPC-created draft matches the requested payment details before proof upload.
- Added payable-balance and payment-setting validation to legacy JSON payment creation before inserting new pending payments.
- Changed in-person collections to reject idempotency keys reused for a different amount, method, due record, resident, or hostel.
- Added a short-circuit for already-finalized verified payments with `invoice_finalization_status = "succeeded"` and an `invoice_id`.
- Restricted invoice finalization claim updates to retryable states: `pending`, `failed`, and `not_required`.

## Tests Added

- Added payment service tests for:
  - matching UPI idempotent retries returning before stale pending balance checks
  - UPI idempotency keys reused for different payment details being rejected
  - legacy payment-create idempotency collisions being rejected
  - already-finalized verified payments avoiding duplicate invoice work
  - screenshot-proof idempotency retries continuing without stale balance failure
- Added repository coverage proving invoice finalization can only be claimed from retryable states.

## Validation Results

Focused finance suite:

```text
npm run test -- --run src/tests/unit/services/payments.service.test.ts src/tests/unit/repositories/payments.repository.test.ts
Test Files  2 passed (2)
Tests       27 passed (27)
```

Full required gate:

```text
npm run lint
PASS
```

```text
npm run typecheck
PASS
```

```text
npm run test
Test Files  152 passed | 3 skipped (155)
Tests       644 passed | 5 skipped (649)
```

```text
npm run test:security
Test Files  8 passed | 2 skipped (10)
Tests       75 passed | 3 skipped (78)
```

```text
npm run build
PASS
Compiled successfully
Generated static pages using 15 workers (37/37)
```

## Risk Assessment

Risk is low to medium. The change tightens service-layer finance guards without changing public APIs, database schema, tenant isolation, authentication, authorization, or payment verification RPC behavior. Some previously accepted duplicate-key requests now correctly return conflict responses if the payment details do not match.

The existing database protections remain in place for duplicate payment idempotency keys, duplicate UPI transaction references, active payment proof documents, monthly-fee invoices, payment receipt invoices, and atomic verification invoice linkage.

## Decision

GO for Payment & Invoice Integrity batch.
