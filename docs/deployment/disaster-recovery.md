# Disaster Recovery

## Purpose

Define backup, restore, migration replay, and recovery validation procedures for the Sadhana Boys Hostel Platform.

## Recovery Objectives

| System | RPO Target | RTO Target | Notes |
| --- | --- | --- | --- |
| Supabase PostgreSQL | <= 15 minutes with PITR | <= 2 hours | Confirm plan supports PITR before launch |
| Supabase Storage | Daily backup/export | <= 4 hours | Critical for Aadhaar, payment proof, invoice PDFs |
| Vercel app | Last successful deployment | <= 15 minutes | Rollback via Vercel deployment promotion |
| Secrets | Versioned externally, rotated on incident | <= 1 hour | Do not store secrets in repository |

## Backup Verification

Run against staging and production read-only connection strings:

```bash
DATABASE_URL=postgresql://... DATABASE_SSL=true npm run recovery:backup-check
```

Expected:

- Database connectivity is healthy.
- Critical tables exist.
- RLS is enabled on tenant tables.
- Database size snapshot is captured.

## Migration Replay Drill

Run on disposable DB only:

```bash
MIGRATION_VERIFY_DATABASE_URL=postgresql://... npm run recovery:migration-verify
```

Expected:

- All SQL migrations apply in order.
- Transaction rolls back after validation.
- No migration depends on hidden local state.

## Restore Validation

After restoring a backup into an isolated validation database:

```bash
RESTORE_DATABASE_URL=postgresql://... npm run recovery:restore-validation
```

Expected:

- No cross-tenant payment/invoice records.
- Financial balances are non-negative.
- Verified payments include verifier and timestamp.
- Critical counts match the backup snapshot.

## Full Recovery Drill

```bash
DATABASE_URL=postgresql://staging-readonly \
MIGRATION_VERIFY_DATABASE_URL=postgresql://disposable-db \
RESTORE_DATABASE_URL=postgresql://restored-db \
npm run recovery:drill
```

## Storage Recovery Checklist

- [ ] Confirm bucket list exists in staging/production.
- [ ] Verify signed URLs can be generated for invoice PDFs and payment proofs.
- [ ] Sample restore at least one file from each private bucket.
- [ ] Confirm public gallery bucket/object policy still works.
- [ ] Confirm private Aadhaar/payment files are not publicly accessible.

## Incident Recovery Workflow

1. Declare incident and assign recovery owner.
2. Stop risky background jobs if financial data is affected.
3. Preserve logs: Sentry issue IDs, audit logs, deployment IDs.
4. Choose recovery path:
   - Vercel rollback
   - Supabase PITR restore
   - Function/policy hotfix
   - Data repair with two-person SQL review
5. Run health checks and smoke tests.
6. Write post-incident report.

## TODO

- Schedule quarterly recovery drill.
- Add object storage backup automation.
- Add backup status alert once provider integration is available.
