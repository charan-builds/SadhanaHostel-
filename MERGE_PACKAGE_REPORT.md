# Merge Package Report

Date: 2026-06-07

Branch: `backend-feature-migration`

Baseline: `origin/main`

Candidate commit: `b4d759a feat: notices, smart notifications, push subscriptions, pwa core and DR tooling`

Mode: merge package verification. No source code was modified, no commits were created, no files were reformatted, and no auto-fixes were run. This report is the only file generated for this request.

## Final Output

DO NOT PUSH

Validation passed, but the candidate merge package contains excluded root audit/report/signoff artifacts. This is a packaging blocker, not a code-quality blocker.

## 1. Current Git Status

Observed before generating this report:

```text
backend-feature-migration
b4d759a (HEAD -> backend-feature-migration, origin/backend-feature-migration) feat: notices, smart notifications, push subscriptions, pwa core and DR tooling
d9b0f7b (origin/main, main) updated
?? FINAL_PRE_COMMIT_CHECKLIST.md
```

Notes:

- The branch is already committed at `b4d759a`.
- The branch is already present at `origin/backend-feature-migration`.
- `FINAL_PRE_COMMIT_CHECKLIST.md` was untracked before this report and must not be included in a production merge commit.
- `MERGE_PACKAGE_REPORT.md` is now also an untracked generated report and must not be included in a production merge commit.

## 2. Files In The Candidate Merge Commit

The following files are currently included in `origin/main..HEAD`:

```text
.gitignore
BLOCKER_FIX_REPORT.md
CLEAN_BACKEND_MIGRATION_REPORT.md
CLEAN_MIGRATION_PLAN.md
FINAL_PRODUCTION_SIGNOFF.md
FINAL_RELEASE_AUDIT.md
KEEP_FILES_VALIDATION_REPORT.md
MIGRATION_EXECUTION_ORDER.md
PHASE_1_DATABASE_REPORT.md
PHASE_2_BACKEND_REPORT.md
PHASE_3_API_REPORT.md
PHASE_4_PWA_REPORT.md
PRE_MERGE_PRODUCTION_AUDIT.md
PRODUCTION_DELTA_REPORT.md
docs/operations/manual-disaster-recovery-google-drive.md
next.config.ts
package-lock.json
package.json
pnpm-lock.yaml
public/sw.js
scripts/recovery/manual-dr-common.ts
scripts/recovery/manual-dr-validation.ts
scripts/recovery/manual-google-drive-backup.ts
scripts/recovery/manual-storage-restore.ts
scripts/recovery/restore-db.sh
scripts/recovery/restore-storage.sh
src/app/api/notices/[id]/acknowledge/route.ts
src/app/api/notices/[id]/read/route.ts
src/app/api/notifications/[id]/archive/route.ts
src/app/api/notifications/push-subscriptions/revoke/route.ts
src/app/api/notifications/push-subscriptions/route.ts
src/app/manifest.ts
src/app/pwa-icon/[size]/route.tsx
src/jobs/payment-reminder.job.ts
src/jobs/scheduled-notices.job.ts
src/jobs/scheduler/cron-registry.ts
src/lib/notices/audience.ts
src/lib/notices/notification-classification.ts
src/lib/notifications/catalog.ts
src/lib/pwa/client.ts
src/repositories/index.ts
src/repositories/notice-acknowledgements.repository.ts
src/repositories/notice-reads.repository.ts
src/repositories/notices.repository.ts
src/repositories/notifications.repository.ts
src/repositories/push-subscriptions.repository.ts
src/repositories/residents.repository.ts
src/sdk/analytics.sdk.ts
src/sdk/notices.sdk.ts
src/sdk/notifications.sdk.ts
src/sdk/residents.sdk.ts
src/services/analytics.service.ts
src/services/auth.service.ts
src/services/notices.service.ts
src/services/notifications/notification.service.ts
src/services/notifications/types.ts
src/services/pwa/push-subscriptions.service.ts
src/services/pwa/web-push.service.ts
src/services/residents.service.ts
src/services/support.service.ts
src/tests/security/migration-security-static.test.ts
src/tests/security/tenant-isolation-static.test.ts
src/tests/unit/jobs/payment-reminder-smart.test.ts
src/tests/unit/lib/notice-notification-classification.test.ts
src/tests/unit/lib/notifications-catalog.test.ts
src/tests/unit/scripts/manual-dr-common.test.ts
src/tests/unit/scripts/recovery-dr-contracts.test.ts
src/tests/unit/services/analytics.service.test.ts
src/tests/unit/services/notices.service.test.ts
src/tests/unit/services/notification.service.test.ts
src/tests/unit/services/push-subscriptions.service.test.ts
src/tests/unit/services/residents.service.test.ts
src/tests/unit/services/support.service.test.ts
src/tests/unit/services/web-push.service.test.ts
src/types/database.ts
src/types/notices.ts
src/types/residents.ts
src/validations/notice.validation.ts
src/validations/notification.validation.ts
src/validations/pwa.validation.ts
supabase/migrations/20260606001000_resident_notice_reads.sql
supabase/migrations/20260606002000_smart_notification_center.sql
supabase/migrations/20260606003000_notice_acknowledgements.sql
supabase/migrations/20260606004000_pwa_push_subscriptions.sql
```

