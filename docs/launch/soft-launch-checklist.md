# Controlled Soft-Launch Checklist

Use this checklist before inviting the first real hostel residents.

## Gate 1: Staging Proof

- [ ] `npm run release:soft-launch:validate -- --strict` passes or every warning has owner sign-off.
- [ ] `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build`, and `npm run test:smoke` pass.
- [ ] Authenticated Playwright runs with `E2E_AUTH_RUN_REAL_FLOWS=true` against staging.
- [ ] Full k6 run completes against staging with health, resident, admin, uploads, and realtime scenarios.
- [ ] Supabase RLS checks prove resident self-only access and tenant isolation.
- [ ] Storage checks prove private buckets, signed URLs, and upload ownership.
- [ ] Sentry staging receives a controlled browser error, API error, and cron/job error.

## Gate 2: Launch Safeguards

- [ ] `MAINTENANCE_MODE=false` for launch window.
- [ ] `MAINTENANCE_BYPASS_TOKEN` is configured for operators.
- [ ] `FEATURE_FLAGS` includes only approved modules.
- [ ] `SOFT_LAUNCH_RESIDENT_LIMIT` is set to the approved first cohort size.
- [ ] `CRON_SECRET`, `INVITE_TOKEN_SECRET`, Redis, Sentry, and Supabase env vars are configured.
- [ ] Admin launch readiness page has zero failed checks.

## Gate 3: Pilot Cohort

- [ ] Create owner/admin/finance/receptionist/warden users.
- [ ] Configure organization, hostel, rooms, payment QR/UPI, CMS, facilities, and gallery from admin UI.
- [ ] Invite 10-20 residents only.
- [ ] Verify onboarding, document upload, payment proof upload, invoice access, notices, and leave request on mobile.
- [ ] Record activation rate, onboarding completion, payment success, occupancy health, support volume, and open blockers daily.

## Go/No-Go

- **Go:** zero Critical issues, zero failed readiness checks, authenticated workflows pass, support team assigned.
- **Conditional Go:** only Medium/Low issues remain with documented workaround and owner sign-off.
- **No-Go:** auth/RLS/storage/payment/invoice/onboarding/tenant isolation failure, failed readiness check, or unowned support process.
