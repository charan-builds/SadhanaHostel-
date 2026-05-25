# Secret Management and Incident Response

## Rules

- Never commit `.env`, `.env.local`, `.env.staging`, `.env.production`, `.env.sentry-build-plugin`, service-account JSON, private keys, or generated secret reports.
- Only commit redacted example contracts such as `.env.example` and `.env.staging.example`.
- Never expose server-only variables with a `NEXT_PUBLIC_` prefix.
- `SUPABASE_SERVICE_ROLE_KEY`, `SENTRY_AUTH_TOKEN`, `RESEND_API_KEY`, Redis tokens, cron secrets, invite-token secrets, and payment-provider secrets are server-only.
- Local development secrets live only in ignored env files. Staging and production secrets live in Vercel/Supabase/Sentry/Resend secret stores.

## Local Protection

The repository includes a pre-commit hook in `.githooks/pre-commit`.

Enable it after cloning:

```bash
git config core.hooksPath .githooks
```

The hook runs:

```bash
npm run security:secrets:staged
```

If `gitleaks` is installed locally, the hook also runs:

```bash
gitleaks protect --staged --redact --verbose
```

Manual full-repo scan:

```bash
npm run security:secrets
gitleaks detect --redact --verbose --config .gitleaks.toml
```

## CI Protection

`.github/workflows/secret-scanning.yml` runs on pushes and pull requests:

- Gitleaks full-history scan.
- Redacted repository pattern scan.

Pull requests must fail closed when secret-like values are detected.

## Rotation Procedure

When any secret is suspected to be exposed:

1. Treat the credential as compromised immediately.
2. Revoke or rotate the credential in the provider console.
3. Replace the secret in Vercel/Supabase/Sentry/Resend/Upstash environment stores.
4. Redeploy staging and production so all runtimes use the rotated value.
5. Remove the secret from tracked files.
6. Rewrite Git history to remove the exposed value and any env files containing it.
7. Force-push the sanitized branch with `--force-with-lease`.
8. Ask every collaborator to reclone or run the documented cleanup commands.
9. Re-run CI secret scanning and GitHub push protection.
10. Record the incident, affected secret classes, rotation time, and verification output.

## Supabase Service Role Incident Checklist

1. In Supabase, rotate the leaked service role key for every affected project.
2. Rotate the anon key if it appeared alongside the service role key.
3. Check Supabase Auth logs and Postgres logs for unexpected service-role activity.
4. Rotate related credentials stored near the leak, including Resend, Sentry build token, Redis, cron, and invite-token secrets.
5. Update Vercel environment variables for preview, staging, and production.
6. Trigger a clean redeploy.
7. Run:

```bash
npm run security:secrets
git log --all --date=short --pretty=format:'%h %ad %s' -G 'eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+'
```

The `git log` command should return no commits after history sanitization.

## History Sanitization

Preferred tool:

```bash
git filter-repo --path .env --path .env.local --path .env.staging --path .env.production \
  --path .env.example --path .env.staging.example --path .env.sentry-build-plugin \
  --invert-paths --force
```

After rewrite:

```bash
git reflog expire --expire=now --all
git gc --prune=now --aggressive
git log --all --date=short --pretty=format:'%h %ad %s' -G 'SUPABASE_SERVICE_ROLE_KEY|eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+'
git push origin main --force-with-lease
```

Important: rewrite only after preserving uncommitted work. Everyone with an old clone must reclone or reset to the rewritten branch.

## Environment Separation

- Local: ignored `.env.local`; disposable Supabase project only.
- Staging: separate Supabase project, Vercel project/environment, Sentry environment, Resend key, storage buckets, cron secret, and seed data.
- Production: separate project and secrets; no staging or local credentials reused.

## Frontend Boundary

Only these values may be exposed client-side:

- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_DEFAULT_ORGANIZATION_ID`
- `NEXT_PUBLIC_DEFAULT_HOSTEL_ID`
- `NEXT_PUBLIC_LAUNCH_MODE`
- `NEXT_PUBLIC_MAINTENANCE_MODE`
- `NEXT_PUBLIC_FEATURE_FLAGS`
- `NEXT_PUBLIC_SENTRY_DSN`
- `NEXT_PUBLIC_SENTRY_ENVIRONMENT`
- `NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE`

All other secrets are server-only.
