# OpenAPI Auth Documentation

## Authentication

The platform uses Supabase Auth sessions. Browser clients authenticate through secure cookies managed by the Supabase SSR client.

## Authorization

RBAC is enforced in services:

| Role | Access |
| --- | --- |
| `super_admin` | Platform-wide support access |
| `owner` | Organization administration |
| `admin` | Organization administration |
| `staff` | Operational access where explicitly allowed |
| `resident` | Self-service resident portal |
| `parent` | Future parent portal |

## Tenant Boundary

Every organization-scoped endpoint requires `organizationId` in the request body or query string. Services verify that the authenticated user belongs to that organization before repositories run data access.
