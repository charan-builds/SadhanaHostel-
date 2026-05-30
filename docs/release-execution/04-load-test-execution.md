# Load Test Execution

## Purpose

Validate staging performance under realistic admin/resident traffic before soft launch.

## Prerequisites

- Install k6.
- Staging seed completed.
- Test admin/resident credentials configured.
- Mutating tests approved by release owner.
- Sentry and health monitors visible during the run.

## Environment

```bash
export LOAD_TEST_BASE_URL=https://staging.sadhanaboyshostel.example
export LOAD_TEST_ORGANIZATION_ID=<uuid>
export LOAD_TEST_HOSTEL_ID=<uuid>
export LOAD_TEST_RESIDENT_ID=<uuid>
export LOAD_TEST_ADMIN_EMAIL=admin.staging@example.com
export LOAD_TEST_ADMIN_PASSWORD=<password>
export LOAD_TEST_RESIDENT_EMAIL=resident.staging@example.com
export LOAD_TEST_RESIDENT_PASSWORD=<password>
```

## Read-Only Baseline

```bash
LOAD_TEST_ADMIN_VUS=3 \
LOAD_TEST_RESIDENT_VUS=15 \
LOAD_TEST_DURATION=5m \
npm run load:k6
```

## Mutation Workflow Run

Creates staging payment and proof records. Run only after baseline passes.

```bash
LOAD_TEST_MUTATIONS=true \
LOAD_TEST_ADMIN_VUS=2 \
LOAD_TEST_RESIDENT_VUS=10 \
LOAD_TEST_DURATION=3m \
npm run load:k6
```

## Soft Launch Simulation

```bash
LOAD_TEST_SCENARIOS=health,resident,admin,uploads,realtime \
LOAD_TEST_ADMIN_VUS=5 \
LOAD_TEST_RESIDENT_VUS=30 \
LOAD_TEST_UPLOAD_VUS=3 \
LOAD_TEST_REALTIME_VUS=10 \
LOAD_TEST_DURATION=10m \
npm run load:k6
```

## Thresholds

| Metric | Target | Launch Impact |
| --- | --- | --- |
| HTTP failed rate | < 1% | High if exceeded |
| Overall p95 API latency | < 2500 ms | Medium/High |
| Login p95 | < 1200 ms | High if exceeded |
| Analytics p95 | < 2500 ms | Medium |
| Search p95 | < 1500 ms | Medium |
| Export p95 first response | < 5000 ms | Medium |
| Payment/upload failures | 0 critical workflow failures | High/Critical |
| Realtime-adjacent checks | No sustained 5xx or tenant leakage | High |

## Monitoring During Run

Watch:

- Vercel function errors and duration.
- Supabase database CPU and connection count.
- Sentry new issues.
- `/api/health/ready`.
- Browser/mobile upload behavior.

## Bottleneck Analysis Checklist

- [ ] Check p95 route latencies by route.
- [ ] Identify repeated 401/403 as auth/session issue or expected credential failure.
- [ ] Check DB indexes for slow analytics/search queries.
- [ ] Check export memory/timeout behavior.
- [ ] Confirm no duplicate invoices for same monthly fee record.
- [ ] Confirm no room over-allocation.
- [ ] Confirm no cross-tenant records in reports/search.
- [ ] Confirm websocket reconnect behavior with real browser/mobile soak sessions; k6 only adds API/reconnect-adjacent pressure.

## Results Record

| Run | Date | VUs | Duration | Failed Rate | p95 | Result | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Baseline | TODO | TODO | TODO | TODO | TODO | TODO | TODO |
| Mutation | TODO | TODO | TODO | TODO | TODO | TODO | TODO |
| Soft launch simulation | TODO | TODO | TODO | TODO | TODO | TODO | TODO |
