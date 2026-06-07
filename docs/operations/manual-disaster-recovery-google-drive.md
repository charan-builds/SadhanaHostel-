# Manual Disaster Recovery With Google Drive

## Purpose

Supabase Free Plan does not provide production PITR or listed managed backups. This runbook provides an operator-owned fallback that creates a daily PostgreSQL dump plus Storage object mirror and uploads the backup bundle to Google Drive.

Backup destination account: `charanderangula007@gmail.com`

## Scope

Database backup covers the `public` schema through `pg_dump` and validates these launch-critical tables:

- `organizations`
- `hostels`
- `residents`
- `monthly_fee_records`
- `invoices`
- `payments`
- `documents`

Storage backup covers:

- `payment-screenshots`
- `payment-qr-codes`
- `invoices`
- `gallery-images`

## Required Tools And Environment

Install and configure:

```bash
pg_dump --version
psql --version
rclone version
rclone config
```

The rclone remote must be a Google Drive remote for `charanderangula007@gmail.com`.

Required environment:

```bash
DATABASE_URL="postgresql://..."
NEXT_PUBLIC_SUPABASE_URL="https://..."
SUPABASE_SERVICE_ROLE_KEY="..."
MANUAL_DR_GOOGLE_DRIVE_REMOTE="gdrive:sadhana-hostel-dr"
GOOGLE_DRIVE_BACKUP_ACCOUNT_EMAIL="charanderangula007@gmail.com"
```

Restore validation also requires:

```bash
RESTORE_DATABASE_URL="postgresql://..."
RESTORE_SUPABASE_URL="https://..."
RESTORE_SUPABASE_SERVICE_ROLE_KEY="..."
```

For a local Supabase restore target, `RESTORE_SUPABASE_URL` and `RESTORE_SUPABASE_SERVICE_ROLE_KEY` can be omitted if `RESTORE_DATABASE_URL` points to `127.0.0.1` or `localhost` and `supabase status -o env` returns a service-role key.

## Backup Procedure

Run daily:

```bash
npm run recovery:manual-backup
```

The script creates:

```txt
.manual-dr-backups/
  backup-YYYY-MM-DD-HHMM/
    backup-YYYY-MM-DD-HHMM.sql
    backup-manifest.json
    backup-manifest.sha256
    storage/
      payment-screenshots/
      payment-qr-codes/
      invoices/
      gallery-images/
```

It then uploads the whole backup directory to the configured Google Drive remote and verifies that `backup-manifest.json` is visible in Drive.

Recommended cron:

```cron
15 19 * * * cd /home/charan_derangula/projects/sadhana-hostel && /usr/bin/npm run recovery:manual-backup >> /var/log/sadhana-manual-dr.log 2>&1
```

Use a time after daily hostel closeout so the practical RPO is close to the final operational state for the day.

## Restore Procedure

Download the target backup directory from Google Drive to the application host or recovery workstation.

Restore database into the isolated target only:

```bash
RESTORE_DATABASE_URL="postgresql://restore-target" \
npm run recovery:manual-restore-db -- .manual-dr-backups/backup-YYYY-MM-DD-HHMM
```

Restore storage into the isolated Supabase Storage target:

```bash
RESTORE_DATABASE_URL="postgresql://restore-target" \
RESTORE_SUPABASE_URL="https://restore-project.supabase.co" \
RESTORE_SUPABASE_SERVICE_ROLE_KEY="restore-service-role-key" \
npm run recovery:manual-restore-storage -- .manual-dr-backups/backup-YYYY-MM-DD-HHMM
```

Both restore scripts refuse to run if the restore target is the same as the production source target.

## Validation Procedure

After database and storage restore:

```bash
RESTORE_DATABASE_URL="postgresql://restore-target" \
RESTORE_SUPABASE_URL="https://restore-project.supabase.co" \
RESTORE_SUPABASE_SERVICE_ROLE_KEY="restore-service-role-key" \
npm run recovery:manual-validate -- .manual-dr-backups/backup-YYYY-MM-DD-HHMM
```

Validation fails if:

- Required table counts differ from the backup manifest.
- Required storage object counts differ from the backup manifest.
- Signed URL generation or object access fails for restored storage samples.
- Any required finance invariant is non-zero:
  - `verified_payments_missing_invoice`
  - `verified_payments_missing_receipt`
  - `paid_zero_balance_fee_records_missing_invoice`
  - `paid_invoice_payment_total_mismatch`

## RTO And RPO

RPO target:

- Maximum: 24 hours with daily backups.
- Practical: since the last successful `recovery:manual-backup` run.

RTO target:

- Database restore duration from `manual-db-restore-report.json`.
- Storage restore duration from `manual-storage-restore-report.json`.
- Validation duration from `recovery:manual-validate`.
- Total manual RTO is the sum of download time from Google Drive, DB restore, storage restore, validation, and cutover.

## GO / NO-GO

Manual DR is **GO** only when:

- `npm run recovery:manual-backup` completes and verifies Google Drive upload.
- `npm run recovery:manual-restore-db` completes against an isolated target.
- `npm run recovery:manual-restore-storage` completes against an isolated target.
- `npm run recovery:manual-validate` returns `goNoGo: "GO"`.

Manual DR is **NO-GO** if Google Drive upload is not configured, if restore was not executed, or if validation reports any blocker.
