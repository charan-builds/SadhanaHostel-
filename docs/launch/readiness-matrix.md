# Launch Readiness Matrix

## Purpose

Single-page launch readiness dashboard for final go/no-go decisions.

## Readiness Scores

| Area | Target | Current | Status | Owner |
| --- | --- | --- | --- | --- |
| Frontend UX | >= 90% | TODO | TODO | Frontend |
| Backend APIs | >= 95% | TODO | TODO | Backend |
| Security/RLS | 100% critical pass | TODO | TODO | Security |
| Payments/invoices | 100% critical pass | TODO | TODO | Backend/finance |
| Performance | p95 within budget | TODO | TODO | Performance |
| Monitoring | Alerts configured | TODO | TODO | DevOps |
| Backup/restore | Drill passed | TODO | TODO | DevOps |
| UAT | All critical workflows pass | TODO | TODO | QA |
| Rollback | Runbook reviewed | TODO | TODO | Release |

## Go/No-Go Criteria

Go-live requires:

- No Critical known issues.
- No unresolved High issues affecting auth, payments, invoices, tenant isolation, uploads, or deployment.
- Staging UAT signed off.
- Health checks stable.
- Backup/restore drill completed.
- Rollback owner assigned for launch window.

## Evidence Links

| Evidence | Link/ID |
| --- | --- |
| CI run | TODO |
| Vercel deployment | TODO |
| Supabase migration run | TODO |
| Sentry release | TODO |
| Load test summary | TODO |
| Lighthouse report | TODO |
| UAT checklist | TODO |
| Security checklist | TODO |
| Recovery drill | TODO |
