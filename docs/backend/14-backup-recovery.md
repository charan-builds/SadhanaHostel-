# Backup and Recovery

## Purpose

Define backup, restore, disaster recovery, and data retention practices.

## Scope

Covers:

- PostgreSQL backups.
- Storage backups.
- Invoice and document retention.
- Recovery testing.
- Export procedures.

## Responsibilities

Backend/operations own:

- Backup configuration.
- Restore testing.
- Data retention.
- Recovery documentation.

Frontend owns:

- No direct responsibility beyond exposing exports if required.

## Architecture Overview

```txt
Supabase PostgreSQL
  -> automated backups
  -> manual backups before major migrations
Supabase Storage
  -> bucket retention strategy
Critical exports
  -> financial/reporting snapshots
```

## Backup Requirements

- **RPO:** 24 hours for full database backup, 15 minutes where Supabase PITR is enabled.
- **RTO:** 4 hours for full environment restore, 8 hours for tenant-scoped recovery.
- Daily Supabase PostgreSQL backups minimum; enable PITR for production before launch.
- Manual SQL dump before destructive or backfill migrations.
- Monthly financial exports for payments, invoices, and monthly fee records.
- Private storage buckets must be restorable: `resident-documents`, `payment-screenshots`, `payment-qr-codes`, and `invoices`.
- Invoice PDF and payment proof retention must match the financial retention policy.
- Run `npm run recovery:backup-check` daily from CI or ops automation and alert on failure.

## Storage Backup Strategy

- Keep private operational buckets non-public and tenant-prefixed by organization ID.
- Mirror private buckets to a separate backup target at least daily.
- Preserve object metadata: bucket, storage path, content type, checksum, size, and created timestamp.
- Do not restore storage objects without restoring matching `public.documents` rows, unless running a documented orphan-file cleanup.

## Migration Rollback Strategy

- Prefer forward-fix migrations for production incidents.
- Before risky migrations, take a manual DB dump and record the Supabase migration version.
- Validate migration SQL against staging with `supabase db push --dry-run`.
- If rollback is required, restore to staging first, run `npm run recovery:restore-validation`, then apply the approved production recovery path.
- Never mutate `auth.users` directly from ad hoc SQL; use service-role admin APIs or documented RPC repair functions.

## Recovery Checklist

- [ ] Identify incident scope, affected tenant IDs, time window, and data classes.
- [ ] Freeze risky writes if integrity is still degrading.
- [ ] Capture Sentry issue IDs, request IDs, audit log IDs, and deployment SHA.
- [ ] Restore database to staging or an isolated recovery project.
- [ ] Restore matching storage buckets or a scoped object prefix snapshot.
- [ ] Run `npm run recovery:restore-validation` against the restored database.
- [ ] Run tenant-level smoke checks for auth, resident onboarding, payments, invoices, and uploads.
- [ ] Restore production, patch forward, or perform tenant-scoped repair.
- [ ] Document the incident, root cause, recovery time, data loss assessment, and preventive action.

## Restore Verification

Run these commands for every restore drill:

```bash
npm run recovery:backup-check
RESTORE_DATABASE_URL=postgres://... npm run recovery:restore-validation
npm run recovery:drill
```

The restore validation must pass:

- No payment or invoice rows outside resident tenant scope.
- No negative financial balances.
- Verified payments have verifier and timestamp.
- Audit actors resolve to public users.
- Resident auth links resolve to public users.
- Active resident phone identities are unique per organization.
- Private storage buckets remain private.

## Tenant Recovery Workflow

1. Identify the tenant by `organization_id` and optional `hostel_id`.
2. Export tenant rows from staging restore for residents, rooms, allocations, invites, payments, invoices, documents, and audit logs.
3. Compare current production rows with restored rows using tenant-scoped IDs.
4. Prefer repair RPCs for consistency fixes; use direct SQL only with peer review and a fresh backup.
5. Reissue signed URLs after storage restore; never reuse expired signed URLs from backups.
6. Run resident activation/login and payment proof smoke checks for the recovered tenant.

## Restore Test Schedule

- Weekly: automated backup health check.
- Monthly: staging restore validation using latest backup.
- Before launch and before major migrations: full disaster recovery drill.
- Quarterly after launch: tenant-scoped recovery drill with storage object verification.

## Retention Policy

- Database backups: 30 days minimum; longer if the Supabase plan supports it.
- Financial exports and invoices: 7 years or local compliance requirement, whichever is longer.
- Resident documents: retain while resident is active and for the configured legal retention window after checkout.
- Payment proofs: retain with payment records.
- Incident evidence: retain with the incident report and linked Sentry/audit references.

## Future Scalability Notes

- Add tenant-level export and restore tooling.
- Add point-in-time recovery review for production tier.
- Add immutable backups for financial compliance.
