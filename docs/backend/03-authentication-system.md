# Authentication System

## Purpose

Define backend authentication responsibilities using Supabase Auth with Next.js App Router.

## Scope

Covers:

- Login.
- Logout.
- Session refresh.
- User profile linking.
- Resident/admin onboarding.
- Protected routes.

## Responsibilities

Backend owns:

- Supabase Auth integration.
- Session validation.
- Auth callbacks.
- User and membership linking.
- Secure cookie/session behavior.

Frontend owns:

- Login UI.
- Forgot password UI.
- Auth-related loading and error states.

## Architecture Overview

```txt
User credentials
  -> Supabase Auth
  -> session cookie
  -> users profile
  -> memberships
  -> route guard
  -> role-based redirect
```

## Auth Flows

### Admin Login

```txt
Admin submits login
  -> Supabase validates
  -> Load memberships
  -> Verify admin/staff/owner role
  -> Redirect to /admin/dashboard
```

### Resident Login

```txt
Resident submits login
  -> Supabase validates
  -> Load resident profile by user_id
  -> Redirect to /resident/dashboard
```

## Account Linking

| Account Type | Link Strategy |
| --- | --- |
| Admin/staff | `memberships.user_id` |
| Owner | organization-level membership |
| Resident | `residents.user_id` |
| Future guardian | guardian link table |

## Security Requirements

- Do not expose service role key.
- Use server-side session checks.
- Rate-limit auth endpoints where possible.
- Log suspicious auth failures.
- Consider MFA for admin/owner roles.

## TODO Placeholders

- TODO: Define auth route paths.
- TODO: Define forgot password flow.
- TODO: Define invite flow.
- TODO: Define MFA policy.
- TODO: Define session timeout rules.

## Future Scalability Notes

- Add SSO for hostel chains.
- Add guardian auth.
- Add support impersonation with strict audit.
- Add device/session management.

