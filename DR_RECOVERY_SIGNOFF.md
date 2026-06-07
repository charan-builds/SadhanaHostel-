# DR Recovery Signoff

Date: 2026-06-07

Branch: `backend-feature-migration`

Mode: disaster recovery implementation audit only. No production source code, migrations, UI, styling, layouts, providers, public pages, resident UI, finance UI, or navigation files were modified.

## Executive Verdict

Final DR decision: NO-GO

Recovery confidence: MEDIUM-LOW

The repository now contains meaningful manual disaster recovery tooling for backup creation, database restore, storage restore, and validation. However, the system is not yet a production DR GO because a full live backup, isolated restore, storage restore, and validation drill has not been completed and recorded.

The current implementation can support recovery from several disaster classes if a recent backup exists, credentials are available, and restore targets are isolated. It does not yet prove realistic recovery from all target scenarios because key controls are missing or unproven:

- No completed live DR drill evidence in this audit.
- Public-schema database dump does not cover Supabase Auth users or platform-managed auth state.
- Manual storage backup covers four buckets, while prior DR validation scope includes `resident-documents`.
- Restore isolation uses exact URL comparisons and can miss equivalent aliases for the same database/project.
- Secret redaction is strong in backup creation but inconsistent in restore and validation failure paths.
- RTO and RPO are estimated by tooling but not measured from a successful end-to-end drill.

## Scope Reviewed

Files and areas reviewed:

- `package.json`
- `docs/operations/manual-disaster-recovery-google-drive.md`
- `scripts/recovery/manual-google-drive-backup.ts`
- `scripts/recovery/manual-dr-common.ts`
- `scripts/recovery/restore-db.sh`
- `scripts/recovery/manual-storage-restore.ts`
- `scripts/recovery/restore-storage.sh`
- `scripts/recovery/manual-dr-validation.ts`
- `scripts/recovery/production-dr-evidence.ts`
- `scripts/recovery/backup-check.ts`
- `scripts/recovery/restore-validation.ts`
- `scripts/recovery/disaster-recovery-drill.ts`
- Related deployment/recovery docs referenced by recovery scripts and prior reports.

Reviewed capabilities:

- Backup creation
- Backup verification
- Database restore
- Storage restore
- Validation tooling
- Restore isolation protections
- Credential handling
- Secret redaction
- RTO estimation
- RPO estimation

## Backup Creation

Status: PARTIAL PASS

Implementation summary:

