# Resident Activation Fix Report

Date: 2026-06-09

## Root Cause

The leave eligibility check was correct, but profile completion did not reliably
drive the resident into the lifecycle state required by that check.

Leave access requires all of the following:

- `onboarding_status === "verified"`
- `status === "active"`
- `is_active !== false`
- A linked `user_id`
- No `checkout_on` date

The same rule is enforced in the resident UI and in `LeavesService`, so the
security check was not bypassed.

The activation flow had two mismatches:

1. First login redirected residents to `/resident/onboarding`, but that route
   immediately redirected to `/resident/profile`. The real onboarding form,
   which collects date of birth, required family contacts, permanent address,
   and hostel-rules acceptance, was unreachable.
2. The fallback `/api/residents/me` profile update only attempted activation
   when `resident.status === "draft"`. A resident already marked `active` but
   still carrying `onboarding_status === "profile_incomplete"` could save every
   displayed field successfully and remain blocked from leave.

The fallback profile updater also used a weaker four-field completeness check
and could mark a draft resident verified without the full onboarding contract.

## Lifecycle Trace

1. Admin signup/create: creates a non-operational resident, normally `draft`
   with onboarding initially `invited`.
2. Invite activation/first login: links the auth `user_id`, creates or updates
   the public user, and grants an active resident role containing
   `resident.portal.access`.
3. Profile completion: must collect all required identity/contact fields and
   current hostel-rules acceptance.
4. Resident activation: must atomically set `status = active` and
   `onboarding_status = verified` while preserving `is_active`.
5. Leave access: is available only after the resident satisfies the complete
   operational eligibility rule.

## Fix

- `/resident/onboarding` now renders the full resident onboarding workflow.
- Removed lifecycle activation from the generic contact-profile update.
- Added `complete_resident_self_onboarding_atomic`, callable only by
  `service_role`.
- The RPC locks and revalidates the resident before activation:
  - Resident is linked to the authenticated actor.
  - Status is `draft` or `active`.
  - Resident and public user are active.
  - Resident is not suspended, checked out, archived, or pending finance.
  - An active resident role grants `resident.portal.access`.
  - All required profile fields are populated.
  - Hostel-rules acceptance is recorded atomically.
- The RPC writes `active + verified` together and records an audit event.
- Suspended or inactive residents cannot self-reactivate.
- Leave eligibility checks remain unchanged and enforced server-side.

## Files Changed

- `src/app/(resident)/resident/onboarding/page.tsx`
- `src/repositories/residents.repository.ts`
- `src/services/onboarding/resident-onboarding.policy.ts`
- `src/services/onboarding/resident-onboarding.service.ts`
- `src/services/residents.service.ts`
- `supabase/migrations/20260609002000_resident_self_onboarding_activation.sql`
- `src/tests/unit/services/resident-onboarding.policy.test.ts`
- `src/tests/unit/services/resident-onboarding.service.test.ts`
- `src/tests/unit/services/leaves.service.test.ts`
- `src/tests/unit/validations/onboarding.validation.test.ts`
- `src/tests/security/migration-security-static.test.ts`

## Tests Added

- New unlinked resident remains blocked.
- Auth-linked draft resident can complete onboarding but cannot use leave before
  activation.
- Completed active profile remains blocked until the activation transaction.
- Completed draft and active residents transition through the atomic workflow.
- Active verified resident can create a leave request.
- Inactive and suspended residents cannot self-reactivate.
- Protected onboarding route renders the full onboarding form.
- Activation RPC is atomic, identity-bound, portal-role checked, and
  service-role only.

## Validation Results

- `npm run lint`: Passed with 0 errors. Four unrelated unused-import warnings
  remain in `src/components/admin/analytics/owner-dashboard-client.tsx`.
- `npm run typecheck`: Passed.
- `npm run test`: Passed, 492 tests passed and 5 skipped.
- `npm run test:security`: Passed, 67 tests passed and 3 skipped.
- `npm run build`: Passed with Next.js 16.2.6.

## Before vs After

Before:

- First login sent residents away from the complete onboarding form.
- Saving the visible profile could report success without setting
  `onboarding_status = verified`.
- Active-but-incomplete residents remained blocked from leave.
- Draft activation used an incomplete profile definition.

After:

- First login opens the complete onboarding workflow.
- Full completion performs one guarded database transition to
  `status = active` and `onboarding_status = verified`.
- Portal assignment is verified, not recreated or bypassed.
- Leave becomes available immediately after the committed activation state is
  returned.
- Inactive, suspended, checked-out, archived, and unlinked residents remain
  blocked.
