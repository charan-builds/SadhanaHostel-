# Final Pre-Production Execution Roadmap - 2026-05-28

## Purpose

This is the execution record for moving Sadhana Hostel from stabilized architecture to controlled public launch readiness.

This document separates local proof from required staging proof. Do not mark staging, mobile, backup restore, or realtime websocket soak as passed without real staging URLs, Supabase project references, device/browser evidence, command output, and dashboard links.

## Current Local Status

| Gate | Status | Evidence |
|---|---|---|
| Local lint/type/build/tests | Ready to run | Required commands listed below |
| Local smoke | Ready to run | `npm run test:smoke` |
| k6 tooling | Available in this shell | `command -v k6` |
| Real Supabase staging soak | Not executed in this shell | Requires staging project credentials |
| Credentialed E2E | Not executed in this shell | Requires `E2E_AUTH_RUN_REAL_FLOWS=true` and staging users |
| Mobile device testing | Not executed in this shell | Requires Android Chrome and iOS Safari sessions |
| Backup restore drill | Not executed in this shell | Requires staging DB and isolated restore DB URLs |

## Local Validation Results

Recorded on 2026-05-28 from the local workspace:

| Command | Result |
|---|---|
| `npm run lint` | Passed |
| `npm run typecheck` | Passed |
| `npm run test` | Passed: 43 files passed, 3 skipped; 233 tests passed, 5 skipped |
| `npm run test:security` | Passed: 3 files passed, 2 skipped; 41 tests passed, 3 skipped |
| `npm run build` | Passed |
| `npm run test:smoke` | Passed: 57 passed, 12 credential-gated skipped |
| `LOAD_TEST_SCENARIOS=health LOAD_TEST_DURATION=5s LOAD_TEST_BASE_URL=http://127.0.0.1:3002 npm run load:k6` | Passed after local dev-server warmup: p95 911.87 ms, failed rate 0, workflow success 1 |
| `npm run release:staging:preflight` | Non-strict preflight completed with 22 pass, 1 warning, 6 failures due missing real staging env values |

## Required Execution Order

1. Run staging preflight:

```bash
npm run release:staging:preflight -- --strict
```

2. Apply migrations and seed staging:

```bash
supabase db push
npm run staging:seed
AUTH_TEST_SEED_ENABLED=true npm run auth:seed-test-users
```

3. Run local quality gates on the release commit:

```bash
npm run lint
npm run typecheck
npm run test
npm run test:security
npm run build
npm run test:smoke
```

4. Run credentialed staging smoke:

```bash
PLAYWRIGHT_BASE_URL="$NEXT_PUBLIC_APP_URL" \
PLAYWRIGHT_SKIP_WEB_SERVER=true \
E2E_AUTH_RUN_REAL_FLOWS=true \
E2E_ADMIN_EMAIL="$E2E_ADMIN_EMAIL" \
E2E_ADMIN_PASSWORD="$E2E_ADMIN_PASSWORD" \
E2E_RESIDENT_EMAIL="$E2E_RESIDENT_EMAIL" \
E2E_RESIDENT_PASSWORD="$E2E_RESIDENT_PASSWORD" \
npm run test:smoke
```

5. Run k6 staging load:

```bash
LOAD_TEST_SCENARIOS=health,resident,admin,uploads,realtime \
LOAD_TEST_ADMIN_VUS=5 \
LOAD_TEST_RESIDENT_VUS=30 \
LOAD_TEST_UPLOAD_VUS=3 \
LOAD_TEST_REALTIME_VUS=10 \
LOAD_TEST_DURATION=10m \
npm run load:k6
```

6. Run mutation k6 after baseline passes:

```bash
LOAD_TEST_SCENARIOS=health,resident,admin,uploads,realtime \
LOAD_TEST_MUTATIONS=true \
LOAD_TEST_ADMIN_VUS=2 \
LOAD_TEST_RESIDENT_VUS=10 \
LOAD_TEST_UPLOAD_VUS=2 \
LOAD_TEST_REALTIME_VUS=5 \
LOAD_TEST_DURATION=3m \
npm run load:k6
```

7. Run backup and restore drill:

```bash
npm run recovery:backup-check
npm run recovery:migration-verify
npm run recovery:restore-validation
npm run recovery:drill
```

## Staging Soak Findings

Status: pending real staging execution.

Required evidence:

