# Payment Experience V2 Report

Date: 2026-06-08

Branch: `backend-feature-migration`

Mode: implementation for resident payment form usability, accessibility, and proof-submission clarity.

## Summary

Improved the resident payment submission experience without changing APIs, backend behavior, database schema, payment business rules, or mobile improvements already implemented.

The payment form now validates at a more helpful time, focuses the first invalid field on submit, links important fields to inline guidance and errors, and gives residents clearer proof-upload expectations before they submit.

## Problem Found

Residents could submit the payment form with unclear feedback when the amount, transaction/reference ID, or proof upload needed correction. Field guidance and validation output were visually present in places, but not consistently linked for assistive technology or first-error recovery.

## Root Cause

The form relied mostly on submit-time feedback and generic field rendering. Payment fields did not consistently expose `aria-invalid`, `aria-describedby`, field-specific error IDs, or proof-upload guidance.

## Files Changed

- `src/components/resident/resident-payments-client.tsx`
- `src/tests/unit/components/payments-v2-static.test.ts`
- `PAYMENTS_V2_REPORT.md`
- `MASTER_PRODUCT_EVOLUTION_REPORT.md`

## Code Implemented

- Enabled `mode: "onBlur"` for the resident payment form.
- Enabled `shouldFocusError: true` so the first invalid payment field receives focus after an invalid submit.
- Linked the amount input to its hint and field error through `aria-describedby`.
- Linked the transaction/reference input to its hint and field error through `aria-describedby`.
- Added explicit proof-upload guidance through `proof-hint`.
- Added `PaymentFieldError` with `role="alert"` for announced field errors.

## Before / After Behavior

Before:

- Residents often discovered payment-field problems only after submit.
- Amount and transaction/reference fields were not consistently tied to their guidance and errors.
- Proof upload expectations were less explicit for assistive technology.

After:

- Residents receive field feedback when they leave invalid payment fields.
- Invalid submits focus the first broken field.
- Amount, reference ID, and proof upload fields expose clearer guidance and accessible error announcements.

## Tests Added

- `src/tests/unit/components/payments-v2-static.test.ts`

Coverage includes:

- on-blur validation mode
- first invalid field focus
- amount hint/error linking
- transaction/reference hint/error linking
- proof-upload guidance
- announced payment field errors

## Validation Results

Focused test:

```text
npm run test -- src/tests/unit/components/payments-v2-static.test.ts
Test Files  1 passed (1)
Tests       1 passed (1)
```

Full gate:

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
Test Files  125 passed | 3 skipped (128)
Tests       550 passed | 5 skipped (555)
```

```text
npm run test:security
Test Files  7 passed | 2 skipped (9)
Tests       69 passed | 3 skipped (72)
```

```text
npm run build
PASS
Compiled successfully
Generated static pages using 15 workers (37/37)
```

## Risk Assessment

- GO for this payment-experience batch.
- No schema, API, tenant-isolation, authorization, upload, or payment-verification logic changed.
- Risk is low because the change is limited to resident-facing form validation semantics and guidance.
