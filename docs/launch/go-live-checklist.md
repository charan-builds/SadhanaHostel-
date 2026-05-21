# Go-Live Checklist

## Purpose

Final launch-day execution checklist for production release.

## T-48 Hours

- [ ] Staging deployment passed `docs/deployment/staging-checklist.md`.
- [ ] UAT passed `docs/qa/staging-uat-checklist.md`.
- [ ] Security checklist passed `docs/security/pre-launch-security-checklist.md`.
- [ ] Load test summary reviewed.
- [ ] Recovery drill completed.
- [ ] Known issues reviewed.
- [ ] Rollback owner assigned.

## T-24 Hours

- [ ] Production Vercel env vars configured.
- [ ] Production Supabase project configured.
- [ ] Storage buckets and policies verified.
- [ ] Production cron secret configured.
- [ ] Sentry production release configured.
- [ ] Uptime monitors created.
- [ ] Resend sender/domain verified.
- [ ] Cashfree remains disabled unless explicitly approved.

## Launch Execution

1. Announce deployment start.
2. Confirm production backups/PITR status.
3. Apply production migrations.
4. Deploy production app.
5. Run post-deploy checks:

```bash
DEPLOYMENT_URL=https://production.example.com npm run ci:deployment-health
PLAYWRIGHT_BASE_URL=https://production.example.com PLAYWRIGHT_SKIP_WEB_SERVER=true npm run test:smoke
```

6. Verify admin login and resident login.
7. Verify one resident payment proof upload in production only if real operations are ready.
8. Monitor Sentry and health checks for 60 minutes.

## Go/No-Go

| Gate | Go Criteria | Status |
| --- | --- | --- |
| Health | `/live` and `/ready` pass | TODO |
| Auth | Admin and resident login pass | TODO |
| Security | Protected routes redirect unauthenticated users | TODO |
| Payments | Verification workflow healthy or intentionally paused | TODO |
| Monitoring | Sentry and uptime alerts active | TODO |
| Rollback | Last known-good deployment ready | TODO |

## Post-Launch

- [ ] Capture deployment SHA and timestamp.
- [ ] Record launch metrics baseline.
- [ ] Review Sentry after 1 hour and 24 hours.
- [ ] Schedule first backup restore drill.
- [ ] Create post-launch improvement backlog.
