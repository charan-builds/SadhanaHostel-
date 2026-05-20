# Staging Environment Architecture

## Purpose

Define a production-like staging strategy for the Sadhana Boys Hostel Platform without risking production tenant data, payment records, or resident documents.

## Scope

- Vercel staging deployment
- Supabase staging project
- Resend test sending mode
- Isolated tenant seed data
- Migration and recovery verification
- Promotion workflow from staging to production

## Environment Separation

| Concern | Staging | Production |
| --- | --- | --- |
| Vercel project | `sadhana-hostel-staging` or preview alias | `sadhana-hostel-production` |
| Supabase project | Dedicated staging project | Dedicated production project |
| Database data | Synthetic and anonymized only | Real operational data |
| Storage buckets | Separate staging buckets | Separate production buckets |
| Resend domain | Sandbox/test sender | Verified hostel domain |
| Cron secret | Separate random secret | Separate random secret |
| Cashfree | Sandbox only | Production credentials |

## Required Environment Variables

```text
NEXT_PUBLIC_APP_URL=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
CRON_SECRET=
RESEND_API_KEY=
EMAIL_FROM=
EMAIL_REPLY_TO=
NOTIFICATIONS_SEND_ENABLED=false
RATE_LIMIT_ENABLED=true
STORAGE_SIGNED_URL_TTL_SECONDS=3600
```

## Deployment Flow

1. Merge feature branches into `backend-dev` or `frontend-dev`.
2. Open pull request into `main`.
3. Vercel preview runs lint, typecheck, tests, and build.
4. Apply migrations to staging Supabase.
5. Run smoke checks against `/api/health/live`, `/api/health/ready`, `/api/v1/openapi`, and one authenticated admin API.
6. Run recovery scripts against staging:

```bash
npm run recovery:backup-check
npm run recovery:migration-verify
npm run recovery:restore-validation
```

7. Promote only after staging checks pass.

## Staging Data Policy

- Use synthetic residents, rooms, payments, and notices.
- Never restore production data into staging unless it is anonymized first.
- Use separate storage buckets and signed URLs.
- Keep notification sending disabled by default.

## Cron Testing

Vercel cron invokes `GET /api/cron/:name` with `Authorization: Bearer $CRON_SECRET`.

Manual staging test:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" \
  "$NEXT_PUBLIC_APP_URL/api/cron/payment-reminders"
```

Cron endpoints must remain `force-dynamic` and must not redirect.

## Promotion Checklist

- [ ] Migrations replay successfully on a disposable database.
- [ ] RLS policies verified with staging users.
- [ ] Export endpoints tested with a capped dataset.
- [ ] Search returns only tenant-scoped records.
- [ ] Realtime channels use tenant-scoped names.
- [ ] Cron secret is configured and rotated.
- [ ] Resend sender/domain is verified before enabling live email.
- [ ] Backup and restore validation scripts pass.

## Future Expansion

- Add anonymized production snapshot pipeline.
- Add durable queue provider for long-running jobs.
- Add staging-only synthetic payment webhook replay.
- Add disaster recovery rehearsal calendar and sign-off record.
