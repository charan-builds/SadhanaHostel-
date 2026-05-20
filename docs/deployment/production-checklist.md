# Production Deployment Checklist

## Environments

| Environment | Purpose |
| --- | --- |
| Local | Developer iteration |
| Staging | Migration, integration, and UAT validation |
| Production | Live tenant workloads |

## Required Checks

- `npm run check`
- `npm test`
- `npm run test:coverage`
- Supabase migration validation
- RLS security tests
- Environment variable validation
- Storage bucket policy validation

## Secrets

- Use Vercel environment variables for app secrets.
- Never expose service role keys with `NEXT_PUBLIC_`.
- Rotate Supabase service role keys after incidents or contractor offboarding.

## Release Safety

- Run migrations before deploying code that depends on new schema.
- Keep invoice and payment records immutable.
- Validate background job idempotency before enabling cron schedules.
- Confirm backups and PITR for production Supabase.
