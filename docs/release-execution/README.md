# Release Execution Index

## Purpose

This folder contains the operational runbooks for real staging execution, soft-launch validation, and production readiness assessment.

These documents are execution checklists, not architecture proposals. Complete them with real command output, dashboard links, and signed results.

## Runbook Order

1. [Real Staging Setup](./01-real-staging-setup.md)
2. [Migration And Seed Execution](./02-migration-and-seed-execution.md)
3. [UAT Execution](./03-uat-execution.md)
4. [Load Test Execution](./04-load-test-execution.md)
5. [Monitoring Validation](./05-monitoring-validation.md)
6. [Backup Restore Drill](./06-backup-restore-drill.md)
7. [Final Security Review](./07-final-security-review.md)
8. [Soft Launch Strategy](./08-soft-launch-strategy.md)
9. [Final Production Readiness Report](./09-final-production-readiness-report.md)
10. [Final Pre-Production Execution Roadmap - 2026-05-28](./12-final-pre-production-execution-roadmap-2026-05-28.md)

## Local Preflight

Run:

```bash
npm run release:staging:preflight
```

For CI or a strict operator gate:

```bash
npx tsx scripts/release/staging-preflight.ts --strict
```

The strict mode should fail until required tooling and staging environment variables are configured.

## Required Evidence Before Go-Live

- Migration replay output.
- Staging seed output.
- UAT pass/fail report.
- k6 load-test summary.
- Sentry alert validation screenshots or event links.
- Backup/restore drill output.
- Security signoff checklist.
- Final readiness report with go/no-go decision.
