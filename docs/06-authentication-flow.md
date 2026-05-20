# Authentication Flow

## Purpose

Define authentication, session handling, account creation, route protection, role resolution, and future multi-tenant access rules.

## Overview

Supabase Auth will provide identity management. The application will use Supabase SSR clients with Next.js App Router for secure server-side reads and mutations. Authorization must be based on memberships and RLS, not only on the existence of a logged-in user.

## Authentication Providers

Initial provider plan:

| Provider | Phase | Notes |
| --- | --- | --- |
| Email/password | Phase 1 | Admin and resident login |
| Magic link | Optional | Useful for resident onboarding |
| Phone OTP | Later | Requires SMS provider planning |
| Google OAuth | Optional | Consider for admins only if needed |

## Identity Model

```txt
auth.users
  -> users
    -> memberships
      -> organization_id
      -> hostel_id
      -> role
```

Resident portal users should map to a `residents.user_id`.

## Login Flow

```txt
User submits credentials
  -> Supabase Auth validates identity
  -> Session cookie is set
  -> App loads user profile
  -> App loads memberships
  -> Redirect by role
```

Recommended redirects:

| Role | Redirect |
| --- | --- |
| Resident | `/resident/dashboard` |
| Staff | `/admin/dashboard` |
| Admin | `/admin/dashboard` |
| Owner | `/admin/dashboard` initially, owner route later |
| Super admin | Future `/super-admin/dashboard` |

## Resident Account Creation Flow

1. Admin creates resident record.
2. Admin sends invite or creates portal access.
3. Resident completes authentication.
4. Supabase auth user is linked to resident.
5. Resident can access portal routes.

TODO: Decide whether resident accounts are invited by email, phone, or created manually.

## Admin Account Creation Flow

1. Owner invites admin or staff.
2. Invite creates pending membership.
3. User signs up or accepts invite.
4. Membership becomes active.
5. Role controls admin dashboard access.

## Route Protection

Protected route layouts should check:

```txt
1. Is session present?
2. Does user profile exist?
3. Does active membership exist?
4. Does role permit this route group?
5. Is record access restricted by RLS?
```

## Session Handling

- Use Supabase SSR client on server routes.
- Keep auth cookies HTTP-only where Supabase SSR supports it.
- Refresh sessions through Supabase recommended middleware if required.
- Avoid storing sensitive access data in localStorage.

## Authorization Checks

Example server-side guard placeholder:

```ts
async function requireRole(input: {
  allowedRoles: Array<"admin" | "owner" | "staff" | "resident">
  organizationId?: string
  hostelId?: string
}) {
  // TODO: Load session, user, membership, and permission set.
}
```

## RLS Responsibilities

RLS must enforce:

- Resident reads only own records.
- Admin reads only assigned organization/hostel.
- Staff accesses only granted modules.
- Public reads only published CMS content.
- Writes require active membership and correct role.

## Security Requirements

- Enforce strong passwords if using email/password.
- Rate limit login attempts where supported.
- Log suspicious access attempts.
- Disable inactive users.
- Require server-side checks for financial actions.
- Never use service role key in client code.

## Monitoring

Track:

- Login failures.
- Password reset requests.
- Invite accept failures.
- Unauthorized route access attempts.
- Role and membership changes.

## TODO Placeholders

- TODO: Define exact login routes.
- TODO: Define forgot password flow.
- TODO: Define account invite email templates.
- TODO: Define RLS helper functions.
- TODO: Define middleware requirements after Supabase integration.
- TODO: Define session timeout policy.
- TODO: Define MFA requirements for owner/admin roles.

## Future Expansion Notes

- Add MFA for owners and finance admins.
- Add guardian accounts linked to residents.
- Add support access with explicit tenant approval.
- Add SSO for larger hostel chains.
- Add device/session management page.