## 3. Excluded Files Found In Candidate Commit

Status: FAIL

These files are excluded by the merge packaging rule and are already committed in `origin/main..HEAD`:

```text
BLOCKER_FIX_REPORT.md
CLEAN_BACKEND_MIGRATION_REPORT.md
FINAL_PRODUCTION_SIGNOFF.md
FINAL_RELEASE_AUDIT.md
KEEP_FILES_VALIDATION_REPORT.md
MIGRATION_EXECUTION_ORDER.md
PHASE_1_DATABASE_REPORT.md
PHASE_2_BACKEND_REPORT.md
PHASE_3_API_REPORT.md
PHASE_4_PWA_REPORT.md
PRE_MERGE_PRODUCTION_AUDIT.md
PRODUCTION_DELTA_REPORT.md
```

Additional non-runtime planning artifact in the candidate commit:

```text
CLEAN_MIGRATION_PLAN.md
```

Reason this blocks push/merge:

- The requested package rule excludes report/audit/checklist/signoff files from the production merge commit.
- The requested final scope allows backend/runtime/tooling/test files only.
- These root markdown artifacts are not required for production runtime, migrations, backend tests, or DR tooling.

## 4. Exact Commit Diff Summary

Current exact diff summary for `origin/main..HEAD`:

```text
84 files changed, 11725 insertions(+), 79 deletions(-)
```

Notable stat entries include:

```text
BLOCKER_FIX_REPORT.md                              | 197 +++++
CLEAN_BACKEND_MIGRATION_REPORT.md                  | 252 ++++++
CLEAN_MIGRATION_PLAN.md                            | 576 ++++++++++++
FINAL_PRODUCTION_SIGNOFF.md                        | 218 +++++
FINAL_RELEASE_AUDIT.md                             | 296 +++++++
KEEP_FILES_VALIDATION_REPORT.md                    | 462 ++++++++++
MIGRATION_EXECUTION_ORDER.md                       | 286 ++++++
PHASE_1_DATABASE_REPORT.md                         | 440 +++++++++
PHASE_2_BACKEND_REPORT.md                          | 287 ++++++
PHASE_3_API_REPORT.md                              | 399 +++++++++
PHASE_4_PWA_REPORT.md                              | 431 +++++++++
PRE_MERGE_PRODUCTION_AUDIT.md                      | 533 +++++++++++
PRODUCTION_DELTA_REPORT.md                         | 982 +++++++++++++++++++++
```

The source/runtime/test part of the diff otherwise matches the intended backend migration scope.

## 5. Allowed Scope Verification

Status: PASS for source/runtime/test files, FAIL for committed report artifacts

Confirmed source/runtime/test files are within the allowed categories:

- Migrations
- Repositories
- Services
- APIs
- PWA core
- Push infrastructure
- Analytics backend
- Resident enrichment
- Support permission fix
- DR tooling
- Backend/security tests

Forbidden UI/artifact path scan against `origin/main..HEAD`: PASS

No changed files were found for:

- Homepage
- Hero
- Gallery
- Facilities
- Testimonials
- Inquiry section
- Navbar
- Translations
- Images
- Providers
- Layouts
- Resident dashboard UI
- Resident finance UI
- Mobile navigation
- Public UI
- Generated artifacts
- Lighthouse files
- Browser profile files

## 6. Final Validation Results

Status: PASS

### `npm run lint`

Result: PASS

```text
> sadhana-hostel@0.1.0 lint
> eslint
```

### `npm run typecheck`

Result: PASS

```text
> sadhana-hostel@0.1.0 typecheck
> tsc --noEmit
```

### `npm run test`

Result: PASS

```text
Test Files  108 passed | 3 skipped (111)
Tests       508 passed | 5 skipped (513)
```

Note: expected negative-path test logs appeared during the run. They did not fail the suite.

### `npm run test:security`

Result: PASS

```text
Test Files  7 passed | 2 skipped (9)
Tests       69 passed | 3 skipped (72)
```

### `npm run build`

Result: PASS

```text
Compiled successfully
Generated static pages using 15 workers (37/37)
```

New routes present in build output include:

- `/api/notices/[id]/acknowledge`
- `/api/notices/[id]/read`
- `/api/notifications/[id]/archive`
- `/api/notifications/push-subscriptions`
- `/api/notifications/push-subscriptions/revoke`
- `/pwa-icon/[size]`

## 7. Commit And Push Commands

Not provided.

Reason:

- The validation suite passed, but the merge package failed the exclusion check.
- The current branch commit already includes excluded report/audit/signoff artifacts.
- Providing push commands would conflict with the requested packaging rule.

## Real Blockers

1. `origin/main..HEAD` includes excluded root report/audit/signoff files.
2. `origin/main..HEAD` includes `CLEAN_MIGRATION_PLAN.md`, a non-runtime planning artifact outside the approved production backend/test/tooling scope.
3. `FINAL_PRE_COMMIT_CHECKLIST.md` is currently untracked and must remain excluded from any production merge commit.
4. `MERGE_PACKAGE_REPORT.md` is generated by this task and must remain excluded from any production merge commit.

## Final Decision

DO NOT PUSH

The backend code validates successfully, but the branch is not merge-packaged cleanly. The production merge package must exclude the committed report/audit/signoff/planning markdown artifacts before it is ready to push or merge.
