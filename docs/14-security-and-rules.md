# Security and Rules

## Purpose

Define the security posture, data protection rules, Supabase Row Level Security strategy, audit logging, backups, monitoring, and operational controls.

## Overview

The platform stores sensitive resident, financial, document, and operational data. Security must be designed into the database, server layer, environment handling, and deployment process from the beginning.

## Security Principles

- Deny by default.
- Use RLS on all tenant-owned tables.
- Keep service role keys server-only.
- Validate every mutation server-side.
- Audit sensitive actions.
- Verify payment webhooks.
- Protect resident documents with storage policies.
- Use least privilege for roles and providers.

## Data Classification

| Data Type | Sensitivity | Examples |
| --- | --- | --- |
| Public | Low | Published website content |
| Internal | Medium | Room inventory, notices |
| Personal | High | Resident profile, guardian contact |
| Financial | High | Payments, invoices, dues |
| Documents | High | ID proofs, agreements |
| Secrets | Critical | Supabase service role key, Cashfree secret |

## Supabase RLS Strategy

Tables requiring RLS:

- `organizations`
- `hostels`
- `users`
- `memberships`
- `residents`
- `rooms`
- `room_allocations`
- `monthly_fee_records`
- `payments`
- `leave_requests`
- `notices`
- `notifications`
- `gallery`
- `website_settings`
- `invoices`
- `documents`
- `audit_logs`

## RLS Policy Placeholder

```sql
-- Example only. Final policies must be written after schema finalization.
create policy "admins can read residents in organization"
on residents
for select
using (
  organization_id in (
    select organization_id
    from memberships
    where user_id = auth.uid()
      and role in ('admin', 'owner', 'staff')
      and status = 'active'
  )
);
```

## Environment Variable Rules

Client-safe:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

Server-only:

```bash
SUPABASE_SERVICE_ROLE_KEY=
CASHFREE_SECRET_KEY=
CASHFREE_WEBHOOK_SECRET=
```

Rules:

- Never commit `.env.local`.
- Never expose service role key to client components.
- Rotate keys after accidental exposure.
- Use Vercel environment variables for deployment.

## Payment Security

- Verify Cashfree webhook signatures.
- Store webhook payloads for audit.
- Use idempotency checks.
- Do not trust client-side payment redirects.
- Restrict manual payment edits.
- Require reason for payment reversal or adjustment.

## Document Security

- Store documents in private Supabase Storage buckets.
- Use signed URLs with short expiry.
- Restrict document access to owner resident and authorized admins.
- Audit document verification changes.

## Audit Log Requirements

Audit fields:

| Field | Description |
| --- | --- |
| `id` | Audit log ID |
| `organization_id` | Tenant scope |
| `actor_user_id` | User performing action |
| `action` | Action identifier |
| `entity_type` | Table or domain entity |
| `entity_id` | Target record |
| `before` | JSON snapshot before change |
| `after` | JSON snapshot after change |
| `ip_address` | Request IP if available |
| `user_agent` | Request user agent |
| `created_at` | Timestamp |

## Monitoring Requirements

Track:

- Authentication failures.
- Authorization failures.
- Payment webhook failures.
- Notification delivery failures.
- Database query latency.
- Build and deployment failures.
- Storage access errors.

## Backup Requirements

- Enable Supabase daily backups.
- Document restore steps.
- Export critical financial data periodically.
- Back up generated invoice PDFs or ensure storage durability.
- Test recovery before production launch.

## Security Review Checklist

- RLS enabled on all tenant-owned tables.
- No service role key in client bundle.
- Webhooks verified.
- Admin routes protected server-side.
- Resident routes scoped to own user.
- Storage buckets protected.
- Environment variables configured in Vercel.
- Audit logs created for finance and role changes.

## TODO Placeholders

- TODO: Write final RLS policies after schema design.
- TODO: Define password policy.
- TODO: Define MFA requirements.
- TODO: Define document retention rules.
- TODO: Define audit log retention period.
- TODO: Define incident response process.
- TODO: Define monitoring provider.

## Future Expansion Notes

- Add MFA for privileged users.
- Add security event dashboard.
- Add automatic anomaly detection for payments.
- Add tenant-managed IP allowlists for admin routes.
- Add data export and deletion workflows for compliance.

