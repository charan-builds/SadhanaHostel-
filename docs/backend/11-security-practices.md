# Security Practices

## Purpose

Define backend security practices for data, APIs, RLS, payments, uploads, secrets, and operations.

## Scope

Applies to:

- Database.
- Auth.
- APIs.
- Storage.
- Payments.
- Notifications.
- Deployment.

## Responsibilities

Backend owns:

- Server-side enforcement.
- Secret management.
- RLS.
- Audit logging.
- Webhook verification.

Frontend owns:

- Avoiding secret exposure and using documented contracts.

## Architecture Overview

```txt
Request
  -> authentication
  -> authorization
  -> validation
  -> RLS-protected query
  -> audit if sensitive
```

## Security Checklist

- [ ] RLS enabled on tenant-owned tables.
- [ ] Service role key server-only.
- [ ] Cashfree webhook verified.
- [ ] File uploads validated.
- [ ] Admin actions permission checked.
- [ ] Financial changes audited.
- [ ] Secrets stored in Vercel/Supabase only.

## Rate Limiting

Rate-limit candidates:

- Auth attempts.
- Contact inquiries.
- Payment order creation.
- File upload URL creation.
- Notification test sends.

## TODO Placeholders

- TODO: Define rate limiting implementation.
- TODO: Define MFA requirements.
- TODO: Define audit event names.
- TODO: Define incident response.
- TODO: Define support access policy.

## Future Scalability Notes

- Add tenant-level IP allowlists.
- Add anomaly detection for payments.
- Add security event dashboards.
- Add compliance exports.

