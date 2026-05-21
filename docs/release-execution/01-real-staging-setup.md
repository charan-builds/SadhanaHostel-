# Real Staging Setup Execution

## Purpose

Execute a real, isolated staging environment for Sadhana Boys Hostel Platform across Supabase, Vercel, Sentry, Resend, and k6.

## Current Execution Status

| Item | Status | Evidence |
| --- | --- | --- |
| Supabase CLI available locally | Ready | `supabase` found in PATH |
| Vercel CLI available locally | Blocked | Install `vercel` or run through CI/Vercel dashboard |
| k6 available locally | Blocked | Install `k6` before load testing |
| Sentry CLI available locally | Optional | Useful for release/source-map checks |
| Staging credentials present | Blocked | Fill real `.env.staging` locally or Vercel env vars |

Run preflight:

```bash
npm run release:staging:preflight
npm run release:staging:preflight -- --strict
```

## 1. Create Supabase Staging Project

Use a separate Supabase project. Never reuse production project refs, storage buckets, or service role keys.

```bash
supabase login
supabase projects create sadhana-hostel-staging --org-id <supabase-org-id>
supabase link --project-ref <staging-project-ref>
```

Record:

| Field | Value |
| --- | --- |
| Supabase project ref | TODO |
| Region | TODO |
| Database password location | TODO |
| Staging owner | TODO |

## 2. Configure Supabase Storage

Required buckets:

```text
resident-documents
payment-screenshots
gallery-images
invoices
```

Apply migrations first because storage policies are in SQL migrations.

## 3. Create Vercel Staging Project

Option A, separate Vercel project:

```bash
npm i -g vercel
vercel login
vercel link --project sadhana-hostel-staging
vercel env add NEXT_PUBLIC_APP_URL staging
vercel env add NEXT_PUBLIC_SUPABASE_URL staging
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY staging
vercel env add SUPABASE_SERVICE_ROLE_KEY staging
vercel env add CRON_SECRET staging
vercel env add SENTRY_DSN staging
vercel env add NEXT_PUBLIC_SENTRY_DSN staging
```

Option B, preview deployments with staging aliases:

```bash
vercel --target preview
vercel alias set <deployment-url> staging.sadhanaboyshostel.example
```

## 4. Configure Sentry Staging

Create a staging environment in the same Sentry project or a dedicated staging project.

Required:

```text
SENTRY_ENVIRONMENT=staging
NEXT_PUBLIC_SENTRY_ENVIRONMENT=staging
SENTRY_DSN=<server dsn>
NEXT_PUBLIC_SENTRY_DSN=<browser dsn>
```

Validation:

- Trigger one test frontend error in staging.
- Trigger one test API error in staging.
- Confirm both include `environment=staging`, route, requestId, userId when authenticated, and tenantId when present.

## 5. Configure Resend Staging

Use sandbox/test recipients first:

```text
NOTIFICATIONS_SEND_ENABLED=false
RESEND_API_KEY=<staging key>
EMAIL_FROM=Sadhana Boys Hostel Staging <onboarding@resend.dev>
EMAIL_REPLY_TO=ops-staging@example.com
```

Enable sending only after onboarding/payment/leave templates are verified.

## 6. Staging Verification Checklist

- [ ] `.env.staging.example` copied into provider secret stores with real staging values.
- [ ] No production project refs or keys in staging.
- [ ] Supabase migrations applied.
- [ ] Storage buckets exist.
- [ ] RLS policies enabled.
- [ ] `/api/health/live` passes.
- [ ] `/api/health/ready` passes.
- [ ] Protected routes redirect before rendering.
- [ ] Synthetic staging data loaded.
- [ ] Sentry staging events captured.
- [ ] Resend sending remains disabled until explicitly approved.
