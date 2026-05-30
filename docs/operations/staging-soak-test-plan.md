# Staging Soak Test Plan

Run this plan before production launch and after auth, RLS, or payment changes.

## Duration

- Minimum: 48 continuous hours.
- Preferred: 5 business days with daily resident/admin activity.

## Seed And Accounts

- Seed deterministic hostel data with `npm run staging:seed`.
- Create deterministic auth users with `npm run auth:seed-test-users`.
- Reset resident lifecycle test data only in staging with `npm run dev:reset-resident-lifecycle`.

## Workload

- Repeat resident invite activation and phone/password login cycles.
- Run concurrent admin sessions for residents, rooms, onboarding, payments, and notices.
- Upload Aadhaar/student/profile documents and payment proofs from mobile and desktop browsers.
- Toggle network offline/online during resident dashboard and payment proof upload.
- Run consistency scan dry-runs every 6 hours.
- Run backup health check daily.

## Exit Criteria

- No critical or high Sentry issues remain unresolved.
- No auth desync or repeated activation alerts.
- No actor spoofing warnings except intentional security tests.
- No tenant leakage findings in operational alerts or restore validation.
- `npm run recovery:backup-check` and `npm run recovery:restore-validation` pass against staging recovery data.
