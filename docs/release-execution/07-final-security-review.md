# Final Security Review Checklist

## Purpose

Validate security controls before soft launch and identify launch-blocking risks.

This review focuses on staging evidence for tenant isolation, RLS, storage policies, cron protection, realtime isolation, upload ownership, signed URLs, and service-role containment.

## Severity Definitions

| Severity | Definition | Launch Decision |
|---|---|---|
| Critical | Enables unauthorized data access, tenant crossover, financial mutation, or service-role exposure | No launch |
| High | Weakens production security or auditability but has a contained workaround | Fix before broad rollout |
| Medium | Operational or UX security gap with low exploitability | Track before/after soft launch |
| Low | Documentation or hardening improvement | Track |

## Environment Separation

- [ ] Staging Supabase project is separate from production.
- [ ] Staging Vercel project/environment is separate from production.
- [ ] Staging Sentry environment is separate from production.
- [ ] Staging Resend domain/API key is separate from production.
- [ ] Staging cron secret differs from production.
- [ ] No production secrets exist in `.env.staging`, Vercel staging env vars, or CI staging secrets.
- [ ] `.env.local`, `.env.staging`, and service-role keys are ignored by Git.

## Secret Handling

- [ ] `SUPABASE_SERVICE_ROLE_KEY` is server-only.
- [ ] No service-role key is referenced by client components.
- [ ] No service-role key appears in browser bundles.
- [ ] `NEXT_PUBLIC_` variables contain only public-safe values.
- [ ] Sentry auth token is CI/server-only.
- [ ] Resend API key is server-only.
- [ ] Cron secret is server-only.

Suggested checks:

```bash
rg "SUPABASE_SERVICE_ROLE_KEY|RESEND_API_KEY|CRON_SECRET|SENTRY_AUTH_TOKEN" src
npm run build
```

Review any matches manually. Server-only references are acceptable; client component references are blockers.

## RLS And Tenant Isolation

Execute these tests with separate staging admin/resident users from different organizations:

- [ ] Resident A cannot read Resident B profile.
- [ ] Resident A cannot read Resident B payments.
- [ ] Resident A cannot read Resident B documents.
- [ ] Admin A cannot read Organization B residents.
- [ ] Admin A cannot manage Organization B rooms.
- [ ] Super admin access is intentionally scoped and audited.
- [ ] Anonymous users cannot access private ERP records.

Launch blockers:

- Any cross-tenant read or mutation succeeds.
- Any unauthenticated private data access succeeds.

## Storage Security

- [ ] Aadhaar uploads are private.
- [ ] Profile photos follow intended visibility.
- [ ] Payment proofs are private to owner and authorized admins.
- [ ] Gallery images are public only when intended.
- [ ] Invoice PDFs require authorized signed access.
- [ ] Signed URLs expire.
- [ ] File MIME and size validation is enforced before upload.
- [ ] Upload ownership is validated before linking to business records.

## Payment And Invoice Security

- [ ] Payment proof is mandatory before verification.
- [ ] Verified payments are immutable from resident flows.
- [ ] Duplicate verification is blocked.
- [ ] Invoice creation is unique per monthly fee record.
- [ ] Invoice numbering is transaction-safe.
- [ ] Payment and invoice actions write audit records.
- [ ] Payment screenshots are previewed using signed URLs only.

## Realtime Isolation

- [ ] Realtime channels use staging namespace and tenant-safe channel names.
- [ ] Resident receives only own payment/leave events.
- [ ] Admin receives only organization events.
- [ ] Cross-tenant event attempts fail.
- [ ] Reconnect does not resubscribe to stale tenant context.

## Cron Security

- [ ] Cron routes require `CRON_SECRET`.
- [ ] Invalid cron secret returns 401 or 403.
- [ ] Cron routes do not expose job internals publicly.
- [ ] Cron logs include request ID and environment.
- [ ] Jobs are idempotent under repeated requests.

## XSS And Unsafe Rendering

- [ ] CMS-rendered content is sanitized or rendered as plain text.
- [ ] Notice content does not execute HTML/script.
- [ ] Error messages do not render raw server stack traces.
- [ ] File names are displayed safely.

## Signoff Matrix

| Area | Owner | Status | Evidence |
|---|---|---|---|
| Environment separation | TODO | TODO | TODO |
| RLS tenant isolation | TODO | TODO | TODO |
| Storage policies | TODO | TODO | TODO |
| Financial safety | TODO | TODO | TODO |
| Realtime isolation | TODO | TODO | TODO |
| Cron protection | TODO | TODO | TODO |
| Secret handling | TODO | TODO | TODO |

