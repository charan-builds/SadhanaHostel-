# Authorization and RBAC

## Purpose

Define role-based access control, tenant isolation, permission checks, and RLS alignment.

## Scope

Applies to all protected backend reads, writes, storage access, and provider-triggered workflows.

## Responsibilities

Backend owns:

- Role and permission model.
- Server-side access guards.
- RLS policies.
- Audit logs for permission changes.

Frontend owns:

- Permission-aware rendering only.

## Architecture Overview

```txt
auth.uid()
  -> users
  -> memberships
  -> role + organization_id + hostel_id
  -> server guard
  -> RLS policy
```

## Roles

| Role | Scope | Notes |
| --- | --- | --- |
| resident | own records | Portal only |
| staff | assigned hostel | Limited modules |
| admin | hostel/organization | Operational admin |
| owner | organization | Full tenant control |
| super_admin | platform | Future SaaS support |

## Permission Examples

```txt
resident.read
resident.write
room.read
room.write
payment.read
payment.write
leave.approve
notice.publish
cms.publish
settings.write
```

## Server Guard Placeholder

```ts
async function requirePermission(permission: Permission, scope: Scope) {
  // 1. Load session
  // 2. Load membership
  // 3. Validate organization_id and hostel_id
  // 4. Return user context or throw FORBIDDEN
}
```

## RLS Requirements

- All tenant-owned tables include `organization_id`.
- Hostel-specific tables include `hostel_id`.
- Residents can select own rows only.
- Admin access depends on active membership.
- Public CMS reads only published content.

## TODO Placeholders

- TODO: Define permissions enum.
- TODO: Define membership schema.
- TODO: Write RLS helper SQL functions.
- TODO: Define role invitation workflow.
- TODO: Add RLS tests.

## Future Scalability Notes

- Add custom roles per organization.
- Add temporary elevated access.
- Add owner approval for financial reversals.
- Add support access expiration for SaaS operations.

