# Phase 1 Database Migration Report

Date: 2026-06-07

Scope: `PHASE_1_DATABASE_MIGRATION`

Allowed files:

- Supabase migration files
- Database type file

Forbidden areas not modified:

- UI
- layouts
- providers
- pages
- components

## Summary

Phase 1 database files are present on the current safety branch and validated against `origin/main`.

Allowed Phase 1 delta against `origin/main`:

- `supabase/migrations/20260606001000_resident_notice_reads.sql`
- `supabase/migrations/20260606002000_smart_notification_center.sql`
- `supabase/migrations/20260606003000_notice_acknowledgements.sql`
- `supabase/migrations/20260606004000_pwa_push_subscriptions.sql`
- `src/types/database.ts`

No UI, layout, provider, page, or component files were modified during this phase.

## Migrated Files

### Notice Reads

File:

- `supabase/migrations/20260606001000_resident_notice_reads.sql`

Creates:

- `public.notice_reads`
- Unique record per `(notice_id, resident_id)`
- Indexes for organization/hostel, notice, and resident read lookup
- Updated-at trigger
- Forced RLS

Policies:

- `notice_reads_select_owner_or_admin_or_resident`
- `notice_reads_insert_owner_or_admin_or_resident`
- `notice_reads_update_owner_or_admin_or_resident`

### Smart Notifications

File:

- `supabase/migrations/20260606002000_smart_notification_center.sql`

Updates:

- `public.notifications.category`
- `public.notifications.priority`
- `public.notifications.archived_at`
- `public.notifications.archived_by`

Adds indexes:

- `notifications_recipient_center_idx`
- `notifications_unread_center_idx`
- `notifications_archived_idx`

Notes:

- Existing notification rows are backfilled into `finance`, `hostel`, or `personal` categories.
- Existing notification rows are backfilled into `info`, `warning`, `urgent`, or `critical` priorities.

### Notice Acknowledgements

File:

- `supabase/migrations/20260606003000_notice_acknowledgements.sql`

Updates:

- `public.notices.notice_type`
- `public.notices.requires_acknowledgement`

Creates:

- `public.notice_acknowledgements`
- Unique record per `(notice_id, resident_id)`
- Indexes for organization/hostel, notice, and resident acknowledgement lookup
- Updated-at trigger
- Forced RLS

Policies:

- `notice_acknowledgements_select_owner_or_admin_or_resident`
- `notice_acknowledgements_insert_owner_or_admin_or_resident`
- `notice_acknowledgements_update_owner_or_admin_or_resident`

### Push Subscriptions

File:

- `supabase/migrations/20260606004000_pwa_push_subscriptions.sql`

Creates:

- `public.push_subscriptions`
- HTTPS endpoint check
- Non-negative failure-count check
- Unique endpoint constraint
- Active subscription indexes by user/resident/hostel
- Updated-at trigger
- Forced RLS

Policies:

- `push_subscriptions_select_owner_admin_or_self`
- `push_subscriptions_insert_self`
- `push_subscriptions_update_owner_admin_or_self`

### Database Types

File:

- `src/types/database.ts`

Validated type coverage:

- `notice_reads`
- `notice_acknowledgements`
- `push_subscriptions`
- `notices.notice_type`
- `notices.requires_acknowledgement`
- `notifications.category`
- `notifications.priority`
- `notifications.archived_at`
- `notifications.archived_by`

## Dependencies

Required existing tables:

- `public.organizations`
- `public.hostels`
- `public.users`
- `public.residents`
- `public.notices`
- `public.notifications`

Required existing helper functions:

- `public.can_manage_organization(...)`
- `public.owns_resident(...)`
- `public.belongs_to_organization(...)`
- `public.set_updated_at()`

Required extension/function support:

- `gen_random_uuid()`
- `auth.uid()`

## Migration Ordering

Verified order:

1. `20260606001000_resident_notice_reads.sql`
2. `20260606002000_smart_notification_center.sql`
3. `20260606003000_notice_acknowledgements.sql`
4. `20260606004000_pwa_push_subscriptions.sql`

Ordering is correct:

- Notice read tracking lands before acknowledgement analytics.
- Smart notification center columns land before notification archive/filter consumers.
- Notice acknowledgement columns/table land before acknowledgement APIs/services.
- Push subscriptions land after notification center schema.

## Validation Results

### Allowed File Delta

Command:

```bash
git diff --name-status origin/main..HEAD -- supabase/migrations src/types/database.ts
```

Result:

```text
M src/types/database.ts
A supabase/migrations/20260606001000_resident_notice_reads.sql
A supabase/migrations/20260606002000_smart_notification_center.sql
A supabase/migrations/20260606003000_notice_acknowledgements.sql
A supabase/migrations/20260606004000_pwa_push_subscriptions.sql
```

Command:

```bash
git diff --stat origin/main..HEAD -- src/types/database.ts supabase/migrations/20260606001000_resident_notice_reads.sql supabase/migrations/20260606002000_smart_notification_center.sql supabase/migrations/20260606003000_notice_acknowledgements.sql supabase/migrations/20260606004000_pwa_push_subscriptions.sql
```

Result:

```text
5 files changed, 662 insertions(+)
```

### Whitespace/Patch Check

Command:

```bash
git diff --check -- src/types/database.ts supabase/migrations/20260606001000_resident_notice_reads.sql supabase/migrations/20260606002000_smart_notification_center.sql supabase/migrations/20260606003000_notice_acknowledgements.sql supabase/migrations/20260606004000_pwa_push_subscriptions.sql
```