| Workflow | Minimum Pass Criteria | Evidence |
|---|---|---|
| Resident create/invite/activate/onboard/login | 10 repeated cycles, no duplicate auth identity, no stuck invite | TODO |
| Cleanup/reset/recreate same phone | 5 cycles, canonical alias remains deterministic | TODO |
| Admin concurrent sessions | 3 concurrent sessions, no stale resident/payment/room state | TODO |
| Payment upload/verify/reject | No duplicate payment proof records on retries | TODO |
| Room allocate/transfer | No over-allocation; vacancy recalculates within one refresh/realtime event | TODO |
| Operational repair | Dry-run and safe repair remain tenant scoped | TODO |

## Realtime Stability Findings

Status: pending websocket soak.

Required evidence:

| Scenario | Pass Criteria | Evidence |
|---|---|---|
| Multi-tab admin updates | Same-tenant tabs receive updates once | TODO |
| Resident/admin concurrent payment update | Resident state updates or invalidates without full reload | TODO |
| Offline then reconnect | Reconnect invalidates stale payment, occupancy, onboarding keys | TODO |
| Logout channel cleanup | No tenant events after logout/session clear | TODO |
| Tenant isolation | No events received across organization/hostel boundary | TODO |

## Mobile Edge-Case Findings

Status: pending real device testing.

Required evidence:

| Device/Network | Workflow | Pass Criteria | Evidence |
|---|---|---|---|
| Android Chrome | Invite activation, onboarding, payment proof | Refresh/retry safe, no duplicate payments | TODO |
| iOS Safari | Login persistence, uploads, leave request | Session survives background/foreground | TODO |
| Slow 3G | Onboarding and payment proof upload | Actionable loading/retry state | TODO |
| Offline/online | Resident dashboard, payment proof | No corrupted state; stale state refreshes | TODO |

## Observability Readiness

Local status: expected 401/403 API probes are downgraded to `application.auth_rejected` warnings; 4xx validation mistakes are info; server failures remain `application.error`.

Staging status: pending Sentry/dashboard validation.

Required dashboards:

- Failed logins by route, role, and masked identity mode.
- Invite activation failures by reason and tenant.
- Onboarding dropoff by lifecycle step.
- Realtime disconnect/reconnect spike rate.
- Upload failures by bucket and MIME class.
- Payment verification failures.
- Occupancy inconsistency reports.

## Backup And Recovery Readiness

Status: pending staging backup and isolated restore target.

Required proof:

- Supabase backup/PITR status and retention captured.
- Storage bucket backup/export procedure tested for document and payment-proof buckets.
- `npm run recovery:backup-check` passes against staging.
- `npm run recovery:restore-validation` passes against isolated restored DB.
- Migration replay succeeds on disposable DB.
- One accidental resident deletion is restored in staging with uploads and payment proofs intact.

## Unresolved Operational Risks

| Risk | Severity | Blocking Scope | Mitigation |
|---|---|---|---|
| No real staging credentials loaded in this shell | High | Blocks true staging proof | Run strict preflight and credentialed smoke from staging operator shell |
| Credentialed Playwright flows are skipped without secrets | High | Blocks broad launch | Configure synthetic owner/admin/resident users |
| Websocket behavior is not proven by k6 alone | High | Blocks realtime confidence | Run browser/mobile multi-tab soak |
| Backup restore is not proven without restore target | Critical | Blocks production data safety | Complete isolated restore drill |
| Mobile upload interruption remains real-device dependent | Medium | Blocks broad resident rollout | Test Android Chrome and iOS Safari before expanding pilot |

## Scaling Bottlenecks To Watch

- Analytics dashboard and owner reports under 30+ resident VUs.
- Search endpoint p95 and DB CPU during admin workflows.
- Upload throughput and storage signed URL latency.
- Realtime channel churn during logout/login/reconnect loops.
- Occupancy/vacancy recalculation during room transfer bursts.
- Export route memory and first-response latency.

## Final Launch Blockers

| Blocker | Status |
|---|---|
| Real Supabase staging soak completed | Pending |
| Credentialed E2E completed | Pending |
| Mobile device/network testing completed | Pending |
| Backup restore drill completed | Pending |
| k6 baseline and mutation runs completed against staging | Pending |
| Monitoring dashboards and alert routes verified | Pending |

## Launch Recommendation

Current recommendation: **No-Go for broad production launch** until the pending staging evidence is collected.

Recommended next step: **Controlled staging execution** using this roadmap, then a limited soft launch only if credentialed E2E, k6, monitoring, realtime websocket soak, mobile testing, and restore drill all pass.

Current confidence score before real staging evidence: **78/100**.

Expected confidence after all pending gates pass without critical findings: **90-93/100**.
