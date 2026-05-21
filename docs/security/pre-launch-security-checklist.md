# Pre-Launch Security Checklist

## Purpose

Final security validation checklist before staging promotion or production launch.

## Authentication And Sessions

- [ ] `/admin/*` and `/resident/*` are server-side protected.
- [ ] Unauthenticated protected requests redirect before dashboard UI renders.
- [ ] Admin roles cannot access resident-only pages unless explicitly allowed.
- [ ] Resident roles cannot access admin pages.
- [ ] Logout invalidates session and protected route access.
- [ ] Expired sessions redirect to `/login` without exposing data.

## RLS And Tenant Isolation

- [ ] RLS enabled and forced on tenant tables.
- [ ] Residents can view only own resident, payment, invoice, leave, and document records.
- [ ] Admins can access only their organization.
- [ ] Super admin access is intentional and audited.
- [ ] Search, reports, analytics, realtime, and exports require `organization_id`.
- [ ] Security tests pass:

```bash
npm run test:security
```

## Storage And Uploads

- [ ] Aadhaar documents are private.
- [ ] Payment screenshots are private.
- [ ] Invoice PDFs are private and signed URLs expire.
- [ ] Public gallery images are the only public files.
- [ ] Payment proof upload requires linked payment ownership.
- [ ] Verified payments reject new proof uploads.
- [ ] File type and size validation enforced on server.

## Financial Safety

- [ ] Room allocation uses `allocate_room_atomic()`.
- [ ] Payment verification uses atomic RPC.
- [ ] Payment verification requires non-rejected proof.
- [ ] Verified payments are immutable.
- [ ] Invoice generation uses unique monthly fee record constraint.
- [ ] Invoice creation uses atomic numbering.
- [ ] Audit logs capture admin payment verification.

## Secrets And Runtime

- [ ] `SUPABASE_SERVICE_ROLE_KEY` is server-only.
- [ ] No service-role key in client bundle or `NEXT_PUBLIC_`.
- [ ] `CRON_SECRET` is configured and unique by environment.
- [ ] Sentry tokens exist only in CI/Vercel secret store.
- [ ] Resend/Cashfree credentials are environment-specific.
- [ ] `.env.staging.example` contains placeholders only.

## Realtime

- [ ] Channel names include organization and hostel scope.
- [ ] Residents do not subscribe to other tenant channels.
- [ ] Realtime events do not include sensitive Aadhaar/payment proof URLs.
- [ ] Reconnect behavior does not duplicate financial mutations.

## XSS And Content

- [ ] CMS content is rendered safely.
- [ ] No unsafe HTML rendering without sanitization.
- [ ] User-entered notes are escaped.
- [ ] File names are sanitized before storage paths.

## Launch Blockers

Any unchecked item in these sections blocks production launch:

- Authentication and sessions
- RLS and tenant isolation
- Storage and uploads
- Financial safety
- Secrets and runtime

## Sign-Off

| Reviewer | Area | Date | Result |
| --- | --- | --- | --- |
| TODO | Auth/RLS | TODO | TODO |
| TODO | Storage/uploads | TODO | TODO |
| TODO | Payments/invoices | TODO | TODO |
| TODO | Deployment/secrets | TODO | TODO |
