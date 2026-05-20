# User Roles and Permissions

## Purpose

Define the access model for public visitors, residents, hostel staff, admins, owners, and future SaaS operators.

## Overview

Access control must be enforced at multiple layers:

- UI visibility in Next.js.
- Server-side role checks before mutations.
- Supabase Row Level Security for database isolation.
- Audit logs for sensitive actions.

UI checks improve user experience, but RLS and server-side checks provide actual security.

## Role Model

| Role | Scope | Description |
| --- | --- | --- |
| Public visitor | Public website | Can view published website pages only |
| Resident | Assigned organization and hostel | Can view own profile, dues, invoices, leaves, notices |
| Staff | Assigned hostel | Can perform limited operational tasks |
| Admin | Assigned hostel or organization | Can manage residents, rooms, payments, leaves, CMS, notices |
| Owner | Organization | Can view all hostels and financial summaries |
| Super admin | Platform | Future SaaS operator role for support and tenant management |

## Suggested Permission Categories

| Permission | Resident | Staff | Admin | Owner | Super Admin |
| --- | --- | --- | --- | --- | --- |
| View own profile | Yes | No | No | No | No |
| Edit own limited profile fields | Yes | No | No | No | No |
| View residents | No | Limited | Yes | Yes | Scoped |
| Create residents | No | Optional | Yes | Yes | Scoped |
| Manage rooms | No | Optional | Yes | Yes | Scoped |
| View payments | Own only | Optional | Yes | Yes | Scoped |
| Record offline payment | No | Optional | Yes | Yes | No by default |
| Approve leave | No | Optional | Yes | Yes | No by default |
| Publish notices | No | Optional | Yes | Yes | Scoped |
| Manage CMS | No | No | Yes | Yes | Scoped |
| Manage settings | No | No | Limited | Yes | Scoped |

## Tenant and Hostel Scope

```txt
User
  -> Membership
    -> organization_id
    -> hostel_id, optional
    -> role
    -> permissions
```

All tenant-owned records should include `organization_id`. Hostel-specific records should also include `hostel_id`.

## Permission Enforcement Layers

### Frontend

- Hide inaccessible navigation.
- Show permission-aware empty states.
- Avoid fetching admin data in resident routes.
- Avoid relying only on UI checks.

### Server Actions and Route Handlers

- Validate authenticated user.
- Validate membership scope.
- Validate permission for action.
- Validate target record belongs to allowed organization or hostel.
- Write audit log for sensitive actions.

### Database RLS

- Filter by `organization_id`.
- Filter resident views to own `user_id` or resident profile mapping.
- Restrict writes by role.
- Deny service role usage in client contexts.

## Example Permission Object

```ts
type Permission =
  | "resident.read"
  | "resident.write"
  | "room.read"
  | "room.write"
  | "payment.read"
  | "payment.write"
  | "leave.approve"
  | "cms.publish"
  | "settings.write"
```

## Critical Actions Requiring Audit Logs

- Login failures beyond threshold.
- Resident creation and status changes.
- Room allocation and room transfer.
- Payment creation, reversal, refund, reconciliation.
- Invoice generation and cancellation.
- Leave approval or rejection.
- CMS publish action.
- Role or permission updates.
- Service key or integration setting updates.

## TODO Placeholders

- TODO: Finalize staff role capabilities.
- TODO: Define owner vs admin financial permissions.
- TODO: Define super admin support access rules.
- TODO: Create permission enum in database.
- TODO: Define invite flow for admins and staff.
- TODO: Define resident account creation flow.
- TODO: Define audit log retention policy.

## Future Expansion Notes

- Add custom roles per organization.
- Add permission templates for hostel chains.
- Add temporary support access with expiration.
- Add approval workflows for sensitive finance actions.
- Add guardian role with limited resident-linked access.

