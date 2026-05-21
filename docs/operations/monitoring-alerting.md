# Monitoring And Alerting

## Purpose

Define actionable production monitoring for frontend, backend, financial workflows, uploads, cron, and realtime behavior.

## Monitoring Sources

| Source | Captures | Environment Tag |
| --- | --- | --- |
| Sentry frontend | React render errors, route transitions, client API failures | `local`, `staging`, `production` |
| Sentry backend | API exceptions, background job failures, payment/upload/invoice errors | `local`, `staging`, `production` |
| Health endpoints | App liveness and readiness | `staging`, `production` |
| Structured logs | Request IDs, tenant IDs, user IDs, route names, timings | All |
| Audit logs | Admin actions, payment verification, resident updates | Staging, production |

## Alert Rules

| Alert | Trigger | Severity | Owner |
| --- | --- | --- | --- |
| Frontend crash spike | Sentry frontend error rate > 2% for 10 minutes | High | Frontend |
| API 5xx spike | API error count > 10 in 5 minutes or 5xx rate > 2% | Critical | Backend |
| Login failures spike | `auth.login` failure rate > 20% for 10 minutes | High | Backend |
| Payment verification failure | Any repeated `payments.verify` failure for same tenant | Critical | Finance/backend |
| Invoice generation failure | `invoice.generated` failure > 0 after payment verification | Critical | Finance/backend |
| Upload failure spike | Upload failures > 5% for 15 minutes | High | Backend |
| Cron failure | Any scheduled job fails twice consecutively | High | DevOps |
| Realtime disconnects | Realtime subscription failures or missed updates > baseline | Medium | Frontend/backend |
| Readiness down | `/api/health/ready` returns non-200 for 5 minutes | Critical | DevOps |

## Sentry Configuration Checklist

- [ ] `NEXT_PUBLIC_SENTRY_DSN` set in Vercel staging and production.
- [ ] `SENTRY_DSN` set for server-side capture.
- [ ] `SENTRY_ENVIRONMENT=staging|production`.
- [ ] `SENTRY_TRACES_SAMPLE_RATE` tuned by environment.
- [ ] Release name tied to commit SHA.
- [ ] Source maps uploaded only with CI-held `SENTRY_AUTH_TOKEN`.
- [ ] Payment and Aadhaar metadata redacted from event payloads.

## Uptime Monitors

Configure external uptime checks:

| URL | Frequency | Expected |
| --- | --- | --- |
| `/api/health/live` | 1 minute | `200` |
| `/api/health/ready` | 1 minute | `200` |
| `/login` | 5 minutes | `200` |
| `/` | 5 minutes | `200` |

## Dashboard Panels

- API request count by route.
- API latency p50/p95/p99 by route.
- Error count by route and status.
- Payment verification successes/failures.
- Upload successes/failures by bucket.
- Cron job duration and status.
- Realtime publish count by event type.
- Sentry issue count by release.

## Escalation

Use `docs/operations/failure-escalation.md` for severity ownership, communication templates, and rollback routing.

## TODO

- Add provider-specific uptime monitor export.
- Add metrics ingestion to hosted dashboard once provider is selected.
- Add on-call calendar and alert routing integration.
