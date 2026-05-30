# Load Testing

## Purpose

Run realistic staging load tests for auth, analytics, resident payments, uploads, search, exports, and realtime-adjacent cache invalidation pressure.

## Tooling

Install k6 locally or in CI runner:

```bash
brew install k6
# or see https://grafana.com/docs/k6/latest/set-up/install-k6/
```

## Safe Defaults

Mutating workflows are disabled unless explicitly enabled:

```bash
LOAD_TEST_MUTATIONS=true
```

Use only staging credentials and synthetic residents.

## Required Environment

```bash
export LOAD_TEST_BASE_URL=https://staging.example.com
export LOAD_TEST_ORGANIZATION_ID=<uuid>
export LOAD_TEST_HOSTEL_ID=<uuid>
export LOAD_TEST_RESIDENT_ID=<uuid>
export LOAD_TEST_ADMIN_EMAIL=admin.staging@example.com
export LOAD_TEST_ADMIN_PASSWORD=<password>
export LOAD_TEST_RESIDENT_EMAIL=resident.staging@example.com
export LOAD_TEST_RESIDENT_PASSWORD=<password>
```

## Commands

Read-only smoke pressure:

```bash
npm run load:k6
```

Full pre-production pressure profile:

```bash
LOAD_TEST_SCENARIOS=health,resident,admin,uploads,realtime npm run load:k6
```

Payment and upload workflow validation:

```bash
LOAD_TEST_SCENARIOS=health,resident,admin,uploads,realtime LOAD_TEST_MUTATIONS=true npm run load:k6
```

Tune users:

```bash
LOAD_TEST_ADMIN_VUS=5 LOAD_TEST_RESIDENT_VUS=30 LOAD_TEST_DURATION=5m npm run load:k6
```

## Outputs

- `scripts/load-testing/last-summary.json`
- `scripts/load-testing/last-summary.md`
- stdout JSON summary

These files are generated artifacts and should be reviewed after a staging run.

## Scenario Notes

- `health` checks live/ready endpoints under light pressure.
- `resident` exercises login, resident payments, leaves, notices, and optional payment creation.
- `admin` exercises login, dashboard analytics, search, and exports.
- `uploads` is mutation-gated; it creates a staging payment and uploads a synthetic proof only when `LOAD_TEST_MUTATIONS=true`.
- `realtime` applies reconnect-adjacent pressure to readiness, payment feed, and vacancy feed endpoints. Browser websocket behavior must still be validated with real Playwright/mobile soak sessions.

## Launch Thresholds

- HTTP failed rate < 1%.
- p95 HTTP duration < 2500 ms.
- p95 dashboard analytics < 2500 ms.
- p95 search < 1500 ms.
- p95 exports < 5000 ms.
- No duplicate payment or invoice records after mutation run.
