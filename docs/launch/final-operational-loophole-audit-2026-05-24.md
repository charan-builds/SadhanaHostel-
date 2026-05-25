# Final Operational Loophole Audit - 2026-05-24

## Executive Summary

Launch readiness score: 78/100 for controlled soft launch after the lifecycle hardening in this sprint.

The largest staging loophole was confirmed: resident admission, occupancy, dues, and invite metrics were using different definitions of "active". Draft/onboarding residents could appear in registered counts, hold active allocations, generate dues, and duplicate invites while not being operationally verified. This produced confusing but technically explainable dashboards.

This sprint establishes one operational rule:

```text
operational resident =
status active
+ onboarding_status verified
+ linked auth user
+ is_active true
+ no checkout date
+ not deleted
```

Operational beds, dues, owner analytics, payment reminders, occupancy scanner checks, and launch diagnostics now use this rule.

## Critical Findings

### P0 - Lifecycle State Was Not A Single Source Of Truth

Status: fixed in app services and SQL views.

Impact:

- Draft residents could be counted by finance but not occupancy.
- Dashboard could show dues with zero active residents.
- Active allocations could exist for residents who were still in draft/onboarding.
- Owners saw metrics that looked contradictory.

Fixes:

- Added reusable lifecycle eligibility helpers in `src/services/analytics/operational-metrics.ts`.
- Dashboard occupancy now filters active room allocations by operational residents.
- Pending dues now filters monthly fee records by billing-eligible residents.
- Owner analytics and advanced analytics exclude draft/onboarding residents from operational trends.
- Supabase vacancy views now count only verified, auth-linked operational residents.

### P0 - Quick Resident Create Consumed Operational Allocation Too Early

Status: fixed in service flow.

Impact:

- Admin quick-create with a room selected attempted live room allocation.
- Draft residents could be promoted into active occupancy before self-onboarding and verification.

Fixes:

- Quick-create now stores selected room as `requested_room_assignment` metadata.
- It does not call `allocate_room_atomic`.
- Admin copy now says "Preferred room", not immediate occupancy.
- Occupancy and dues start only after verification and final room allocation.

### P0 - Dues Could Generate For Non-Operational Residents

Status: fixed for future automation; historical stale dues require reconciliation.

Impact:

- Draft/inactive residents could receive monthly fee records.
- Payment reminders could target residents who were not operationally verified.

Fixes:

- `ResidentsRepository.listActiveForBilling` now requires verified onboarding, linked auth user, active status, no checkout.
- Monthly fee generation skips operational residents without active allocation.
- Payment reminder job skips residents who fail operational verification.

### P1 - Duplicate Active Invites Inflated Owner Metrics

Status: fixed for dashboard counting and automation cleanup.

Impact:

- One resident could show multiple pending invites.
- Owners saw `Pending Invites = 2` for one draft resident.

Fixes:

- Dashboard invite count is distinct by resident.
- Resident invite expiry job now also expires older duplicate active invites.
- Added pure invite dedupe tests.

## Auth And Onboarding Audit

Status: partially verified locally; staging auth proof still required.

Findings:

- Resident operational access is now stricter: verified onboarding alone is not enough; the resident must also have `user_id`.
- Missing `onboarding_status` no longer falls back to verified just because `resident.status = active`.
- This prevents legacy or partial activation records from bypassing onboarding gates.

Remaining risk:

- Existing staging rows with `status = active` but missing `onboarding_status = verified` or `user_id` will drop out of operational metrics until repaired.
- Reservation conversion SQL still needs product review: older conversion flow creates active residents before invite/onboarding. Under the new rule, reservations should remain reservations until resident activation and verification.

## Tenant And Consistency Audit

Status: static and local tests pass; cloud RLS needs staging verification.

Findings:

- Consistency scanner now treats active allocations for non-operational residents as anomalies.
- SQL repair now closes active allocations that do not point at operational residents.
- Capacity snapshots are recalculated after lifecycle migration.

Remaining risk:

- Previously created cross-tenant or stale records in staging need one repair run:

```bash
supabase db push
npm run dev
# Admin -> Operations -> Automation -> Repair Occupancy
# Admin -> Operations -> Automation -> Consistency Validation
```

## Occupancy And Resident Lifecycle Audit

Status: fixed for dashboard, owner analytics, SQL vacancy views, and repair tooling.

Rules now enforced:

- Draft residents do not occupy beds.
- Invited residents do not occupy beds.
- Verification-pending residents do not occupy beds.
- Checked-out residents release beds.
- Active allocations without operational residents are scanner findings.

Remaining risk:

- Active allocations created before this migration need repair.
- Room transfer RPC should receive the same operational guard in a follow-up migration if stale active allocations exist and operators attempt transfers before repair.

## Finance Audit

Status: future dues and reminders fixed; historical records require reconciliation.

Rules now enforced:

- Draft/onboarding residents are excluded from dashboard pending dues.
- Monthly fee generation only uses operational verified residents.
- Payment reminders skip non-operational residents.

Remaining risk:

- Existing monthly fee records for draft residents are not deleted automatically. Finance should run ledger reconciliation and decide whether to void those records.

## Automation Audit

Status: improved.

Fixes:

- Invite expiry now handles stale and duplicate active invites.
- Occupancy repair SQL uses lifecycle-aware operational eligibility.
- Launch readiness diagnostics use lifecycle-aware occupancy and dues.

Remaining risk:

- Authenticated staging cron proof was not executed in this local run.

## UX Audit

Status: improved for the observed issue.

Fixes:

- Admin resident form no longer promises immediate vacancy updates for draft residents.
- Dashboard labels already distinguish Registered Residents, Active Residents, Draft/Onboarding, Occupied Beds, Vacant Beds, Pending Verification, Pending Dues, Pending Invites.

Remaining risk:

- Operators should receive a clear post-create action: "Send invite" or "Continue onboarding" after quick resident creation.

## Validation Proof

Local validation completed:

```text
npm run lint              PASS
npm run typecheck         PASS
npm run test              PASS - 137 passed, 5 skipped
npm run test:security     PASS - 24 passed, 3 skipped
npm run test:coverage     PASS - coverage generated
npm run build             PASS
npm run test:smoke        PASS - 53 passed, 12 skipped
```

Smoke test skips are credential-gated flows requiring configured admin/resident staging credentials. They remain required before production launch.

## Production Blockers

1. Run `supabase db push` and verify migration `20260524005000_lifecycle_operational_state.sql` on staging.
2. Run Admin -> Operations -> Automation -> Repair Occupancy on staging after migration.
3. Run consistency validation and confirm zero active allocations for non-operational residents.
4. Run authenticated Playwright with real staging owner/admin/resident credentials.
5. Review reservation conversion so converted residents enter invite/onboarding flow instead of bypassing activation.

## Recommended Repair Actions

1. Push migrations to staging.
2. Run occupancy repair.
3. Run tenant linkage repair if scanner still reports linkage anomalies.
4. Recalculate ledger and void any draft-resident fee records.
5. Expire duplicate active invites using the invite expiry automation.
6. Re-run dashboard and compare:
   - Registered Residents includes draft plus operational residents.
   - Active Residents equals verified auth-linked residents only.
   - Occupied Beds equals active allocations for operational residents only.
   - Pending Dues includes operational residents only.
   - Pending Invites is one per resident.

## Launch Recommendation

Controlled soft launch: conditional GO after staging migration, repair, and authenticated UAT pass.

Broad production launch: WAIT until reservation conversion and authenticated Playwright staging proof are complete.