Result: PASS.

### Local Migration Application

Command:

```bash
supabase migration up --local
```

Result: PASS.

Notes:

- Local database had pending migrations before this phase.
- The command applied the pending local backlog plus the four Phase 1 migrations.
- No remote migrations were applied.

Applied Phase 1 migrations:

- `20260606001000_resident_notice_reads.sql`
- `20260606002000_smart_notification_center.sql`
- `20260606003000_notice_acknowledgements.sql`
- `20260606004000_pwa_push_subscriptions.sql`

### Migration History

Command:

```bash
supabase migration list --local
```

Result: PASS.

Local migration history includes:

```text
20260606001000 | 20260606001000 | 2026-06-06 00:10:00
20260606002000 | 20260606002000 | 2026-06-06 00:20:00
20260606003000 | 20260606003000 | 2026-06-06 00:30:00
20260606004000 | 20260606004000 | 2026-06-06 00:40:00
```

Remote linked migration history does not yet include these four migrations.

## Type Generation

### Linked Project Generation

Command:

```bash
supabase gen types typescript --linked > /tmp/sadhana-hostel-database.generated.ts
```

Result: PASS, but linked schema is behind Phase 1.

Evidence:

- Generated file: `6375` lines
- Missing Phase 1 tables:
  - `notice_reads`
  - `notice_acknowledgements`
  - `push_subscriptions`

Decision:

- Did not apply linked generated output to `src/types/database.ts` because it would remove required Phase 1 database types.

### Local Generation After Applying Migrations

Command:

```bash
supabase gen types typescript --local --schema public > /tmp/sadhana-hostel-database.local.public.after-phase1.ts
```

Result: PASS.

Evidence:

- Generated file: `6467` lines
- Contains:
  - `notice_reads`
  - `notice_acknowledgements`
  - `push_subscriptions`
  - `notices.requires_acknowledgement`
  - `notifications.archived_by`

Decision:

- Did not overwrite `src/types/database.ts` with the full local output because it rewrites many unrelated generated schema sections beyond the Phase 1 scope.
- Current `src/types/database.ts` already contains the required Phase 1 additive database types.

## RLS Verification

Command:

```sql
select c.relname as table_name,
       c.relrowsecurity as rls_enabled,
       c.relforcerowsecurity as rls_forced,
       count(p.polname) as policy_count
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
left join pg_policy p on p.polrelid = c.oid
where n.nspname = 'public'
  and c.relname in (
    'notice_reads',
    'notice_acknowledgements',
    'push_subscriptions',
    'notices',
    'notifications'
  )
group by c.relname, c.relrowsecurity, c.relforcerowsecurity
order by c.relname;
```

Result:

```text
notice_acknowledgements | rls_enabled=t | rls_forced=t | policy_count=3
notice_reads            | rls_enabled=t | rls_forced=t | policy_count=3
notices                 | rls_enabled=t | rls_forced=t | policy_count=4
notifications           | rls_enabled=t | rls_forced=t | policy_count=3
push_subscriptions      | rls_enabled=t | rls_forced=t | policy_count=3
```

RLS status: PASS.

Policy verification:

- `notice_reads`: owner/admin or owning resident can select, insert, update.
- `notice_acknowledgements`: owner/admin or owning resident can select, insert, update.
- `push_subscriptions`: owner/admin or same user can select/update; inserts require same user and organization membership.

## Column Verification

Local database confirms Phase 1 columns/tables exist:

- `notice_reads`: 11 expected columns
- `notice_acknowledgements`: 11 expected columns
- `push_subscriptions`: 20 expected columns
- `notices.notice_type`
- `notices.requires_acknowledgement`
- `notifications.category`
- `notifications.priority`
- `notifications.archived_at`
- `notifications.archived_by`

Column verification status: PASS.

## Security Test Gate

Command:

```bash
npm run test:security
```

Result: PASS.

Summary:

```text
Test Files  7 passed | 2 skipped (9)
Tests       69 passed | 3 skipped (72)
```

## Typecheck Status

Command:

```bash
npm run typecheck
```

Result: BLOCKED by generated `.next/dev` cache corruption.

Observed errors:

- `.next/dev/types/link.d.ts`
- `.next/dev/types/routes.d.ts`
- `.next/dev/types/validator.ts`

Reason:

- These are generated Next/Turbopack cache files, not Phase 1 migration or database type files.
- `.next/dev` was not cleared in this phase because this task was restricted to migration files and database types.

## Files Changed During This Phase

Source/database files:

- No new source edits were required during this phase because the Phase 1 migration files and additive database types were already present on the current safety branch.

Report file added:

- `PHASE_1_DATABASE_REPORT.md`

Local-only validation effects:

- Applied pending migrations to the local Supabase database with `supabase migration up --local`.
- Generated temporary type outputs under `/tmp`.
- Did not apply remote linked type output.
- Did not overwrite `src/types/database.ts` with broad full-file local generated output.

## GO / NO-GO

GO for Phase 1 database migration files and RLS validation.

NO-GO for promoting to production until:

- These four migrations are applied to the intended target database.
- Database types are regenerated from that target schema after migration application.
- The generated `.next/dev` cache issue is cleared in an environment-cleanup phase and `npm run typecheck` is rerun.
