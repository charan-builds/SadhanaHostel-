# Rollback Runbook

## Purpose

Provide a safe, rehearsed path to restore service if a staging or production release causes critical failure.

## Rollback Principles

- Prefer forward fixes only when data integrity is not at risk and the fix is smaller than rollback.
- Roll back application code before database changes when migrations are backward compatible.
- Never run destructive SQL during an incident without a second reviewer.
- Freeze financial mutations if payment/invoice consistency is suspected.

## Severity Triggers

| Trigger | Severity | First Action |
| --- | --- | --- |
| Users cannot log in | Critical | Roll back Vercel deployment |
| Admin/resident tenant leakage | Critical | Disable affected route, roll back, preserve logs |
| Payment verification duplicate/incorrect | Critical | Pause verification workflow, inspect audit logs |
| Invoice duplication | Critical | Pause invoice generation jobs |
| `/api/health/ready` failing for 5+ minutes | High | Check Supabase/Vercel status, roll back if release-related |
| Realtime events missed | High | Fall back to manual refresh, inspect channel config |

## Application Rollback - Vercel

1. Open Vercel project deployments.
2. Locate the last known-good deployment.
3. Promote it to production or staging.
4. Run:

```bash
DEPLOYMENT_URL=https://<target-domain> npm run ci:deployment-health
PLAYWRIGHT_BASE_URL=https://<target-domain> PLAYWRIGHT_SKIP_WEB_SERVER=true npm run test:smoke
```

5. Confirm Sentry error rate returns to baseline.

## Database Rollback Strategy

Database rollback is intentionally conservative.

| Migration Type | Rollback Strategy |
| --- | --- |
| Additive table/column/index/function | Leave in place if harmless |
| RLS policy change | Restore previous policy from migration history |
| Financial mutation function | Replace with last known-good function body |
| Destructive migration | Restore from backup/PITR after approval |

## Financial Safety Procedure

If payment or invoice integrity is suspected:

1. Disable admin payment verification in the UI through access control or a hotfix.
2. Pause invoice generation jobs.
3. Export affected `payments`, `monthly_fee_records`, `invoices`, and `audit_logs`.
4. Compare duplicate idempotency keys, invoice numbers, and monthly fee record links.
5. Apply corrective SQL only after two-person review.

## Communication Template

```text
Incident: <short title>
Environment: staging | production
Started: <UTC timestamp>
User impact: <who/what>
Current action: rollback | forward fix | investigation
Owner: <name>
Next update: <UTC timestamp>
```

## Post-Rollback Checks

- [ ] `/api/health/live` returns `200`.
- [ ] `/api/health/ready` returns `200`.
- [ ] Login works for admin and resident test users.
- [ ] Protected routes redirect unauthenticated users.
- [ ] Payment verification and invoice generation are either healthy or intentionally paused.
- [ ] Sentry error rate has stabilized.
- [ ] Incident notes and timeline are captured.
