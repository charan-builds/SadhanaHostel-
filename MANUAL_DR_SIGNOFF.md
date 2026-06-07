# Manual DR Signoff

Date: 2026-06-06

Final DR verdict: NO-GO

## Summary

Manual Google Drive disaster-recovery validation did not complete. The backup tooling is present and the Google Drive `rclone` remote exists, but the configured source database endpoint cannot be reached from this runner because it resolves only to IPv6 and the environment has no route to that IPv6 address.

No actual database backup was created, no checksum manifest was generated, no Google Drive upload occurred, and no restore validation could be executed. Per the release rule, this is NO-GO.

## Evidence

Environment and tooling checks:

- `rclone` found at `/usr/bin/rclone`
- `pg_dump` found at `/usr/bin/pg_dump`
- `psql` found at `/usr/bin/psql`
- `rclone listremotes` returned `gdrive:`
- `DATABASE_URL`: set
- `RESTORE_DATABASE_URL`: set
- `NEXT_PUBLIC_SUPABASE_URL`: set
- `SUPABASE_SERVICE_ROLE_KEY`: set
- `MANUAL_DR_GOOGLE_DRIVE_REMOTE`: set
- `RESTORE_SUPABASE_URL`: missing
- `RESTORE_SUPABASE_SERVICE_ROLE_KEY`: missing

DNS check for configured database host:

- Host: `db.mcooiwyerrmeixdtykpj.supabase.co`
- IPv4/A record: `ENODATA`
- IPv6/AAAA record: `2406:da1a:b00:1301:995b:9d13:db79:f83b`

Backup command:

```bash
npm run recovery:manual-backup
```

Result:

- Initial run failed because `.manual-dr-backups` did not exist.
- Fixed `scripts/recovery/manual-google-drive-backup.ts` so the backup root is created before the timestamped backup directory.
- Retry reached `pg_dump`, then failed with:

```text
pg_dump: error: connection to server at "db.mcooiwyerrmeixdtykpj.supabase.co" (2406:da1a:b00:1301:995b:9d13:db79:f83b), port 5432 failed: Network is unreachable
```

Security hardening applied:

- The backup script now redacts configured database and service-role secrets from child-process failure logs.

## Required DR Checks

| Check | Status | Evidence |
| --- | --- | --- |
| Backup creation | FAIL | `pg_dump` could not connect to the configured source DB |
| Google Drive upload | NOT RUN | No valid backup directory/manifest existed to upload |
| Checksum manifest | NOT RUN | Backup did not complete |
| Database restore | NOT RUN | No valid backup existed |
| Storage restore | NOT RUN | No valid backup existed; restore storage env is also incomplete |
| Finance validation | NOT RUN | Restore target was not populated |

## Root Cause

The configured direct Supabase database host is IPv6-only from this environment. The runner cannot route to that IPv6 address, so `pg_dump` cannot create the source backup.

## Required Before GO

- Configure a reachable IPv4-compatible database backup URL, usually the Supabase pooler/session connection string, or run DR backup from an IPv6-capable host.
- Configure restore storage credentials:
  - `RESTORE_SUPABASE_URL`
  - `RESTORE_SUPABASE_SERVICE_ROLE_KEY`
- Rerun:

```bash
npm run recovery:manual-backup
npm run recovery:manual-restore-db -- <backup-dir>
npm run recovery:manual-restore-storage -- <backup-dir>
npm run recovery:manual-validate -- <backup-dir>
```

- Attach the generated `backup-manifest.json`, `backup-manifest.sha256`, `manual-db-restore-report.json`, `manual-storage-restore-report.json`, and validation JSON output.

