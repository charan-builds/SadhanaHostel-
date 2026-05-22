# Soft-Launch Operational Readiness Report

Project: Sadhana Boys Hostel Platform  
Date: 2026-05-22  
Scope: final operational stabilization and UAT hardening for controlled soft launch.

## Executive Summary

The platform is now structured like a real hostel ERP SaaS: tenant-scoped admin operations, invite-only onboarding, admissions/reservations, payment QR/UPI controls, staff access, verification queues, CMS/gallery management, health checks, observability, and smoke/load-test infrastructure.

Current status: **soft-launch candidate after staging evidence is attached**.

The codebase can be validated locally with automated static/unit/integration/smoke gates. Final production confidence still depends on staging-only evidence: real credentials, live Supabase RLS/storage checks, k6 load results, Sentry alert delivery, and a backup/restore drill.

## Operational Readiness Scores

| Area | Score | Rationale |
| --- | ---: | --- |
| Product workflow | 84/100 | Core hostel lifecycle exists from inquiry to resident finance; exit workflow and parent communication can be deeper post-launch. |
| Admin self-service | 86/100 | Setup, organization, hostels, rooms, CMS, gallery, payments, onboarding, and staff access are UI-managed. |
| Resident UX | 82/100 | Invite, onboarding, uploads, payments, invoices, and leave are present; mobile UAT remains required. |
| Finance integrity | 90/100 | Manual UPI flow has proof requirement, UTR controls, auditability, and invoice generation. |
| Security/RBAC | 86/100 | Route guards, role restrictions, tenant scoping, and anonymous abuse smoke tests are in place. Live RLS/storage validation remains mandatory. |
| Reliability | 80/100 | Health checks and safe errors exist; outage/failure injection needs staging execution. |
| Performance | 78/100 | Pagination and k6 scripts exist; 1000+ resident staging run has not been evidenced here. |
| Operations | 82/100 | UAT/runbooks/checklists exist; alert routing and restore drills need sign-off. |

Overall readiness: **84/100**  
Launch recommendation: **Controlled soft-launch only**, beginning with 10-20 residents and daily operational review.

## Production Blocker Matrix

| ID | Finding | Severity | Status | Required Evidence |
| --- | --- | --- | --- | --- |
| P0-01 | Staging migrations/RLS/storage policies must be replayed after latest operational modules. | Critical | Open until staging run | `supabase db push` output, table/policy/bucket screenshots or SQL audit results. |
| P0-02 | Real authenticated Playwright flows require staging credentials. | Critical | Gated | `E2E_AUTH_RUN_REAL_FLOWS=true` and `E2E_OPERATIONAL_UAT_RUN_MUTATIONS=true` smoke results. |
| P0-03 | Finance concurrency must be verified against live Postgres. | Critical | Open | Duplicate UTR, double verification, and invoice uniqueness test evidence. |
| P0-04 | Reservation overbooking must be verified under concurrent requests. | Critical | Open | k6/concurrency evidence showing one winner for final bed. |
| P1-01 | Sentry alert routing must be validated in staging. | High | Open | Controlled frontend/API/job error event IDs and alert receipt. |
| P1-02 | Backup/restore drill must be timed. | High | Open | Recovery timing, migration replay, integrity query result. |
| P1-03 | Mobile resident onboarding/payment UAT must be signed off. | High | Open | Device/browser matrix notes. |

## Edge-Case Risk Matrix

| Area | Risk | Existing Control | UAT Probe |
| --- | --- | --- | --- |
| Auth | Expired invite, reused invite, suspended staff session. | Invite token hashing, statuses, account metadata checks. | Expired/replay invite E2E; staff suspended while logged in. |
| Onboarding | Partial upload or rejected document dead-end. | Onboarding state machine and verification queue. | Refresh mid-upload, reject/retry flow, multi-tab submission. |
| Vacancy | Reservation and room allocation race. | Atomic reservation/allocation functions. | Concurrent final-bed reservation and allocation. |
| Payments | Duplicate UTR/proof and double invoice. | Unique indexes, proof metadata, atomic verification. | Concurrent approve, duplicate UTR submit, rejected proof resubmit. |
| CMS/Gallery | Orphan uploaded file after DB failure. | Service-side upload/record workflow. | Forced storage/DB failure staging drill. |
| Realtime | Missed events or duplicate notifications. | Tenant channel naming and query invalidation. | Disconnect/reconnect storm and duplicate event detection. |
| Staff access | Role escalation or last-owner removal. | Service-level permission checks. | Finance attempts admin creation; owner removal test. |

## Black-Box Abuse Checklist

- Anonymous user requests protected admin pages: must redirect before render.
- Anonymous user calls staff, finance, onboarding, setup, CMS mutation APIs: must return sanitized `401` or `403`.
- Public inquiry accepts valid submissions but blocks honeypot, invalid phone, burst duplicates, and oversized payloads.
- Resident cannot access another resident invoice/payment/proof URL.
- Staff cannot call finance/security APIs outside assigned permissions.
- Deleted/suspended users cannot retain access after refresh or new route transition.

## Failure Simulation Checklist

- Supabase unreachable: ready health is degraded, UI shows retry, no mutation proceeds.
- Storage unreachable: upload UX retries or fails safely, no DB orphan record remains.
- Realtime offline: UI falls back to refetch and does not duplicate notifications after reconnect.
- Expired signed URL: resident/admin can request a fresh URL without exposing storage path.
- Payment verify job fails after payment status update attempt: transaction rolls back or remains retry-safe.
- Invoice PDF upload fails after verification attempt: no verified payment without invoice linkage.

## UAT Execution Order

1. Run environment preflight and migration replay.
2. Seed staging with realistic data.
3. Run local automated validation gates.
4. Run unauthenticated smoke tests.
5. Run authenticated admin/resident/staff Playwright flows.
6. Run finance and reservation concurrency probes.
7. Run k6 read-only load test.
8. Run k6 mutation test against disposable staging records.
9. Run failure injection scenarios.
10. Attach Sentry, health, backup/restore, and SQL audit evidence.

## Go/No-Go Rules

No-go if any of these occur:

- Protected admin/resident UI renders for unauthenticated users.
- Cross-tenant data appears in any UI, API response, storage URL, realtime event, report, or audit log.
- Final bed can be overbooked.
- Duplicate UTR can be verified or duplicate invoice can be generated.
- Resident can bypass onboarding verification.
- Staff can escalate role or access owner/admin-only areas.
- Supabase dashboard is required for any normal hostel owner operation.

Soft-launch acceptable risks:

- Minor copy/layout polish.
- Non-critical empty-state wording.
- Analytics drill-down gaps if summary metrics are correct.
- Manual support process for rare failed uploads, as long as data is not corrupted.

## Launch Confidence

Recommended rollout: **10-20 real residents**, one hostel, one owner/admin, one finance user, one operations user, daily incident review for the first week.

Confidence score before staging evidence: **7.8/10**  
Confidence score target after staging evidence: **8.8/10**

Decision: **Soft-launch candidate, not full production-wide GO until P0/P1 evidence is closed.**