- `npm run recovery:manual-backup` runs `scripts/recovery/manual-google-drive-backup.ts`.
- Requires:
  - `DATABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `MANUAL_DR_GOOGLE_DRIVE_REMOTE` or `GOOGLE_DRIVE_BACKUP_REMOTE`
  - Google Drive backup account metadata.
- Enforces the expected Google Drive account email.
- Verifies the rclone remote is a Google Drive remote.
- Creates a local backup directory under `.manual-dr-backups/backup-<timestamp>/`.
- Runs `pg_dump` as a plain public-schema dump with:
  - `--format=plain`
  - `--no-owner`
  - `--no-privileges`
  - `--clean`
  - `--if-exists`
  - `--schema=public`
- Mirrors storage objects for:
  - `payment-screenshots`
  - `payment-qr-codes`
  - `invoices`
  - `gallery-images`
- Writes:
  - `database.sql`
  - `backup-manifest.json`
  - `backup-manifest.sha256`
  - downloaded storage object files
- Uploads the backup directory to Google Drive with rclone checksum mode.

Strengths:

- Backup flow is concrete and executable.
- Backup output is organized by timestamp.
- Manifest includes row counts, storage object counts, checksums, and duration metadata.
- `.manual-dr-backups/` is ignored by git.
- Backup errors redact known database URLs, service-role keys, and Postgres password parameters.

Gaps:

- Database dump is public-schema only and does not export Supabase Auth users or platform-managed auth state.
- Storage backup does not include `resident-documents`, while other recovery tooling references it as a production bucket.
- Backup verification confirms manifest upload visibility but does not independently download and checksum every remote object after upload.
- The implementation assumes manual or scheduled execution; no successful production backup run is proven in this audit.

## Backup Verification

Status: PARTIAL PASS

Implementation summary:

- Manifest checksum is generated with SHA-256.
- Storage object checksums are recorded.
- Google Drive upload uses rclone `--checksum`.
- The remote manifest is checked after upload.
- Validation tooling later compares restored row counts and storage object counts against the manifest.

Strengths:

- Manifest integrity is represented explicitly.
- Storage objects have per-object checksums in the manifest.
- Remote upload has a basic existence check.

Gaps:

- Remote backup verification stops at remote manifest visibility plus rclone checksum behavior.
- There is no required post-upload download verification of `database.sql`, every object, and manifest checksum from Google Drive.
- There is no automated freshness alert proving backups continue to complete within the expected daily RPO window.

## Database Restore

Status: PARTIAL PASS

Implementation summary:

- `npm run recovery:manual-restore-db -- <backup-dir>` runs `scripts/recovery/restore-db.sh`.
- Requires `RESTORE_DATABASE_URL`.
- Accepts either a backup directory or explicit SQL file.
- Refuses to run if `RESTORE_DATABASE_URL` exactly equals `DATABASE_URL`.
- Runs:

```bash
psql "$RESTORE_DATABASE_URL" -v ON_ERROR_STOP=1 -f "$SQL_FILE"
```

- Writes `manual-db-restore-report.json` with duration and restore metadata.

Strengths:

- Restore target must be explicit.
- Restore command fails on SQL errors.
- The dump includes `--clean --if-exists`, which supports restoring over an existing isolated target.
- Restore duration is recorded for RTO estimation.

Gaps:

- Exact string comparison between source and restore database URLs is not enough to prove isolation. The same database can be referenced by different credentials, hosts, pooler URLs, or connection aliases.
- Public-schema restore does not restore Supabase Auth users, auth identities, or other non-public platform-managed schema.
- Restore is destructive to the target because the dump contains clean statements. This is acceptable only when target isolation is proven.

## Storage Restore

Status: PARTIAL PASS

Implementation summary:

- `npm run recovery:manual-restore-storage -- <backup-dir>` runs `scripts/recovery/restore-storage.sh`, which calls `scripts/recovery/manual-storage-restore.ts`.
- Requires a backup manifest.
- Resolves restore storage credentials from:
  - `RESTORE_SUPABASE_URL`
  - `RESTORE_SUPABASE_SERVICE_ROLE_KEY`
  - fallback restore service-role variable
  - local Supabase status for local restore workflows.
- Refuses exact source/restore Supabase URL matches.
- Creates missing buckets using manifest metadata.
- Uploads objects with original content type and `upsert: true`.
- Writes `manual-storage-restore-report.json`.

Strengths:

- Storage restore is a real executable path.
- Bucket creation and object upload are automated.
- Restore duration and counts are recorded.
- Source and restore URL exact-match protection exists.

Gaps:

- Exact Supabase URL comparison does not prove different projects if aliases or environment mistakes exist.
- Missing `resident-documents` from the manual backup bucket set means full storage recovery is not guaranteed.
- Restore uses upsert, so stale extra objects in the restore target are not removed unless the restore target starts clean.
- Restore failure logging may print raw error objects without the same redaction guarantees used by backup creation.

## Validation Tooling

Status: PARTIAL PASS

Implementation summary:

- `npm run recovery:manual-validate -- <backup-dir>` runs `scripts/recovery/manual-dr-validation.ts`.
- Requires `RESTORE_DATABASE_URL`.
- Validates restore target isolation through helper checks.
- Compares restored database row counts with manifest row counts for critical tables.
- Compares restored storage object counts with manifest storage counts.
- Generates signed URLs for sample restored storage objects and verifies access.
- Runs finance invariant checks through `public.financial_reconciliation_counts`.
- Calculates RTO and RPO estimates from backup, restore, storage restore, and validation reports.
- Emits `goNoGo: "GO"` only when no blockers are found.

Strengths:

- Validation is tied to actual restored targets, not only source backup creation.
- Row counts, storage counts, signed URL access, and finance invariants are meaningful recovery checks.
- RTO/RPO reporting is integrated into validation output.

Gaps:

- Validation covers a critical subset of tables, not every public table.
- Finance invariant validation uses the first restored organization/hostel found, not all production tenants/hostels.
- Storage signed URL validation samples one object per bucket, not every restored object.
- Validation cannot detect missing Supabase Auth users because those are outside the public-schema backup.
- No successful validation report was produced during this audit.

## Restore Isolation Protections

Status: NEEDS HARDENING

Current protections:

- Database restore refuses identical `DATABASE_URL` and `RESTORE_DATABASE_URL` strings.
- Storage restore refuses identical `NEXT_PUBLIC_SUPABASE_URL` and `RESTORE_SUPABASE_URL` strings.
- Shared helper prevents a restore database URL from exactly matching the source URL.
- Restore runbook uses isolated restore targets.

Missing controls:

- No canonical database identity check before restore, such as comparing `current_database()`, host, project reference, or a known source marker.
- No Supabase project reference comparison between source and restore projects.
- No explicit "type YES to restore target" destructive action confirmation in scripts.
- No pre-restore target snapshot or target wipe verification.

Risk:

- A production restore could accidentally target the source database if the same DB is referenced through a different URL or credential.

Recommended fix:

- Add a canonical source-vs-restore identity check before database and storage restore.
- Require an explicit restore-target confirmation token.
- Document the restore target project reference in the manifest or validation report.

## Credential Handling

Status: PARTIAL PASS

Strengths:

- Backup creation validates required credentials before execution.
- Google Drive remote account is checked.
- Backup creation redacts known source database URLs, service-role keys, and Postgres password parameters from child-process errors.
- Restore scripts require restore-specific environment variables.
- The runbook separates source credentials from restore credentials.

Gaps:

- Some restore and validation scripts print raw error objects through `console.error(error)`.
- Supabase client errors can include URLs, request details, or provider messages.
- Redaction should be consistently applied to database restore, storage restore, validation, backup check, and drill scripts.

Recommended fix:

- Route all DR script error output through the same redaction helper used by backup creation.
- Redact source and restore URLs, service-role keys, access tokens, and Postgres password parameters.

## Secret Redaction

Status: PARTIAL PASS

Strongest path:

- `scripts/recovery/manual-google-drive-backup.ts` uses explicit redaction for known secrets and child-process error text.

Weaker paths:

- `scripts/recovery/manual-storage-restore.ts`
- `scripts/recovery/manual-dr-validation.ts`
- `scripts/recovery/backup-check.ts`
- `scripts/recovery/restore-validation.ts`
- `scripts/recovery/disaster-recovery-drill.ts`

Risk:

- A failed restore or validation command could leak sensitive connection or service-role information into CI logs, terminal history, or incident transcripts.

Recommended fix:

- Make redaction a shared DR helper and use it in all recovery scripts.

## RTO Estimation

Status: UNPROVEN

Current implementation:

- Backup creation records backup duration.
- Database restore writes `manual-db-restore-report.json`.
- Storage restore writes `manual-storage-restore-report.json`.
- Validation calculates estimated RTO from available backup, restore, storage restore, and validation duration data.

Estimated RTO:

- Current measured RTO: not available from this audit.
- Practical expected RTO: unknown until a successful live drill is completed.
- Operational expectation: likely measured in hours, depending on:
  - Google Drive backup download time
  - database dump size
  - storage object count and size
  - Supabase restore target availability
  - validation and cutover steps

Required proof:

- Run a full backup, isolated DB restore, storage restore, and validation drill.
- Record:
  - backup duration
  - restore DB duration
  - restore storage duration
  - validation duration
  - total elapsed incident-style recovery time
  - manual operator steps and delays

## RPO Estimation

Status: PARTIAL PASS

Current implementation:

- Manual validation reports row and object loss against the manifest.
- The backup report states a maximum expected RPO of 24 hours when daily backup automation succeeds.

Estimated RPO:

- With successful daily manual backup automation: up to 24 hours.
- With manual-only execution and no fresh backup: time since last successful backup.
- With failed backup monitoring absent: unbounded until failure is detected.
- With no PITR evidence in this audit: point-in-time recovery is not proven.

Required proof:

- Verify scheduled backup execution.
- Alert when the latest successful backup exceeds the accepted RPO window.
- Keep a dated recovery evidence record for the last successful backup and validation drill.

## Disaster Scenario Assessment

### Database Corruption

Confidence: MEDIUM-LOW

Can recover:

- Public-schema data can be restored from a recent `database.sql` backup into an isolated database target.
- Critical table counts and finance invariants can be validated after restore.

Cannot yet prove:

- Supabase Auth user restoration.
- Point-in-time recovery close to corruption time.
- Safe restore isolation through canonical target identity checks.

Verdict:

- Recoverable only to the last successful public-schema backup, with auth restoration caveats.

### Accidental Data Deletion

Confidence: MEDIUM-LOW

Can recover:

- Full public-schema snapshot can restore deleted rows to a clean target.
- Operators can manually extract data from restored target if needed.

Cannot yet prove:

- Single-record or tenant-specific rollback workflow.
- Point-in-time restore after a partial deletion event.
- Recovery of data created after the last backup.

Verdict:

- Recoverable as a full snapshot restore. Granular recovery remains manual and unproven.

### Infrastructure Loss

Confidence: LOW TO MEDIUM

Can recover:

- Public database schema/data and configured storage buckets can be restored into a new Supabase target if the Google Drive backup is available.
- DR scripts and runbook provide an executable path.

Cannot yet prove:

- Supabase Auth user restoration.
- Complete platform configuration restoration.
- Complete environment variable recreation.
- DNS, deployment target, secrets, and service integration recovery.

Verdict:

- Partial infrastructure recovery is realistic. Full platform recovery is not proven.

### Storage Loss

Confidence: MEDIUM for listed buckets, LOW for full storage estate

Can recover:

- Objects in `payment-screenshots`, `payment-qr-codes`, `invoices`, and `gallery-images` can be backed up and restored by the manual tooling.
- Restored bucket counts and sample signed URL access can be validated.

Cannot yet prove:

- Recovery of `resident-documents` or any bucket not included in the manual backup bucket list.
- Every restored object's remote checksum after Google Drive upload.
- Removal of stale extra objects in restore target when not starting from a clean target.

Verdict:

- Listed bucket recovery is realistic after a successful drill. Full storage recovery is incomplete until all production buckets are included.

## Risks

### Risk 1: No completed DR drill evidence

Impact:

- The tooling may work, but production recovery timing and correctness are unproven.

Recommended fix:

- Run the full manual DR flow and keep the generated reports:
  - backup report
  - database restore report
  - storage restore report
  - validation report

### Risk 2: Supabase Auth is outside the backup

Impact:

- Restored app data may exist without restored login identities.
- Users may need account recreation, invite replay, or manual account relinking.

Recommended fix:

- Define and test an auth recovery plan.
- Export or document recoverable auth identity state where Supabase permits.
- Validate login on restored environment.

### Risk 3: Storage bucket coverage is incomplete

Impact:

- Storage loss can permanently lose objects not included in the manual bucket list.

Recommended fix:

- Add every production storage bucket to the manual backup list, especially `resident-documents` if it is production-critical.
- Validate object counts and signed URL access for each bucket.

### Risk 4: Restore isolation can be bypassed by aliases

Impact:

- A destructive restore could run against production if the same target is referenced by a different URL.

Recommended fix:

- Add canonical source/restore project and database identity checks before restore.
- Require an explicit restore confirmation token.

### Risk 5: Secret redaction is inconsistent

Impact:

- Restore and validation failures can leak sensitive details into logs.

Recommended fix:

- Use a shared redaction helper across all DR scripts.

### Risk 6: Backup freshness is not externally monitored

Impact:

- RPO can silently drift beyond the expected 24-hour target.

Recommended fix:

- Add an alert when no successful backup has completed within the accepted RPO window.

## Missing Controls

Required before DR GO:

1. Successful end-to-end DR drill against an isolated restore target.
2. Evidence record for backup, database restore, storage restore, and validation.
3. Complete production bucket inventory in manual backup tooling.
4. Supabase Auth recovery plan and validation.
5. Canonical restore isolation checks.
6. Consistent secret redaction across all DR scripts.
7. Backup freshness monitoring and alerting.

Recommended after DR GO:

1. Remote backup full-download verification.
2. Object-level restore checksum validation.
3. Multi-tenant and all-hostel finance invariant validation.
4. Granular accidental-deletion recovery playbook.
5. Periodic scheduled DR drill cadence.

## Recovery Confidence

| Area | Confidence | Reason |
|---|---:|---|
| Backup creation | Medium | Concrete script and manifest exist, but no successful current run was executed in this audit. |
| Backup verification | Medium-Low | Manifest/checksum and remote manifest checks exist, but full remote re-download verification is missing. |
| Database restore | Medium-Low | Restore script is executable, but public-schema-only scope and isolation alias risk remain. |
| Storage restore | Medium for listed buckets, Low for full estate | Four buckets are covered; full production bucket inventory is not proven. |
| Validation tooling | Medium | Row counts, storage counts, signed URLs, and finance checks exist, but coverage is partial. |
| Credential safety | Medium-Low | Backup redaction is strong; restore/validation redaction is inconsistent. |
| Overall DR readiness | Medium-Low | Tooling exists, but live proof and several controls are missing. |

## Estimated RTO

Current measured RTO: unavailable.

Estimated RTO before drill: unknown; likely hours.

RTO formula:

```text
Google Drive backup retrieval time
+ database restore duration
+ storage restore duration
+ validation duration
+ environment cutover time
= total recovery time
```

RTO cannot be signed off until measured during a live drill.

## Estimated RPO

Current measured RPO: unavailable.

Best-case expected RPO:

- Up to 24 hours if daily backup automation completes successfully and alerting confirms freshness.

Current practical RPO:

- Time since last successful manual backup.
- Unbounded if backup freshness is not monitored.

Point-in-time recovery:

- Not proven by this implementation audit.

## Required Actions Before DR GO

1. Run `npm run recovery:manual-backup`.
2. Restore the backup into an isolated database target with `npm run recovery:manual-restore-db -- <backup-dir>`.
3. Restore storage into an isolated Supabase target with `npm run recovery:manual-restore-storage -- <backup-dir>`.
4. Run `npm run recovery:manual-validate -- <backup-dir>`.
5. Confirm validation returns `goNoGo: "GO"`.
6. Capture RTO and RPO evidence from generated reports.
7. Include all production storage buckets in the backup manifest.
8. Define and test Supabase Auth recovery.
9. Add canonical source/restore target identity checks.
10. Standardize secret redaction across all DR scripts.

## Final Signoff

The DR implementation is a strong foundation, but production recovery is not yet proven. It should not be signed off as production-ready until a full isolated restore drill passes and the missing controls above are addressed or explicitly accepted by the release owner.

NO-GO
