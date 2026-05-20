# Backup And Recovery Verification Runbook

## Purpose

Provide a repeatable verification workflow for backups, migrations, and restored databases before the platform is trusted for production operations.

## Recovery Scripts

| Script | Purpose | Required Environment |
| --- | --- | --- |
| `npm run recovery:backup-check` | Checks database connectivity, critical tables, RLS flags, and database size snapshot. | `DATABASE_URL` |
| `npm run recovery:migration-verify` | Replays Supabase migrations against a disposable database and rolls back. | `MIGRATION_VERIFY_DATABASE_URL` or `TEST_DATABASE_URL` |
| `npm run recovery:restore-validation` | Validates tenant and finance invariants after a restore. | `RESTORE_DATABASE_URL` or `DATABASE_URL` |

## Production-Safe Rules

- Never run migration replay against production.
- Run restore validation against a restored copy before pointing application traffic at it.
- Keep backup credentials separate from application service-role credentials.
- Store script output with deployment or incident records.

## Restore Validation Checklist

- [ ] Database accepts connections.
- [ ] Core tables exist and RLS is enabled.
- [ ] Payments and invoices match resident organizations.
- [ ] Financial balances are non-negative.
- [ ] Verified payments have verifier and timestamp metadata.
- [ ] Storage buckets are present and signed URL generation works.
- [ ] Cron routes are disabled until verification is complete.

## Suggested Recovery Drill

```bash
export RESTORE_DATABASE_URL="postgresql://..."
npm run recovery:backup-check
npm run recovery:restore-validation
```

For migration replay:

```bash
export MIGRATION_VERIFY_DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:54322/postgres"
npm run recovery:migration-verify
```

## Future Expansion

- Add object storage restore verification.
- Add automated Supabase PITR timestamp checks.
- Add report export integrity checks after restore.
- Add signed incident runbook artifacts for audit compliance.
