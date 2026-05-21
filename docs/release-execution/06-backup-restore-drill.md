# Backup And Restore Drill Runbook

## Purpose

Prove that staging can be backed up, restored, and validated using the same operational pattern intended for production.

This is a real drill. A successful result requires evidence from backup checks, migration replay, restore validation, and recovery timing.

## Scope

Applies to the staging Supabase PostgreSQL database, storage buckets, migrations, seed data, and recovery scripts.

## Preconditions

- Staging Supabase project exists and is not connected to production data.
- A separate restore target exists for the drill.
- Recovery scripts can connect using database URLs stored in a secure local shell or CI secret store.
- No production service-role keys are used.

## Required Variables

```bash
export DATABASE_URL="postgresql://staging-db-url"
export RESTORE_DATABASE_URL="postgresql://restore-target-db-url"
export MIGRATION_VERIFY_DATABASE_URL="postgresql://migration-verify-db-url"
export RECOVERY_APP_URL="https://your-staging-domain.vercel.app"
```

## Execution Order

### 1. Record Backup Configuration

Capture in the drill record:

- Supabase project reference.
- Backup/PITR status.
- Backup retention window.
- Storage bucket list.
- Migration count.
- Current commit SHA.

### 2. Run Backup Integrity Check

```bash
npm run recovery:backup-check
```

Expected:

- Required tables exist.
- Critical financial tables are queryable.
- Audit tables are queryable.
- No migration metadata inconsistency is reported.

### 3. Restore To Isolated Target

Use Supabase dashboard or approved CLI workflow to restore staging into a separate restore target.

Rules:

- Never restore staging over production.
- Never restore production over staging during this drill.
- Confirm the target project URL before running validation.

### 4. Validate Restored Database

```bash
npm run recovery:restore-validation
```

Expected:

- Core table counts are present.
- Foreign key relationships are intact.
- Financial records are not duplicated.
- `organization_id` exists on tenant-owned records.
- Audit logs are present.

### 5. Validate Migration Replay

```bash
npm run recovery:migration-verify
```

Expected:

- Migrations replay cleanly into a fresh validation database.
- No manual schema drift is required.
- RLS/security migrations apply without ordering errors.

### 6. Run Full Drill Orchestrator

```bash
npm run recovery:drill
```

Expected:

- Backup check passes.
- Migration verification passes.
- Restore validation passes.
- Recovery timing is printed.

## Success Criteria

| Area | Pass Criteria |
|---|---|
| Backup integrity | Critical tables and counts are visible |
| Restore | Restored database passes validation scripts |
| Migration replay | Fresh database can replay migrations cleanly |
| Financial safety | Payments, invoices, fee records have no duplicate integrity violations |
| Tenant safety | Tenant-owned records retain `organization_id` |
| Recovery timing | RTO and RPO are recorded |

## Rollback Verification

After restore validation:

```bash
DEPLOYMENT_URL="$RECOVERY_APP_URL" npm run ci:deployment-health
```

Confirm:

- Health checks still pass.
- Application can connect to staging after the drill.
- No staging secrets were overwritten.
- Cron endpoints still require staging cron secret.

## Drill Record

| Field | Value |
|---|---|
| Date | TODO |
| Commit SHA | TODO |
| Supabase staging project ref | TODO |
| Restore target | TODO |
| Backup check result | TODO |
| Migration replay result | TODO |
| Restore validation result | TODO |
| Recovery time objective measured | TODO |
| Recovery point objective measured | TODO |
| Blockers | TODO |

## Launch Blocking Conditions

- Restore cannot be validated.
- Migration replay fails.
- Backup configuration is disabled or unknown.
- Financial records fail uniqueness/integrity checks.
- Recovery procedure requires production secrets in staging.

