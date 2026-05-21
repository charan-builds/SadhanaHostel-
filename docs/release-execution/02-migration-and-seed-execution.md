# Migration And Seed Execution

## Purpose

Bootstrap staging with clean schema, storage/RLS policies, and realistic synthetic data.

## Preconditions

- Supabase staging project created and linked.
- `.env.staging` values available locally or in CI secret store.
- Production credentials are not present in the shell.
- `npm run release:staging:preflight -- --strict` passes.

## Migration Replay Validation

Run against a disposable local or staging verification database:

```bash
MIGRATION_VERIFY_DATABASE_URL=postgresql://postgres:<password>@127.0.0.1:54322/postgres \
npm run recovery:migration-verify
```

Pass criteria:

- All files in `supabase/migrations` apply in order.
- Transaction rolls back successfully.
- No migration requires production-only state.

## Apply Migrations To Staging

Recommended:

```bash
supabase link --project-ref <staging-project-ref>
supabase db push
```

Alternative SQL execution:

```bash
for file in supabase/migrations/*.sql; do
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$file"
done
```

## Schema Drift Check

```bash
supabase db diff --linked
```

Pass criteria:

- No unexpected local/staging drift.
- Any intentional diff is converted to a migration before launch.

## Storage/RLS Validation

```sql
select relname, relrowsecurity, relforcerowsecurity
from pg_class
join pg_namespace on pg_namespace.oid = pg_class.relnamespace
where nspname = 'public'
  and relname in ('residents', 'payments', 'invoices', 'documents', 'leave_requests');
```

Expected:

- `relrowsecurity = true`
- `relforcerowsecurity = true` for tenant tables

## Staging Seed Execution

```bash
export NEXT_PUBLIC_APP_URL=https://staging.sadhanaboyshostel.example
export NEXT_PUBLIC_SUPABASE_URL=https://<staging-ref>.supabase.co
export SUPABASE_SERVICE_ROLE_KEY=<staging-service-role-key>
export STAGING_SEED_ORGANIZATION_ID=<uuid>
export STAGING_SEED_HOSTEL_ID=<uuid>
export STAGING_SEED_RESIDENT_COUNT=120
export STAGING_SEED_ROOM_COUNT=36
npm run staging:seed
```

The seed script refuses non-staging URLs outside development.

## Validation Queries

```sql
select count(*) as residents from public.residents where organization_id = '<org-id>';
select count(*) as rooms from public.rooms where organization_id = '<org-id>';
select count(*) as active_allocations from public.room_allocations where organization_id = '<org-id>' and status = 'active';
select count(*) as payments from public.payments where organization_id = '<org-id>';
select count(*) as invoices from public.invoices where organization_id = '<org-id>';
select count(*) as leaves from public.leave_requests where organization_id = '<org-id>';
select status, count(*) from public.monthly_fee_records where organization_id = '<org-id>' group by status;
```

## Financial Integrity Validation

```sql
select monthly_fee_record_id, count(*)
from public.invoices
where organization_id = '<org-id>'
  and monthly_fee_record_id is not null
  and deleted_at is null
group by monthly_fee_record_id
having count(*) > 1;

select room_id, count(*) as active_count, max(r.capacity) as capacity
from public.room_allocations ra
join public.rooms r on r.id = ra.room_id
where ra.organization_id = '<org-id>'
  and ra.status = 'active'
  and ra.deleted_at is null
group by room_id
having count(*) > max(r.capacity);
```

Expected: zero rows.

## Rollback Commands

Application rollback:

```bash
vercel rollback <deployment-url-or-id>
```

Database rollback:

- Prefer forward corrective migrations.
- For policy/function regression, re-apply last known-good function/policy migration.
- For destructive failure, execute Supabase PITR restore into a new project and cut over only after validation.

## Execution Record

| Step | Status | Owner | Timestamp | Evidence |
| --- | --- | --- | --- | --- |
| Migration replay | TODO | TODO | TODO | TODO |
| Staging migration apply | TODO | TODO | TODO | TODO |
| Schema drift check | TODO | TODO | TODO | TODO |
| Seed run | TODO | TODO | TODO | TODO |
| Integrity queries | TODO | TODO | TODO | TODO |
