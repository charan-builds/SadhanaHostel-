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
- Production SEO checks:
  - `NEXT_PUBLIC_APP_URL` points to the live domain.
  - `NEXT_PUBLIC_LAUNCH_MODE=production` and `LAUNCH_MODE=production` are set only for the live domain.
  - `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION` is set after creating the Google Search Console property.
  - `/robots.txt` allows public pages and blocks admin, resident, API, auth, and reset surfaces.
  - `/sitemap.xml` contains the Pulivendula landing pages and no localhost/preview URLs.
  - Google Search Console ownership is verified and the production sitemap is submitted.
  - Google Business Profile name, address, phone, website, and photos match the public site.
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
